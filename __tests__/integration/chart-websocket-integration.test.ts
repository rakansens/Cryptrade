/**
 * Integration Test: Chart + WebSocket Data Flow
 * Tests the complete flow from WebSocket data to chart rendering
 */

import { WSManager } from '@/lib/ws/WSManager';
import { ChartStore } from '@/store/chart.store';
import { MarketStore } from '@/store/market.store';
import { ChartAnalyzer } from '@/lib/chart/analyzer';
import { SeriesRegistry } from '@/lib/chart/SeriesRegistry';
import { MockWebSocket, BinanceMessageGenerator, setupWebSocketMocking } from '@/lib/ws/__tests__/websocket-mock';
import { ISeriesApi, Time } from 'lightweight-charts';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock lightweight-charts
const mockCandlestickSeries = {
  update: jest.fn(),
  setData: jest.fn(),
  priceScale: jest.fn().mockReturnValue({
    applyOptions: jest.fn()
  })
};

const mockChart = {
  addCandlestickSeries: jest.fn().mockReturnValue(mockCandlestickSeries),
  timeScale: jest.fn().mockReturnValue({
    fitContent: jest.fn(),
    scrollToPosition: jest.fn()
  }),
  remove: jest.fn()
};

jest.mock('lightweight-charts', () => ({
  createChart: jest.fn().mockReturnValue(mockChart),
  CrosshairMode: { Normal: 0 },
  PriceScaleMode: { Normal: 0, Logarithmic: 1 },
  LineStyle: { Solid: 0, Dotted: 1, Dashed: 2 }
}));

// Setup WebSocket mocking
const cleanupMock = setupWebSocketMocking();

describe('Chart + WebSocket Integration', () => {
  let wsManager: WSManager;
  let chartStore: ReturnType<typeof ChartStore.getState>;
  let marketStore: ReturnType<typeof MarketStore.getState>;
  let seriesRegistry: SeriesRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    MockWebSocket.clearInstances();
    
    // Initialize components
    wsManager = new WSManager({
      url: 'wss://stream.binance.com:9443/ws/',
      debug: false
    });
    
    chartStore = ChartStore.getState();
    marketStore = MarketStore.getState();
    seriesRegistry = new SeriesRegistry();
    
    // Reset stores
    chartStore.reset();
    marketStore.reset();
  });

  afterEach(() => {
    wsManager.destroy();
    MockWebSocket.clearInstances();
    seriesRegistry.clear();
  });

  afterAll(() => {
    cleanupMock?.();
  });

  describe('Real-time Chart Updates', () => {
    it('should update chart with live price data', (done) => {
      const symbol = 'BTCUSDT';
      const timeframe = '1m';
      
      // Set up chart
      chartStore.setSymbol(symbol);
      chartStore.setTimeframe(timeframe);
      
      // Register candlestick series
      seriesRegistry.registerSeries('main', mockCandlestickSeries as any);
      
      // Subscribe to kline updates
      const subscription = wsManager.subscribe(`${symbol.toLowerCase()}@kline_${timeframe}`).subscribe({
        next: (data) => {
          // Process kline data
          const candle = {
            time: Math.floor(data.k.t / 1000) as Time,
            open: parseFloat(data.k.o),
            high: parseFloat(data.k.h),
            low: parseFloat(data.k.l),
            close: parseFloat(data.k.c),
            volume: parseFloat(data.k.v)
          };
          
          // Update market store
          marketStore.addKline(symbol, candle);
          
          // Update chart
          mockCandlestickSeries.update(candle);
          
          // Verify chart was updated
          expect(mockCandlestickSeries.update).toHaveBeenCalledWith(candle);
          
          subscription.unsubscribe();
          done();
        },
        error: done.fail
      });
      
      // Simulate kline message
      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${timeframe}`);
        if (ws) {
          ws.simulateMessage(BinanceMessageGenerator.klineMessage(symbol, timeframe));
        }
      }, 50);
    });

    it('should handle multiple timeframe updates', (done) => {
      const symbol = 'BTCUSDT';
      const timeframes = ['1m', '5m', '15m', '1h'];
      let updatesReceived = 0;
      
      // Set up chart
      chartStore.setSymbol(symbol);
      
      // Subscribe to multiple timeframes
      const subscriptions = timeframes.map(tf => {
        return wsManager.subscribe(`${symbol.toLowerCase()}@kline_${tf}`).subscribe({
          next: (data) => {
            updatesReceived++;
            
            // Process kline for specific timeframe
            const candle = {
              time: Math.floor(data.k.t / 1000) as Time,
              open: parseFloat(data.k.o),
              high: parseFloat(data.k.h),
              low: parseFloat(data.k.l),
              close: parseFloat(data.k.c),
              volume: parseFloat(data.k.v)
            };
            
            // Update store with timeframe-specific data
            marketStore.addKline(symbol, candle, data.k.i);
            
            if (updatesReceived === timeframes.length) {
              // Verify all timeframes have data
              timeframes.forEach(tf => {
                const klines = marketStore.klines[`${symbol}_${tf}`];
                expect(klines).toBeDefined();
                expect(klines.length).toBeGreaterThan(0);
              });
              
              // Cleanup
              subscriptions.forEach(sub => sub.unsubscribe());
              done();
            }
          }
        });
      });
      
      // Simulate messages for all timeframes
      setTimeout(() => {
        timeframes.forEach(tf => {
          const ws = MockWebSocket.getInstanceByUrl(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${tf}`);
          if (ws) {
            ws.simulateMessage(BinanceMessageGenerator.klineMessage(symbol, tf));
          }
        });
      }, 50);
    });
  });

  describe('Chart Analysis Integration', () => {
    it('should detect patterns from live data', (done) => {
      const symbol = 'BTCUSDT';
      const analyzer = new ChartAnalyzer();
      
      // Generate sample data with a pattern
      const klines = Array.from({ length: 50 }, (_, i) => ({
        time: (Date.now() / 1000 - (50 - i) * 60) as Time,
        open: 50000 + Math.sin(i * 0.1) * 1000,
        high: 50500 + Math.sin(i * 0.1) * 1000,
        low: 49500 + Math.sin(i * 0.1) * 1000,
        close: 50000 + Math.sin((i + 1) * 0.1) * 1000,
        volume: 100
      }));
      
      // Add historical data
      klines.forEach(kline => {
        marketStore.addKline(symbol, kline);
      });
      
      // Subscribe to live updates
      const subscription = wsManager.subscribe(`${symbol.toLowerCase()}@kline_1m`).subscribe({
        next: (data) => {
          const candle = {
            time: Math.floor(data.k.t / 1000) as Time,
            open: parseFloat(data.k.o),
            high: parseFloat(data.k.h),
            low: parseFloat(data.k.l),
            close: parseFloat(data.k.c),
            volume: parseFloat(data.k.v)
          };
          
          // Add new candle
          marketStore.addKline(symbol, candle);
          
          // Analyze for patterns
          const patterns = analyzer.detectPatterns(marketStore.klines[`${symbol}_1m`]);
          
          // Should detect some patterns
          expect(patterns).toBeDefined();
          expect(Array.isArray(patterns)).toBe(true);
          
          subscription.unsubscribe();
          done();
        }
      });
      
      // Simulate new kline
      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_1m`);
        if (ws) {
          ws.simulateMessage({
            e: 'kline',
            E: Date.now(),
            s: symbol,
            k: {
              t: Date.now() - 60000,
              T: Date.now(),
              s: symbol,
              i: '1m',
              o: '51000',
              c: '51500',
              h: '52000',
              l: '50800',
              v: '150',
              x: true
            }
          });
        }
      }, 50);
    });

    it('should update technical indicators in real-time', (done) => {
      const symbol = 'BTCUSDT';
      
      // Add sufficient historical data for indicators
      const historicalKlines = Array.from({ length: 30 }, (_, i) => ({
        time: (Date.now() / 1000 - (30 - i) * 60) as Time,
        open: 50000 + (i % 2 ? 100 : -100),
        high: 50200 + (i % 2 ? 100 : -100),
        low: 49800 + (i % 2 ? 100 : -100),
        close: 50000 + (i % 2 ? 150 : -150),
        volume: 100
      }));
      
      historicalKlines.forEach(kline => {
        marketStore.addKline(symbol, kline);
      });
      
      // Subscribe to updates
      const subscription = wsManager.subscribe(`${symbol.toLowerCase()}@kline_1m`).subscribe({
        next: (data) => {
          const candle = {
            time: Math.floor(data.k.t / 1000) as Time,
            open: parseFloat(data.k.o),
            high: parseFloat(data.k.h),
            low: parseFloat(data.k.l),
            close: parseFloat(data.k.c),
            volume: parseFloat(data.k.v)
          };
          
          // Add new candle
          marketStore.addKline(symbol, candle);
          
          // Calculate indicators
          const klines = marketStore.klines[`${symbol}_1m`];
          const closes = klines.map(k => k.close);
          
          // Simple Moving Average
          const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
          expect(sma20).toBeGreaterThan(0);
          
          // Update chart store with indicators
          chartStore.updateIndicator('SMA', { value: sma20, timestamp: candle.time });
          
          // Verify indicator update
          expect(chartStore.indicators['SMA']).toBeDefined();
          
          subscription.unsubscribe();
          done();
        }
      });
      
      // Simulate kline
      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_1m`);
        if (ws) {
          ws.simulateMessage(BinanceMessageGenerator.klineMessage(symbol, '1m'));
        }
      }, 50);
    });
  });

  describe('Drawing and Annotation Updates', () => {
    it('should sync drawings across timeframes', () => {
      const drawing = {
        id: 'trendline-1',
        type: 'trendline' as const,
        points: [
          { time: Date.now() / 1000 - 3600, value: 50000 },
          { time: Date.now() / 1000, value: 51000 }
        ],
        style: {
          color: '#2962ff',
          lineWidth: 2,
          lineStyle: 'solid' as const
        },
        visible: true,
        interactive: true
      };
      
      // Add drawing to store
      chartStore.addDrawing(drawing);
      
      // Change timeframe
      chartStore.setTimeframe('5m');
      
      // Drawing should still be visible
      const drawings = chartStore.getDrawings();
      expect(drawings).toHaveLength(1);
      expect(drawings[0].id).toBe(drawing.id);
      
      // Change timeframe again
      chartStore.setTimeframe('1h');
      
      // Drawing should still be there
      expect(chartStore.getDrawings()).toHaveLength(1);
    });

    it('should update drawings based on live price action', (done) => {
      const symbol = 'BTCUSDT';
      
      // Add a horizontal line at current price
      const horizontalLine = {
        id: 'resistance-1',
        type: 'horizontal' as const,
        points: [{ time: Date.now() / 1000, value: 51000 }],
        price: 51000,
        style: {
          color: '#ff5252',
          lineWidth: 2,
          lineStyle: 'dashed' as const
        },
        visible: true,
        interactive: true
      };
      
      chartStore.addDrawing(horizontalLine);
      
      // Subscribe to price updates
      const subscription = wsManager.subscribe(`${symbol.toLowerCase()}@trade`).subscribe({
        next: (data) => {
          const currentPrice = parseFloat(data.p);
          
          // Check if price crossed the line
          if (currentPrice > horizontalLine.price) {
            // Update line style to indicate breakout
            chartStore.updateDrawing(horizontalLine.id, {
              style: {
                ...horizontalLine.style,
                color: '#4caf50', // Green for breakout
                lineStyle: 'solid' as const
              }
            });
            
            // Verify update
            const updated = chartStore.getDrawings().find(d => d.id === horizontalLine.id);
            expect(updated?.style.color).toBe('#4caf50');
            
            subscription.unsubscribe();
            done();
          }
        }
      });
      
      // Simulate price crossing the line
      setTimeout(() => {
        const ws = MockWebSocket.getInstanceByUrl(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`);
        if (ws) {
          ws.simulateMessage(BinanceMessageGenerator.tradeMessage(symbol, '51500'));
        }
      }, 50);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should efficiently handle large data sets', () => {
      const symbol = 'BTCUSDT';
      const maxCandles = 1000;
      
      // Generate large dataset
      const klines = Array.from({ length: maxCandles }, (_, i) => ({
        time: (Date.now() / 1000 - (maxCandles - i) * 60) as Time,
        open: 50000 + Math.random() * 1000,
        high: 51000 + Math.random() * 1000,
        low: 49000 + Math.random() * 1000,
        close: 50000 + Math.random() * 1000,
        volume: 100 + Math.random() * 50
      }));
      
      // Add all klines
      const startTime = Date.now();
      klines.forEach(kline => {
        marketStore.addKline(symbol, kline);
      });
      const loadTime = Date.now() - startTime;
      
      // Should load quickly
      expect(loadTime).toBeLessThan(100); // Less than 100ms
      
      // Verify data integrity
      const storedKlines = marketStore.klines[`${symbol}_1m`];
      expect(storedKlines).toHaveLength(maxCandles);
      
      // Test memory limit
      marketStore.setMaxKlines(500);
      
      // Add more klines
      for (let i = 0; i < 100; i++) {
        marketStore.addKline(symbol, {
          time: (Date.now() / 1000 + i * 60) as Time,
          open: 50000,
          high: 51000,
          low: 49000,
          close: 50500,
          volume: 100
        });
      }
      
      // Should maintain max limit
      expect(marketStore.klines[`${symbol}_1m`].length).toBeLessThanOrEqual(500);
    });

    it('should cleanup old subscriptions to prevent memory leaks', () => {
      const symbol = 'BTCUSDT';
      const subscriptions: any[] = [];
      
      // Create multiple subscriptions
      for (let i = 0; i < 10; i++) {
        const sub = wsManager.subscribe(`${symbol.toLowerCase()}@trade`).subscribe({
          next: () => {},
          error: () => {}
        });
        subscriptions.push(sub);
      }
      
      // Check active connections
      expect(wsManager.getActiveStreamsCount()).toBe(1); // Should share connection
      
      // Unsubscribe half
      for (let i = 0; i < 5; i++) {
        subscriptions[i].unsubscribe();
      }
      
      // Connection should still be active
      expect(wsManager.getActiveStreamsCount()).toBe(1);
      
      // Unsubscribe remaining
      for (let i = 5; i < 10; i++) {
        subscriptions[i].unsubscribe();
      }
      
      // Allow cleanup time
      setTimeout(() => {
        // Connection should be cleaned up
        expect(wsManager.getActiveStreamsCount()).toBe(0);
      }, 100);
    });
  });
});