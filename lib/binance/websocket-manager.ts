// Binance WebSocket connection manager for real-time price tracking

import { logger } from '@/lib/utils/logger';
import type { BinanceTradeMessage } from '@/types/market';

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

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Subscribe to price updates for a symbol
   */
  subscribe(symbol: string, callback: PriceUpdateCallback): () => void {
    const normalizedSymbol = symbol.toUpperCase();
    
    // Add callback
    if (!this.callbacks.has(normalizedSymbol)) {
      this.callbacks.set(normalizedSymbol, new Set());
    }
    this.callbacks.get(normalizedSymbol)!.add(callback);
    
    // Create connection if needed
    if (!this.connections.has(normalizedSymbol)) {
      this.createConnection(normalizedSymbol);
    }
    
    logger.info('[BinanceWS] Subscribed to symbol', { symbol: normalizedSymbol });
    
    // Return unsubscribe function
    return () => {
      this.unsubscribe(normalizedSymbol, callback);
    };
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
   * Close all connections
   */
  closeAll(): void {
    logger.info('[BinanceWS] Closing all connections');
    
    this.connections.forEach((ws, symbol) => {
      ws.close();
    });
    
    this.connections.clear();
    this.callbacks.clear();
    this.status.subscribedSymbols.clear();
    this.status.connected = false;
    
    // Clear timeouts
    this.reconnectTimeouts.forEach(timeout => clearTimeout(timeout));
    this.reconnectTimeouts.clear();
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  /**
   * Create WebSocket connection for a symbol
   */
  private createConnection(symbol: string): void {
    const streamName = `${symbol.toLowerCase()}@trade`;
    const wsUrl = `wss://stream.binance.com:9443/ws/${streamName}`;
    
    logger.info('[BinanceWS] Creating connection', { symbol, url: wsUrl });
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        logger.info('[BinanceWS] Connection opened', { symbol });
        this.status.connected = true;
        this.status.subscribedSymbols.add(symbol);
        this.status.reconnectCount = 0;
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleTradeData(symbol, data);
          this.status.lastUpdate = Date.now();
        } catch (error) {
          logger.error('[BinanceWS] Failed to parse message', { symbol, error });
        }
      };
      
      ws.onclose = (event) => {
        logger.warn('[BinanceWS] Connection closed', { 
          symbol, 
          code: event.code, 
          reason: event.reason || 'No reason provided',
          wasClean: event.wasClean
        });
        
        this.connections.delete(symbol);
        this.status.subscribedSymbols.delete(symbol);
        
        // Update connection status
        this.status.connected = this.connections.size > 0;
        
        // Attempt reconnection if there are still callbacks
        if (this.callbacks.get(symbol)?.size) {
          this.scheduleReconnect(symbol);
        }
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
  private handleTradeData(symbol: string, data: BinanceTradeMessage): void {
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
    // Clear existing timeout
    const existingTimeout = this.reconnectTimeouts.get(symbol);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Calculate backoff delay
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, this.status.reconnectCount), maxDelay);
    
    logger.info('[BinanceWS] Scheduling reconnect', { symbol, delay, attempt: this.status.reconnectCount + 1 });
    
    const timeout = setTimeout(() => {
      this.status.reconnectCount++;
      this.createConnection(symbol);
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
      const now = Date.now();
      const timeSinceLastUpdate = now - this.status.lastUpdate;
      
      // If no updates for 60 seconds, consider connections stale
      if (timeSinceLastUpdate > 60000 && this.connections.size > 0) {
        logger.warn('[BinanceWS] Stale connections detected, reconnecting');
        
        // Reconnect all active symbols
        const symbols = Array.from(this.status.subscribedSymbols);
        symbols.forEach(symbol => {
          this.closeConnection(symbol);
          if (this.callbacks.get(symbol)?.size) {
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
  window.addEventListener('beforeunload', () => {
    binanceWS.closeAll();
  });
}