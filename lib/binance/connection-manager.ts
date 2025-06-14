import { logger } from '@/lib/utils/logger';
import { createRateLimitedLogger } from '@/lib/utils/rate-limiter';
import { validateBinanceTradeMessage, validateBinanceKlineMessage, type BinanceTradeMessage, type BinanceKlineMessage } from '@/types/market';

const rateLimitedLogger = createRateLimitedLogger(logger);

type MessageHandler = (data: BinanceTradeMessage | BinanceKlineMessage | Record<string, unknown>) => void;
type UnsubscribeFunction = () => void;

interface StreamSubscription {
  id: string;
  handler: MessageHandler;
  streamName: string;
}

class BinanceConnectionManager {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, StreamSubscription[]> = new Map();
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private subscriptionId = 0;
  private reconnectInProgress = false;

  private readonly baseUrl = 'wss://stream.binance.com:9443/ws/';

  constructor() {
    // Auto-connect on instantiation
    this.connect();
  }

  private connect(): void {
    // Check environment and security constraints
    if (typeof window === 'undefined') {
      logger.warn('[BinanceWS] Server-side WebSocket connections not supported');
      return;
    }

    // Security check: only allow connections to trusted domains
    const allowedDomains = ['stream.binance.com'];
    const wsUrl = new URL(this.baseUrl);
    if (!allowedDomains.includes(wsUrl.hostname)) {
      logger.error('[BinanceWS] Attempted connection to untrusted domain', { domain: wsUrl.hostname });
      return;
    }

    // Additional security: rate limiting check
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      logger.warn('[BinanceWS] Connection blocked due to excessive reconnection attempts');
      return;
    }
    
    try {
      // Create composite stream URL for multiple subscriptions
      const streamNames = Array.from(this.subscriptions.keys());
      const streamUrl = streamNames.length > 0 
        ? `${this.baseUrl}${streamNames.join('/')}`
        : `${this.baseUrl}btcusdt@trade`; // Default stream

      logger.info('[BinanceWS] Connecting to', { url: streamUrl });
      
      // Use native WebSocket in browser
      const WebSocketClass = WebSocket;
      
      this.ws = new WebSocketClass(streamUrl);
      
      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectInProgress = false;
        logger.info('[BinanceWS] Connected successfully');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as Record<string, unknown>;
          this.handleMessage(data);
        } catch (error) {
          logger.error('[BinanceWS] Failed to parse message', {}, error);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        logger.warn('[BinanceWS] Connection closed', { 
          code: event.code, 
          reason: event.reason 
        });
        this.handleReconnection();
      };

      this.ws.onerror = (error) => {
        logger.error('[BinanceWS] Connection error', { 
          url: streamUrl,
          readyState: this.ws?.readyState,
          reconnectAttempts: this.reconnectAttempts
        }, error);
        this.isConnected = false;
        
        // Security: Don't expose internal error details to potential attackers
        if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
          // In production, log minimal error details
          console.warn('[WebSocket] Connection issue detected');
        }
      };

    } catch (error) {
      logger.error('[BinanceWS] Failed to create connection', {}, error);
      this.handleReconnection();
    }
  }

  private handleMessage(data: Record<string, unknown>): void {
    if (!data || !data.stream) {
      // Handle single stream format
      const streamName = this.getStreamNameFromData(data);
      if (streamName) {
        this.notifySubscribers(streamName, data);
      }
      return;
    }

    // Handle multi-stream format
    const stream = data.stream as string;
    const streamData = data.data as Record<string, unknown>;
    this.notifySubscribers(stream, streamData);
  }

  private getStreamNameFromData(data: Record<string, unknown>): string | null {
    const eventType = data.e as string | undefined;
    const symbol = data.s as string | undefined;
    
    if (!eventType || !symbol) return null;
    if (eventType === 'trade') {
      return `${symbol.toLowerCase()}@trade`;
    }
    if (eventType === 'kline') {
      const klineData = data.k as { i?: string } | undefined;
      if (klineData?.i) {
        return `${symbol.toLowerCase()}@kline_${klineData.i}`;
      }
    }
    if (eventType === 'depthUpdate') {
      return `${symbol.toLowerCase()}@depth`;
    }
    return null;
  }

  private notifySubscribers(streamName: string, data: Record<string, unknown>): void {
    // Validate message based on stream type
    let validatedData: BinanceTradeMessage | BinanceKlineMessage | Record<string, unknown> = data;
    
    if (streamName.includes('@trade')) {
      validatedData = validateBinanceTradeMessage(data);
      if (!validatedData) {
        rateLimitedLogger.rateLimit(
          'WS_INVALID_TRADE', 
          10, 
          60000, 
          'warn', 
          '[BinanceWS] Invalid trade message received', 
          { streamName }
        );
        return;
      }
    } else if (streamName.includes('@kline')) {
      validatedData = validateBinanceKlineMessage(data);
      if (!validatedData) {
        rateLimitedLogger.rateLimit(
          'WS_INVALID_KLINE', 
          10, 
          60000, 
          'warn', 
          '[BinanceWS] Invalid kline message received', 
          { streamName }
        );
        return;
      }
    }

    const subscribers = this.subscriptions.get(streamName) || [];
    subscribers.forEach(subscription => {
      try {
        subscription.handler(validatedData);
      } catch (error) {
        logger.error('[BinanceWS] Error in subscription handler', {
          streamName,
          subscriptionId: subscription.id
        }, error);
      }
    });
  }

  private handleReconnection(): void {
    if (this.reconnectInProgress) {
      logger.debug('[BinanceWS] Reconnection already in progress');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('[BinanceWS] Max reconnection attempts reached');
      this.reconnectInProgress = false;
      return;
    }

    this.reconnectInProgress = true;
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    logger.info('[BinanceWS] Attempting reconnection', {
      attempt: this.reconnectAttempts,
      delay
    });

    setTimeout(() => {
      if (this.reconnectInProgress) {
        this.connect();
      }
    }, delay);
  }

  public subscribe(streamName: string, handler: MessageHandler): UnsubscribeFunction {
    const subscriptionId = (++this.subscriptionId).toString();
    
    const subscription: StreamSubscription = {
      id: subscriptionId,
      handler,
      streamName
    };

    // Add to subscriptions
    if (!this.subscriptions.has(streamName)) {
      this.subscriptions.set(streamName, []);
    }
    this.subscriptions.get(streamName)!.push(subscription);

    logger.info('[BinanceWS] Added subscription', {
      streamName,
      subscriptionId,
      totalSubscriptions: this.subscriptions.get(streamName)!.length
    });

    // Reconnect with new streams if needed
    if (this.isConnected && this.ws) {
      this.ws.close();
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribe(streamName, subscriptionId);
    };
  }

  private unsubscribe(streamName: string, subscriptionId: string): void {
    const subscribers = this.subscriptions.get(streamName);
    if (!subscribers) return;

    const index = subscribers.findIndex(sub => sub.id === subscriptionId);
    if (index !== -1) {
      subscribers.splice(index, 1);
      
      // Remove stream entirely if no more subscribers
      if (subscribers.length === 0) {
        this.subscriptions.delete(streamName);
      }

      logger.info('[BinanceWS] Removed subscription', {
        streamName,
        subscriptionId,
        remainingSubscriptions: subscribers.length
      });

      // Reconnect with updated streams
      if (this.isConnected && this.ws) {
        this.ws.close();
      }
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public disconnect(): void {
    logger.info('[BinanceWS] Disconnecting...');
    this.reconnectInProgress = false;
    this.subscriptions.clear();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

// Singleton instance
export const binanceConnectionManager = new BinanceConnectionManager();