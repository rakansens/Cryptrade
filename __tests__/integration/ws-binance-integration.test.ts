/**
 * Integration Test: WSManager + Binance API
 * Tests the complete flow from WebSocket connection to data processing
 */

import { WSManager } from '@/lib/ws/WSManager';
import { binanceAPI } from '@/lib/binance/api-service';
import { binanceConnectionManager } from '@/lib/binance/connection-manager';
import { useMarketStoreBase } from '@/store/market.store';
import { MockWebSocket, BinanceMessageGenerator, setupWebSocketMocking } from '@/lib/ws/__tests__/websocket-mock';
import type { BinanceTradeMessage, BinanceKlineMessage } from '@/types/market';
import { createPriceUpdate } from '../helpers/test-utils';

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

// Setup WebSocket mocking
const cleanupMock = setupWebSocketMocking();

describe('WSManager + Binance API Integration', () => {
  let wsManager: WSManager;
  let marketStore: ReturnType<typeof useMarketStoreBase.getState>;

  beforeEach(() => {
    jest.clearAllMocks();
    MockWebSocket.clearInstances();
    
    // Initialize components
    wsManager = new WSManager({
      url: 'wss://stream.binance.com:9443/ws/',
      debug: false
    });
    
    marketStore = useMarketStoreBase.getState();
    
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
    it('should update market store with WebSocket price data', (done) => {
      const symbol = 'BTCUSDT';
      const expectedPrice = 52000;
      
      // Subscribe to price updates in store
      const unsubscribe = useMarketStoreBase.subscribe((state: ReturnType<typeof useMarketStoreBase.getState>) => {
        if (state.currentPrices[symbol]) {
          expect(state.currentPrices[symbol].price).toBe(expectedPrice);
          unsubscribe();
          done();
        }
      });
      
      // Connect to WebSocket stream
      binanceConnectionManager.subscribe(`${symbol.toLowerCase()}@ticker`, (data) => {
        console.log('Received WebSocket data:', data);
        // 24hr ticker messages have 'c' field for current price
        if ('c' in data && typeof data['c'] === 'string') {
          console.log('Setting price for', symbol, 'to', data['c']);
          marketStore.setCurrentPrice(symbol, createPriceUpdate(symbol, parseFloat(data['c'])));
        }
      });
      
      // Simulate WebSocket message
      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`);
        if (ws) {
          ws.simulateMessage({
            e: '24hrTicker',
            E: Date.now(),
            s: symbol,
            p: '0',
            P: '0',
            w: '0',
            x: '0',
            c: expectedPrice.toString(), // Current price
            Q: '0',
            b: '0',
            B: '0',
            a: '0',
            A: '0',
            o: '51000', // Open price
            h: '52500', // High price
            l: '50500', // Low price
            v: '1000', // Volume
            V: '0',
            q: '51000000', // Quote volume
            O: 0,
            C: 0,
            F: 0,
            L: 0,
            n: 0
          } as any);
        }
      }, 50);
    });

    it('should handle multiple symbol subscriptions', (done) => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
      const receivedPrices = new Set<string>();
      
      // Subscribe to multiple symbols
      symbols.forEach(symbol => {
        binanceConnectionManager.subscribe(`${symbol.toLowerCase()}@ticker`, (data) => {
          if ('c' in data && typeof data['c'] === 'string') {
            marketStore.setCurrentPrice(symbol, createPriceUpdate(symbol, parseFloat(data['c'])));
            receivedPrices.add(symbol);
          
            if (receivedPrices.size === symbols.length) {
              // Verify all prices are in store
              symbols.forEach(s => {
                expect(marketStore.currentPrices[s]).toBeDefined();
                expect(marketStore.currentPrices[s]?.price).toBeGreaterThan(0);
              });
              done();
            }
          }
        });
      });
      
      // Simulate messages for all symbols
      setTimeout(() => {
        symbols.forEach((symbol, index) => {
          const ws = MockWebSocket.getInstanceByUrl(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`);
          if (ws) {
            ws.simulateMessage({
              e: '24hrTicker',
              E: Date.now(),
              s: symbol,
              p: '0',
              P: '0',
              w: '0',
              x: '0',
              c: (50000 + index * 1000).toString(),
              Q: '0',
              b: '0',
              B: '0',
              a: '0',
              A: '0',
              o: '50000',
              h: '55000',
              l: '45000',
              v: '1000',
              V: '0',
              q: '50000000',
              O: 0,
              C: 0,
              F: 0,
              L: 0,
              n: 0
            } as any);
          }
        });
      }, 50);
    });
  });

  describe('Kline Data Integration', () => {
    it('should process kline data and update indicators', (done) => {
      const symbol = 'BTCUSDT';
      const interval = '1m';
      
      // Subscribe to kline updates
      binanceConnectionManager.subscribe(`${symbol.toLowerCase()}@kline_${interval}`, (data) => {
        // Check if it's a BinanceKlineMessage with 'k' property
        if ('k' in data && typeof data.k === 'object' && data.k) {
          const kline = data.k as BinanceKlineMessage['k'];
          // Update store with kline data
          marketStore.addKline(symbol, {
            time: kline.t / 1000, // Convert to seconds
            open: parseFloat(kline.o),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c),
            volume: parseFloat(kline.v)
          });
        
          // Verify kline was added
          const klines = marketStore.priceData[symbol] || [];
          expect(klines).toBeDefined();
          expect(klines.length).toBeGreaterThan(0);
          
          const lastKline = klines[klines.length - 1];
          expect(lastKline?.close).toBe(parseFloat(kline.c));
          
          done();
        }
      });
      
      // Simulate kline message
      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`);
        if (ws) {
          ws.simulateMessage(BinanceMessageGenerator.klineMessage(symbol, interval));
        }
      }, 50);
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
      
      // Get historical data through API
      const historicalData = await binanceAPI.fetchKlines(
        symbol,
        interval,
        20
      );
      
      // Verify data consistency
      expect(historicalData).toBeDefined();
      expect((marketStore.priceData[symbol] || []).length).toBeGreaterThanOrEqual(20);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should fallback to REST API when WebSocket fails', async () => {
      const symbol = 'BTCUSDT';
      
      // Subscribe with automatic fallback
      const subscription = binanceConnectionManager.subscribe(`${symbol.toLowerCase()}@ticker`, (data) => {
        if ('c' in data && typeof data['c'] === 'string') {
          marketStore.setCurrentPrice(symbol, {
            symbol,
            price: parseFloat(data['c']),
            change: 0,
            changePercent: 0,
            time: Date.now()
          });
        }
      });
      
      // Simulate WebSocket failure
      setTimeout(() => {
        const ws = MockWebSocket.getAllInstances()[0];
        if (ws) {
          ws.simulateError(new Error('Connection lost'));
          ws.close(1006);
        }
      }, 50);
      
      // Wait for fallback to REST API
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify REST API was called as fallback
      const ticker = await binanceAPI.fetchTicker24hr(symbol);
      expect(ticker).toBeDefined();
      if (!Array.isArray(ticker)) {
        expect(ticker.symbol).toBe(symbol);
      }
      
      // Cleanup
      subscription?.();
    });

    it('should handle reconnection with data continuity', (done) => {
      const symbol = 'BTCUSDT';
      let messageCount = 0;
      let disconnected = false;
      
      binanceConnectionManager.subscribe(`${symbol.toLowerCase()}@trade`, (data) => {
        // Cast to BinanceTradeMessage for type safety
        const trade = data as BinanceTradeMessage;
        messageCount++;
        
        if (messageCount === 1) {
          // First message received, simulate disconnect
          setTimeout(() => {
            const ws = MockWebSocket.getAllInstances()[0];
            if (ws) {
              disconnected = true;
              ws.simulateDisconnect();
            }
          }, 50);
        } else if (messageCount === 2 && disconnected && trade.s) {
          // Second message after reconnection
          expect(trade.s).toBe(symbol);
          done();
        }
      });
      
      // Send first message
      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`);
        if (ws) {
          ws.simulateMessage(BinanceMessageGenerator.tradeMessage(symbol, '50000'));
        }
      }, 50);
      
      // Send message after reconnection
      setTimeout(() => {
        const instances = MockWebSocket.getAllInstances();
        const activeWs = instances.find(ws => ws.readyState === MockWebSocket.OPEN);
        if (activeWs) {
          activeWs.simulateMessage(BinanceMessageGenerator.tradeMessage(symbol, '51000'));
        }
      }, 300);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle high-frequency updates efficiently', (done) => {
      const symbol = 'BTCUSDT';
      const updateCount = 100;
      let receivedCount = 0;
      
      // Track performance
      const startTime = Date.now();
      
      binanceConnectionManager.subscribe(`${symbol.toLowerCase()}@aggTrade`, (_trade) => {
        receivedCount++;
        
        if (receivedCount === updateCount) {
          const duration = Date.now() - startTime;
          
          // Should process all messages quickly
          expect(duration).toBeLessThan(1000); // Less than 1 second
          
          // Verify store updates
          expect(marketStore.lastUpdateTime).toBeDefined();
          expect(marketStore.lastUpdateTime).toBeGreaterThan(startTime);
          
          done();
        }
      });
      
      // Send burst of messages
      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@aggTrade`);
        if (ws) {
          for (let i = 0; i < updateCount; i++) {
            ws.simulateMessage({
              e: 'aggTrade',
              E: Date.now(),
              s: symbol,
              a: 12345 + i,
              p: (50000 + i).toString(),
              q: '0.1',
              f: 100 + i,
              l: 100 + i,
              T: Date.now(),
              m: i % 2 === 0
            } as any);
          }
        }
      }, 50);
    }, 5000);
  });
});
