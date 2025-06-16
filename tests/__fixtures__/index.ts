/**
 * テストフィクスチャのエクスポート集約
 */

// Binance WebSocket responses
export * from './binance/websocket-responses';

// Chart data
export * from './chart/candlestick-data';
export * from './chart/pattern-data';

// AI responses
export * from './ai/proposal-responses';

// Indicators
export * from './indicators/indicator-data';

// Market data
export * from './market/market-data';

// Database
export * from './database/mock-data';

// Utility function to get random fixture
export const getRandomFixture = <T>(fixtures: T[]): T => {
  return fixtures[Math.floor(Math.random() * fixtures.length)];
};

// Fixture categories for easy access
export const fixtures = {
  binance: () => import('./binance/websocket-responses'),
  chart: {
    candlestick: () => import('./chart/candlestick-data'),
    pattern: () => import('./chart/pattern-data')
  },
  ai: () => import('./ai/proposal-responses'),
  indicators: () => import('./indicators/indicator-data'),
  market: () => import('./market/market-data'),
  database: () => import('./database/mock-data')
};