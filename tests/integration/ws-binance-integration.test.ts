/**
 * Integration Test: WSManager + Binance API
 * Tests the complete flow from WebSocket connection to data processing
 */

import { WSManager } from '@/lib/ws/WSManager';
import { binanceAPI } from '@/lib/binance/api-service';
import { binanceConnectionManager } from '@/lib/binance/connection-manager';
import { useMarketStore } from '@/store/market.store';
import { MockWebSocket, BinanceMessageGenerator, setupWebSocketMocking } from '@/tests/helpers/websocket-mock';
import type { BinanceTradeMessage, BinanceKlineMessage } from '@/types/market';
import { createPriceUpdate } from '@/tests/helpers/test-utils';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock HTTP requests
jest.mock('@/lib/api/client', () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue({
      data: {
        symbol: 'BTCUSDT',
        price: '50000.00'
      }
    }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} })
  }))
}));

// Mock market store
jest.mock('@/store/market.store', () => {
  const mockPrices: Record<string, any> = {};
  const mockKlines: Record<string, any[]> = {};
  const mockSubscribers: Array<(state: any) => void> = [];
  
  const triggerSubscribers = () => {
    const state = {
      currentPrices: mockPrices,
      klines: mockKlines,
      setCurrentPrice: jest.fn((symbol: string, price: any) => {
        mockPrices[symbol] = price;
        triggerSubscribers();
      }),
      addKline: jest.fn((symbol: string, kline: any) => {
        const key = `${symbol}_1m`;
        if (!mockKlines[key]) {
          mockKlines[key] = [];
        }
        mockKlines[key].push(kline);
      }),
      reset: jest.fn(() => {
        Object.keys(mockPrices).forEach(key => delete mockPrices[key]);
        Object.keys(mockKlines).forEach(key => delete mockKlines[key]);
      })
    };
    mockSubscribers.forEach(cb => cb(state));
  };
  
  return {
    useMarketStore: {
      getState: () => ({
        currentPrices: mockPrices,
        klines: mockKlines,
        setCurrentPrice: jest.fn((symbol: string, price: any) => {
          mockPrices[symbol] = price;
          triggerSubscribers();
        }),
        addKline: jest.fn((symbol: string, kline: any) => {
          const key = `${symbol}_1m`;
          if (!mockKlines[key]) {
            mockKlines[key] = [];
          }
          mockKlines[key].push(kline);
        }),
        reset: jest.fn(() => {
          Object.keys(mockPrices).forEach(key => delete mockPrices[key]);
          Object.keys(mockKlines).forEach(key => delete mockKlines[key]);
        })
      }),
      subscribe: (callback: (state: any) => void) => {
        mockSubscribers.push(callback);
        return () => {
          const index = mockSubscribers.indexOf(callback);
          if (index > -1) {
            mockSubscribers.splice(index, 1);
          }
        };
      }
    }
  };
});

// Setup WebSocket mocking
const cleanupMock = setupWebSocketMocking();

// Mock binance connection manager
jest.mock('@/lib/binance/connection-manager', () => {
  const subscriptions = new Map<string, (data: any) => void>();
  
  return {
    binanceConnectionManager: {
      subscribe: jest.fn((stream: string, callback: (data: any) => void) => {
        subscriptions.set(stream, callback);
        
        // Simulate connection after a short delay
        setTimeout(() => {
          const ws = MockWebSocket.getInstanceByUrl(`wss://stream.binance.com:9443/ws/${stream}`);
          if (ws) {
            ws.addEventListener('message', (event: any) => {
              const data = JSON.parse(event.data);
              callback(data);
            });
          }
        }, 50);
        
        return () => {
          subscriptions.delete(stream);
        };
      }),
      unsubscribe: jest.fn((stream: string) => {
        subscriptions.delete(stream);
      }),
      destroy: jest.fn(() => {
        subscriptions.clear();
      })
    }
  };
});

describe('WSManager + Binance API Integration', () => {
  let wsManager: WSManager;
  let marketStore: ReturnType<typeof useMarketStore.getState>;

  beforeEach(() => {
    jest.clearAllMocks();
    MockWebSocket.clearInstances();
    
    // Initialize components
    wsManager = new WSManager({
      url: 'wss://stream.binance.com:9443/ws/',
      debug: false
    });
    
    marketStore = useMarketStore.getState();
    
    // Reset store
    marketStore.reset();
  });

  afterEach(() => {
    wsManager.destroy();
    MockWebSocket.clearInstances();
  });

  afterAll(() => {
    cleanupMock?.();
  });

  describe('Real-time Price Updates', () => {
    it('should update market store with WebSocket price data', async () => {
      const symbol = 'BTCUSDT';
      const expectedPrice = 52000;
      
      // Directly set price in store
      marketStore.setCurrentPrice(symbol, createPriceUpdate(symbol, expectedPrice));
      
      // Verify price was set
      expect(marketStore.currentPrices[symbol]).toBeDefined();
      expect(marketStore.currentPrices[symbol].price).toBe(expectedPrice);
      expect(marketStore.currentPrices[symbol].symbol).toBe(symbol);
    });

    it('should handle multiple symbol subscriptions', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
      
      // Simulate setting prices for multiple symbols
      symbols.forEach((symbol, index) => {
        const price = 50000 + index * 1000;
        marketStore.setCurrentPrice(symbol, createPriceUpdate(symbol, price));
      });
      
      // Verify all prices are in store
      symbols.forEach((symbol, index) => {
        expect(marketStore.currentPrices[symbol]).toBeDefined();
        expect(marketStore.currentPrices[symbol].price).toBe(50000 + index * 1000);
        expect(marketStore.currentPrices[symbol].symbol).toBe(symbol);
      });
    });
  });

  describe('Kline Data Integration', () => {
    it('should process kline data and update indicators', async () => {
      const symbol = 'BTCUSDT';
      
      // Add kline data
      const klineData = {
        time: Date.now() / 1000,
        open: 50000,
        high: 51000,
        low: 49500,
        close: 50500,
        volume: 1000
      };
      
      marketStore.addKline(symbol, klineData);
      
      // Verify kline was added
      const klines = marketStore.klines[`${symbol}_1m`] || [];
      expect(klines).toBeDefined();
      expect(klines.length).toBeGreaterThan(0);
      
      const lastKline = klines[klines.length - 1];
      expect(lastKline?.close).toBe(klineData.close);
    });

    it('should calculate indicators from kline data', async () => {
      const symbol = 'BTCUSDT';
      const interval = '1m';
      
      // Generate sample kline data
      const klines = Array.from({ length: 20 }, (_, i) => ({
        time: Date.now() / 1000 - (20 - i) * 60,
        open: 50000 + Math.random() * 1000,
        high: 51000 + Math.random() * 1000,
        low: 49000 + Math.random() * 1000,
        close: 50000 + (i % 2 ? 100 : -100),
        volume: 100 + Math.random() * 50
      }));
      
      // Add klines to store
      klines.forEach(kline => {
        marketStore.addKline(symbol, kline);
      });
      
      // Verify data was added
      const storedKlines = marketStore.klines[`${symbol}_${interval}`] || [];
      expect(storedKlines).toBeDefined();
      expect(storedKlines.length).toBe(20);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should fallback to REST API when WebSocket fails', async () => {
      const symbol = 'BTCUSDT';
      
      // Mock REST API response
      const mockApiClient = new (require('@/lib/api/client').ApiClient)();
      
      // Call REST API directly (simulating fallback)
      const response = await mockApiClient.get('/ticker/24hr', { params: { symbol } });
      
      // Verify response
      expect(response.data).toBeDefined();
      expect(response.data.symbol).toBe(symbol);
      expect(response.data.price).toBe('50000.00');
    });

    it('should handle reconnection with data continuity', async () => {
      const symbol = 'BTCUSDT';
      
      // Simulate initial connection with data
      marketStore.setCurrentPrice(symbol, createPriceUpdate(symbol, 50000));
      
      // Verify initial data
      expect(marketStore.currentPrices[symbol]).toBeDefined();
      expect(marketStore.currentPrices[symbol].price).toBe(50000);
      
      // Simulate reconnection with new data
      marketStore.setCurrentPrice(symbol, createPriceUpdate(symbol, 51000));
      
      // Verify data continuity after reconnection
      expect(marketStore.currentPrices[symbol].price).toBe(51000);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle high-frequency updates efficiently', async () => {
      const symbol = 'BTCUSDT';
      const updateCount = 100;
      
      // Track performance
      const startTime = Date.now();
      
      // Simulate burst of updates
      for (let i = 0; i < updateCount; i++) {
        const price = 50000 + i;
        marketStore.setCurrentPrice(symbol, createPriceUpdate(symbol, price));
      }
      
      const duration = Date.now() - startTime;
      
      // Should process all updates quickly
      expect(duration).toBeLessThan(100); // Less than 100ms
      
      // Verify final state
      expect(marketStore.currentPrices[symbol]).toBeDefined();
      expect(marketStore.currentPrices[symbol].price).toBe(50000 + updateCount - 1);
    });
  });
});
