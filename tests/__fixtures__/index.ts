/**
 * Central fixture export file
 */

// AI fixtures
export * from './ai/proposal-responses';

// Auth fixtures
export * from './auth/user-states';

// API fixtures
export * from './api/responses';

// Binance fixtures
export * from './binance/websocket-responses';

// Chart fixtures
export * from './chart/candlestick-data';
export * from './chart/pattern-data';

// Database fixtures
export * from './database/mock-data';

// Indicator fixtures
export * from './indicators/indicator-data';

// Market fixtures
export * from './market/market-data';
export * from './market/edge-cases';

// WebSocket fixtures
export * from './websocket/messages';

// Helper utilities for fixtures
export { FixtureGenerator } from '../utils/fixture-generator';

// Utility function to get random fixture
export const getRandomFixture = <T>(fixtures: T[]): T => {
  return fixtures[Math.floor(Math.random() * fixtures.length)] as T;
};

/**
 * Fixture presets for common test scenarios
 */
export const fixturePresets = {
  // Standard trading session
  standardSession: {
    user: () => import('./auth/user-states').then(m => m.mockUsers.authenticated),
    session: () => import('./auth/user-states').then(m => m.mockSessions.valid),
    marketData: () => import('./market/market-data').then(m => m.mockMarketData),
    wsConnection: () => import('./websocket/messages').then(m => m.mockSystemMessages.streamStatus)
  },
  
  // Error scenarios
  errorScenarios: {
    authError: () => import('./auth/user-states').then(m => m.mockAuthErrors),
    apiErrors: () => import('./api/responses').then(m => m.mockErrorResponses),
    wsErrors: () => import('./websocket/messages').then(m => m.mockErrorMessages)
  },
  
  // Edge cases
  edgeCases: {
    market: () => import('./market/edge-cases').then(m => m.mockExtremeMarketData),
    orderBook: () => import('./market/edge-cases').then(m => m.mockEdgeCaseOrderBook),
    trades: () => import('./market/edge-cases').then(m => m.mockEdgeCaseTrades),
    time: () => import('./market/edge-cases').then(m => m.mockTimeEdgeCases)
  }
};

/**
 * Fixture builders for dynamic test data
 */
export const fixtureBuilders = {
  // Build custom user with overrides
  buildUser: (overrides: any = {}) => {
    const baseUser = require('./auth/user-states').mockUsers.authenticated;
    return { ...baseUser, ...overrides };
  },
  
  // Build API response with custom data
  buildApiResponse: (success: boolean, data: any, error?: any) => {
    return {
      success,
      data: success ? data : null,
      error: success ? null : error,
      timestamp: Date.now()
    };
  },
  
  // Build WebSocket message sequence
  buildMessageSequence: (messages: any[], delays: number[] = []) => {
    return messages.map((msg, i) => ({
      ...msg,
      timestamp: Date.now() + (delays[i] || i * 1000)
    }));
  },
  
  // Build market scenario
  buildMarketScenario: (type: 'bull' | 'bear' | 'sideways', duration: number) => {
    const { FixtureGenerator } = require('../utils/fixture-generator');
    return FixtureGenerator.generateRealisticCandlestickData({
      trend: type === 'bull' ? 'bullish' : type === 'bear' ? 'bearish' : 'sideways',
      count: duration,
      volatility: 'medium'
    });
  }
};

/**
 * Test data factories
 */
export const factories = {
  // Create multiple users
  createUsers: (count: number) => {
    return Array(count).fill(null).map((_, i) => ({
      id: `user-${i}`,
      email: `user${i}@example.com`,
      name: `Test User ${i}`,
      role: i === 0 ? 'admin' : 'user',
      createdAt: new Date(Date.now() - i * 86400000),
      emailVerified: i % 2 === 0
    }));
  },
  
  // Create order history
  createOrderHistory: (userId: string, count: number) => {
    return Array(count).fill(null).map((_, i) => ({
      orderId: `order-${userId}-${i}`,
      userId,
      symbol: i % 2 === 0 ? 'BTCUSDT' : 'ETHUSDT',
      side: i % 2 === 0 ? 'BUY' : 'SELL',
      type: i % 3 === 0 ? 'MARKET' : 'LIMIT',
      price: (48000 + Math.random() * 2000).toFixed(2),
      quantity: (Math.random() * 2).toFixed(8),
      status: ['FILLED', 'CANCELED', 'PARTIALLY_FILLED'][i % 3],
      createdAt: new Date(Date.now() - i * 3600000)
    }));
  },
  
  // Create notification batch
  createNotifications: (userId: string, types: string[], count: number) => {
    return Array(count).fill(null).map((_, i) => ({
      id: `notif-${userId}-${i}`,
      userId,
      type: types[i % types.length],
      title: `Notification ${i + 1}`,
      message: `This is notification message ${i + 1}`,
      read: i < count / 2,
      createdAt: new Date(Date.now() - i * 600000)
    }));
  }
};

// Fixture categories for easy access (backward compatibility)
export const fixtures = {
  binance: () => import('./binance/websocket-responses'),
  chart: {
    candlestick: () => import('./chart/candlestick-data'),
    pattern: () => import('./chart/pattern-data')
  },
  ai: () => import('./ai/proposal-responses'),
  indicators: () => import('./indicators/indicator-data'),
  market: () => import('./market/market-data'),
  database: () => import('./database/mock-data'),
  auth: () => import('./auth/user-states'),
  api: () => import('./api/responses'),
  websocket: () => import('./websocket/messages'),
  edgeCases: () => import('./market/edge-cases')
};