// Binance WebSocket connection manager for real-time price tracking

import { logger } from '@/lib/utils/logger';
import type { BinanceTradeMessage } from '@/types/market';
import { Mutex } from '@/lib/utils/concurrent';

export interface BinanceTradeData {
  symbol: string;      // Symbol
  price: number;       // Price
  quantity: number;    // Quantity
  timestamp: number;   // Trade time
  isBuyerMaker: boolean; // Was the buyer the maker?
}

export interface BinanceTicker24hr {
  symbol: string;
  priceChange: number;
  priceChangePercent: number;
  weightedAvgPrice: number;
  prevClosePrice: number;
  lastPrice: number;
  lastQty: number;
  bidPrice: number;
  askPrice: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
  openTime: number;
  closeTime: number;
  count: number;
}

export interface PriceUpdateCallback {
  (data: {
    symbol: string;
    price: number;
    volume: number;
    timestamp: number;
  }): void;
}

export interface ConnectionStatus {
  connected: boolean;
  subscribedSymbols: Set<string>;
  lastUpdate: number;
  reconnectCount: number;
}

export class BinanceWebSocketManager {
  private connections: Map<string, WebSocket> = new Map();
  private callbacks: Map<string, Set<PriceUpdateCallback>> = new Map();
  private status: ConnectionStatus = {
    connected: false,
    subscribedSymbols: new Set(),
    lastUpdate: 0,
    reconnectCount: 0
  };
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private heartbeatInterval?: NodeJS.Timeout;
  private connectionMutex = new Mutex();
  private statusMutex = new Mutex();
  private isDestroyed = false;

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Subscribe to price updates for a symbol
   */
  async subscribe(symbol: string, callback: PriceUpdateCallback): Promise<() => void> {
    const normalizedSymbol = symbol.toUpperCase();
    
    return this.connectionMutex.runExclusive(async () => {
      // Add callback
      if (!this.callbacks.has(normalizedSymbol)) {
        this.callbacks.set(normalizedSymbol, new Set());
      }
      this.callbacks.get(normalizedSymbol)!.add(callback);
      
      // Create connection if needed
      if (!this.connections.has(normalizedSymbol)) {
        await this.createConnection(normalizedSymbol);
      }
      
      logger.info('[BinanceWS] Subscribed to symbol', { symbol: normalizedSymbol });
      
      // Return unsubscribe function
      return () => {
        this.unsubscribe(normalizedSymbol, callback);
      };
    });
  }

  /**
   * Unsubscribe from price updates
   */
  unsubscribe(symbol: string, callback: PriceUpdateCallback): void {
    const normalizedSymbol = symbol.toUpperCase();
    const callbacks = this.callbacks.get(normalizedSymbol);
    
    if (callbacks) {
      callbacks.delete(callback);
      
      // If no more callbacks, close connection
      if (callbacks.size === 0) {
        this.closeConnection(normalizedSymbol);
      }
    }
    
    logger.info('[BinanceWS] Unsubscribed from symbol', { symbol: normalizedSymbol });
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return { ...this.status };
  }

  /**
   * Close all connections and cleanup resources
   */
  async closeAll(): Promise<void> {
    logger.info('[BinanceWS] Closing all connections');
    
    this.isDestroyed = true;
    
    await this.connectionMutex.runExclusive(async () => {
      // Clear heartbeat first
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        delete this.heartbeatInterval;
      }
      
      // Clear all reconnect timeouts
      this.reconnectTimeouts.forEach(timeout => clearTimeout(timeout));
      this.reconnectTimeouts.clear();
      
      // Close all WebSocket connections
      this.connections.forEach((ws, symbol) => {
        try {
          // Remove all event listeners before closing
          ws.onopen = null;
          ws.onmessage = null;
          ws.onclose = null;
          ws.onerror = null;
          
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
          }
        } catch (error) {
          logger.error('[BinanceWS] Error closing connection', { symbol, error });
        }
      });
      
      this.connections.clear();
      this.callbacks.clear();
      
      await this.statusMutex.runExclusive(async () => {
        this.status.subscribedSymbols.clear();
        this.status.connected = false;
      });
    });
  }
  
  /**
   * Destroy the manager and cleanup all resources
   */
  async destroy(): Promise<void> {
    await this.closeAll();
  }

  /**
   * Create WebSocket connection for a symbol
   */
  private async createConnection(symbol: string): Promise<void> {
    if (this.isDestroyed) {
      logger.warn('[BinanceWS] Manager is destroyed, not creating connection', { symbol });
      return;
    }
    
    const streamName = `${symbol.toLowerCase()}@trade`;
    const wsUrl = `wss://stream.binance.com:9443/ws/${streamName}`;
    
    logger.info('[BinanceWS] Creating connection', { symbol, url: wsUrl });
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = async () => {
        logger.info('[BinanceWS] Connection opened', { symbol });
        await this.statusMutex.runExclusive(async () => {
          this.status.connected = true;
          this.status.subscribedSymbols.add(symbol);
          this.status.reconnectCount = 0;
        });
      };
      
      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          await this.handleTradeData(symbol, data);
          await this.statusMutex.runExclusive(async () => {
            this.status.lastUpdate = Date.now();
          });
        } catch (error) {
          logger.error('[BinanceWS] Failed to parse message', { symbol, error });
        }
      };
      
      ws.onclose = async (event) => {
        logger.warn('[BinanceWS] Connection closed', { 
          symbol, 
          code: event.code, 
          reason: event.reason || 'No reason provided',
          wasClean: event.wasClean
        });
        
        await this.connectionMutex.runExclusive(async () => {
          this.connections.delete(symbol);
          await this.statusMutex.runExclusive(async () => {
            this.status.subscribedSymbols.delete(symbol);
            // Update connection status
            this.status.connected = this.connections.size > 0;
          });
          
          // Attempt reconnection if there are still callbacks
          if (this.callbacks.get(symbol)?.size) {
            this.scheduleReconnect(symbol);
          }
        });
      };
      
      ws.onerror = (event) => {
        logger.error('[BinanceWS] Connection error', { 
          symbol, 
          type: event.type,
          message: 'WebSocket connection failed'
        });
      };
      
      this.connections.set(symbol, ws);
      
    } catch (error) {
      logger.error('[BinanceWS] Failed to create connection', { 
        symbol, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Handle incoming trade data
   */
  private async handleTradeData(symbol: string, data: BinanceTradeMessage): Promise<void> {
    try {
      // Binance trade stream format
      const tradeData: BinanceTradeData = {
        symbol: data.s,
        price: parseFloat(data.p),
        quantity: parseFloat(data.q),
        timestamp: data.T,
        isBuyerMaker: data.m
      };
      
      // Notify callbacks
      const callbacks = this.callbacks.get(symbol);
      if (callbacks) {
        const updateData = {
          symbol: tradeData.symbol,
          price: tradeData.price,
          volume: tradeData.quantity,
          timestamp: tradeData.timestamp
        };
        
        callbacks.forEach(callback => {
          try {
            callback(updateData);
          } catch (error) {
            logger.error('[BinanceWS] Callback error', { 
              symbol, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
          }
        });
      }
      
    } catch (error) {
      logger.error('[BinanceWS] Failed to handle trade data', { 
        symbol, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(symbol: string): void {
    if (this.isDestroyed) {
      return;
    }
    
    // Clear existing timeout
    const existingTimeout = this.reconnectTimeouts.get(symbol);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.reconnectTimeouts.delete(symbol);
    }
    
    // Calculate backoff delay
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, this.status.reconnectCount), maxDelay);
    
    logger.info('[BinanceWS] Scheduling reconnect', { symbol, delay, attempt: this.status.reconnectCount + 1 });
    
    const timeout = setTimeout(() => {
      if (!this.isDestroyed) {
        this.status.reconnectCount++;
        this.createConnection(symbol);
      }
      this.reconnectTimeouts.delete(symbol);
    }, delay);
    
    this.reconnectTimeouts.set(symbol, timeout);
  }

  /**
   * Close connection for a specific symbol
   */
  private closeConnection(symbol: string): void {
    const ws = this.connections.get(symbol);
    if (ws) {
      ws.close();
      this.connections.delete(symbol);
      this.status.subscribedSymbols.delete(symbol);
    }
    
    // Clear reconnect timeout
    const timeout = this.reconnectTimeouts.get(symbol);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectTimeouts.delete(symbol);
    }
    
    // Update connection status
    this.status.connected = this.connections.size > 0;
    
    logger.info('[BinanceWS] Connection closed', { symbol });
  }

  /**
   * Heartbeat to monitor connection health
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isDestroyed) {
        if (this.heartbeatInterval) {
          clearInterval(this.heartbeatInterval);
          delete this.heartbeatInterval;
        }
        return;
      }
      
      const now = Date.now();
      const timeSinceLastUpdate = now - this.status.lastUpdate;
      
      // If no updates for 60 seconds, consider connections stale
      if (timeSinceLastUpdate > 60000 && this.connections.size > 0) {
        logger.warn('[BinanceWS] Stale connections detected, reconnecting');
        
        // Reconnect all active symbols
        const symbols = Array.from(this.status.subscribedSymbols);
        symbols.forEach(symbol => {
          this.closeConnection(symbol);
          if (this.callbacks.get(symbol)?.size && !this.isDestroyed) {
            this.scheduleReconnect(symbol);
          }
        });
      }
    }, 30000); // Check every 30 seconds
  }
}

// Singleton instance
export const binanceWS = new BinanceWebSocketManager();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  const cleanup = () => {
    // Use async IIFE to handle the promise
    (async () => {
      await binanceWS.destroy();
    })();
  };
  
  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('unload', cleanup);
  
  // Also cleanup on page visibility change (mobile browsers)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Use async IIFE to handle the promise
      (async () => {
        await binanceWS.closeAll();
      })();
    }
  });
}