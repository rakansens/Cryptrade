/**
 * Test data generator for creating realistic test data
 */

import { faker } from '@faker-js/faker';
import { CandlestickData, Time } from 'lightweight-charts';

export class TestDataGenerator {
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed || Date.now();
    faker.seed(this.seed);
  }

  // User generation
  generateUser(overrides: any = {}) {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      avatar: faker.image.avatar(),
      role: faker.helpers.arrayElement(['user', 'admin', 'premium']),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      emailVerified: faker.datatype.boolean(),
      settings: {
        theme: faker.helpers.arrayElement(['light', 'dark']),
        notifications: faker.datatype.boolean(),
        tradingEnabled: faker.datatype.boolean(),
        defaultPair: faker.helpers.arrayElement(['BTCUSDT', 'ETHUSDT', 'BNBUSDT']),
        defaultTimeframe: faker.helpers.arrayElement(['1m', '5m', '15m', '1h', '4h', '1d']),
        riskLevel: faker.helpers.arrayElement(['low', 'medium', 'high'])
      },
      ...overrides
    };
  }

  generateUsers(count: number, overrides: any = {}) {
    return Array(count).fill(null).map(() => this.generateUser(overrides));
  }

  // Order generation
  generateOrder(userId: string, overrides: any = {}) {
    const side = faker.helpers.arrayElement(['BUY', 'SELL']);
    const type = faker.helpers.arrayElement(['MARKET', 'LIMIT', 'STOP_LOSS', 'TAKE_PROFIT']);
    const status = faker.helpers.arrayElement(['NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED', 'EXPIRED']);
    const symbol = faker.helpers.arrayElement(['BTCUSDT', 'ETHUSDT', 'BNBUSDT']);
    const basePrice = symbol === 'BTCUSDT' ? 48000 : symbol === 'ETHUSDT' ? 3200 : 300;
    
    return {
      orderId: faker.string.alphanumeric(16),
      userId,
      clientOrderId: `web_${faker.string.alphanumeric(12)}`,
      symbol,
      side,
      type,
      status,
      price: (basePrice + faker.number.float({ min: -1000, max: 1000 })).toFixed(2),
      quantity: faker.number.float({ min: 0.001, max: 10, precision: 0.00000001 }).toFixed(8),
      executedQuantity: status === 'FILLED' ? this.quantity : 
                        status === 'PARTIALLY_FILLED' ? (this.quantity * faker.number.float({ min: 0.1, max: 0.9 })).toFixed(8) : 
                        '0.00000000',
      timeInForce: type === 'MARKET' ? 'IOC' : faker.helpers.arrayElement(['GTC', 'IOC', 'FOK']),
      createdAt: faker.date.recent(),
      updatedAt: faker.date.recent(),
      ...overrides
    };
  }

  generateOrderHistory(userId: string, count: number) {
    return Array(count).fill(null).map(() => this.generateOrder(userId));
  }

  // Trade generation
  generateTrade(symbol: string = 'BTCUSDT', overrides: any = {}) {
    const basePrice = symbol === 'BTCUSDT' ? 48000 : symbol === 'ETHUSDT' ? 3200 : 300;
    
    return {
      id: faker.number.int({ min: 1000000, max: 9999999 }),
      symbol,
      price: (basePrice + faker.number.float({ min: -100, max: 100 })).toFixed(2),
      quantity: faker.number.float({ min: 0.001, max: 5, precision: 0.00000001 }).toFixed(8),
      time: faker.date.recent().getTime(),
      isBuyerMaker: faker.datatype.boolean(),
      isBestMatch: faker.datatype.boolean(),
      ...overrides
    };
  }

  generateTrades(symbol: string, count: number, timeRange?: { start: number, end: number }) {
    const trades = [];
    const startTime = timeRange?.start || Date.now() - 3600000;
    const endTime = timeRange?.end || Date.now();
    const timeStep = (endTime - startTime) / count;
    
    for (let i = 0; i < count; i++) {
      trades.push(this.generateTrade(symbol, {
        time: startTime + i * timeStep + faker.number.int({ min: 0, max: timeStep })
      }));
    }
    
    return trades.sort((a, b) => a.time - b.time);
  }

  // Market data generation
  generateKline(symbol: string = 'BTCUSDT', interval: string = '1h', overrides: any = {}) {
    const basePrice = symbol === 'BTCUSDT' ? 48000 : symbol === 'ETHUSDT' ? 3200 : 300;
    const volatility = faker.number.float({ min: 0.001, max: 0.02 });
    
    const open = basePrice + faker.number.float({ min: -500, max: 500 });
    const change = open * volatility * (faker.datatype.boolean() ? 1 : -1);
    const high = Math.max(open, open + change) + faker.number.float({ min: 0, max: Math.abs(change) * 0.5 });
    const low = Math.min(open, open + change) - faker.number.float({ min: 0, max: Math.abs(change) * 0.5 });
    const close = open + change + faker.number.float({ min: -Math.abs(change) * 0.3, max: Math.abs(change) * 0.3 });
    
    return {
      openTime: faker.date.recent().getTime(),
      open: open.toFixed(2),
      high: high.toFixed(2),
      low: low.toFixed(2),
      close: close.toFixed(2),
      volume: faker.number.float({ min: 100, max: 10000, precision: 0.00000001 }).toFixed(8),
      closeTime: faker.date.recent().getTime(),
      quoteVolume: (parseFloat(this.volume) * ((high + low) / 2)).toFixed(8),
      trades: faker.number.int({ min: 100, max: 5000 }),
      interval,
      ...overrides
    };
  }

  generateKlineData(symbol: string, interval: string, count: number, trend?: 'bullish' | 'bearish' | 'sideways'): CandlestickData[] {
    const data: CandlestickData[] = [];
    const intervalMs = this.getIntervalMs(interval);
    let currentTime = Date.now() - count * intervalMs;
    let currentPrice = symbol === 'BTCUSDT' ? 48000 : symbol === 'ETHUSDT' ? 3200 : 300;
    
    for (let i = 0; i < count; i++) {
      const trendBias = trend === 'bullish' ? 0.0002 : trend === 'bearish' ? -0.0002 : 0;
      const volatility = faker.number.float({ min: 0.001, max: 0.015 });
      
      const open = currentPrice;
      const change = open * volatility * (faker.datatype.boolean() ? 1 : -1) + open * trendBias;
      const high = Math.max(open, open + change) * (1 + faker.number.float({ min: 0, max: 0.005 }));
      const low = Math.min(open, open + change) * (1 - faker.number.float({ min: 0, max: 0.005 }));
      const close = open + change;
      
      data.push({
        time: (currentTime / 1000) as Time,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2))
      });
      
      currentPrice = close;
      currentTime += intervalMs;
    }
    
    return data;
  }

  // WebSocket message generation
  generateWebSocketMessage(type: string, overrides: any = {}) {
    const baseMessages = {
      kline: {
        e: 'kline',
        E: Date.now(),
        s: 'BTCUSDT',
        k: this.generateKline('BTCUSDT', '1h')
      },
      trade: {
        e: 'trade',
        E: Date.now(),
        s: 'BTCUSDT',
        ...this.generateTrade('BTCUSDT')
      },
      depth: {
        e: 'depthUpdate',
        E: Date.now(),
        s: 'BTCUSDT',
        U: faker.number.int({ min: 1000000, max: 9999999 }),
        u: faker.number.int({ min: 1000000, max: 9999999 }),
        b: this.generateOrderBookSide('bid', 10),
        a: this.generateOrderBookSide('ask', 10)
      },
      ticker: {
        e: '24hrTicker',
        E: Date.now(),
        s: 'BTCUSDT',
        p: faker.number.float({ min: -1000, max: 1000 }).toFixed(2),
        P: faker.number.float({ min: -5, max: 5 }).toFixed(2),
        c: '48000.00',
        o: '47500.00',
        h: '49000.00',
        l: '47000.00',
        v: faker.number.float({ min: 1000, max: 50000 }).toFixed(8),
        q: faker.number.float({ min: 48000000, max: 2400000000 }).toFixed(8)
      }
    };
    
    return { ...baseMessages[type], ...overrides };
  }

  generateOrderBookSide(side: 'bid' | 'ask', levels: number) {
    const basePrice = 48000;
    const spread = 0.1;
    const orders = [];
    
    for (let i = 0; i < levels; i++) {
      const priceOffset = (i + 1) * spread;
      const price = side === 'bid' ? basePrice - priceOffset : basePrice + priceOffset;
      const quantity = faker.number.float({ min: 0.1, max: 10, precision: 0.00000001 });
      
      orders.push([
        price.toFixed(2),
        quantity.toFixed(8)
      ]);
    }
    
    return orders;
  }

  // Notification generation
  generateNotification(userId: string, overrides: any = {}) {
    const types = ['price_alert', 'order_filled', 'order_canceled', 'system_update', 'risk_warning'];
    const type = faker.helpers.arrayElement(types);
    
    const templates = {
      price_alert: {
        title: 'Price Alert',
        message: `${faker.helpers.arrayElement(['BTC', 'ETH', 'BNB'])} reached your target price of $${faker.number.int({ min: 1000, max: 50000 })}`
      },
      order_filled: {
        title: 'Order Filled',
        message: `Your ${faker.helpers.arrayElement(['buy', 'sell'])} order for ${faker.number.float({ min: 0.01, max: 1 }).toFixed(2)} BTC has been filled`
      },
      order_canceled: {
        title: 'Order Canceled',
        message: `Your limit order #${faker.string.alphanumeric(8)} has been canceled`
      },
      system_update: {
        title: 'System Update',
        message: faker.helpers.arrayElement([
          'Scheduled maintenance in 1 hour',
          'New features available',
          'Security update completed'
        ])
      },
      risk_warning: {
        title: 'Risk Warning',
        message: faker.helpers.arrayElement([
          'High volatility detected in the market',
          'Your margin ratio is below safe levels',
          'Unusual trading activity detected'
        ])
      }
    };
    
    return {
      id: faker.string.uuid(),
      userId,
      type,
      ...templates[type],
      severity: faker.helpers.arrayElement(['info', 'warning', 'error', 'success']),
      read: faker.datatype.boolean(),
      createdAt: faker.date.recent(),
      ...overrides
    };
  }

  generateNotifications(userId: string, count: number) {
    return Array(count).fill(null).map(() => this.generateNotification(userId));
  }

  // Helper methods
  private getIntervalMs(interval: string): number {
    const map: Record<string, number> = {
      '1m': 60000,
      '3m': 180000,
      '5m': 300000,
      '15m': 900000,
      '30m': 1800000,
      '1h': 3600000,
      '2h': 7200000,
      '4h': 14400000,
      '6h': 21600000,
      '8h': 28800000,
      '12h': 43200000,
      '1d': 86400000,
      '3d': 259200000,
      '1w': 604800000,
      '1M': 2592000000
    };
    return map[interval] || 3600000;
  }

  // Scenario generators
  generateTradingScenario(type: 'success' | 'failure' | 'partial') {
    const userId = faker.string.uuid();
    const orderId = faker.string.alphanumeric(16);
    
    const scenarios = {
      success: {
        order: this.generateOrder(userId, { orderId, status: 'FILLED' }),
        trades: this.generateTrades('BTCUSDT', 5),
        notifications: [
          this.generateNotification(userId, { type: 'order_filled' })
        ]
      },
      failure: {
        order: this.generateOrder(userId, { orderId, status: 'REJECTED' }),
        trades: [],
        notifications: [
          this.generateNotification(userId, { 
            type: 'system_update', 
            title: 'Order Rejected',
            message: 'Insufficient balance'
          })
        ]
      },
      partial: {
        order: this.generateOrder(userId, { orderId, status: 'PARTIALLY_FILLED' }),
        trades: this.generateTrades('BTCUSDT', 2),
        notifications: []
      }
    };
    
    return scenarios[type];
  }

  generateMarketScenario(type: 'volatile' | 'stable' | 'trending') {
    const scenarios = {
      volatile: {
        klines: this.generateKlineData('BTCUSDT', '5m', 100),
        trades: this.generateTrades('BTCUSDT', 1000),
        orderBook: {
          bids: this.generateOrderBookSide('bid', 20),
          asks: this.generateOrderBookSide('ask', 20)
        },
        description: 'High volatility market conditions'
      },
      stable: {
        klines: this.generateKlineData('BTCUSDT', '1h', 24, 'sideways'),
        trades: this.generateTrades('BTCUSDT', 100),
        orderBook: {
          bids: this.generateOrderBookSide('bid', 10),
          asks: this.generateOrderBookSide('ask', 10)
        },
        description: 'Stable market with low volatility'
      },
      trending: {
        klines: this.generateKlineData('BTCUSDT', '4h', 50, 'bullish'),
        trades: this.generateTrades('BTCUSDT', 500),
        orderBook: {
          bids: this.generateOrderBookSide('bid', 15),
          asks: this.generateOrderBookSide('ask', 15)
        },
        description: 'Strong upward trend'
      }
    };
    
    return scenarios[type];
  }
}

// Export singleton instance with fixed seed for consistent tests
export const testDataGenerator = new TestDataGenerator(12345);

// Export class for custom instances
export default TestDataGenerator;