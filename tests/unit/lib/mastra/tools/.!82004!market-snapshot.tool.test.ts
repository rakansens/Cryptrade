// Mock dependencies before imports
jest.mock('@/lib/utils/logger');
jest.mock('@/config/env', () => ({
  env: {
    NODE_ENV: 'test',
  },
}));

// Mock the dynamic import of market-data-resilient.tool
const mockMarketDataExecute = jest.fn();
jest.mock('./market-data-resilient.tool', () => ({
  marketDataResilientTool: {
    execute: mockMarketDataExecute,
  },
}), { virtual: true });

import { marketSnapshotTool, trendingTopicsTool } from '@/lib/mastra/tools/market-snapshot.tool';
import { logger } from '@/lib/utils/logger';
import { env } from '@/config/env';

// Type cast the execute functions to avoid TypeScript errors
const executeMarketSnapshot = marketSnapshotTool.execute as any;
const executeTrendingTopics = trendingTopicsTool.execute as any;

describe('marketSnapshotTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset env for each test
    (env as any).NODE_ENV = 'test';
  });

  describe('tool configuration', () => {
    it('should have correct metadata', () => {
      expect(marketSnapshotTool.id).toBe('market-snapshot');
      expect(marketSnapshotTool.description).toBe('Get a quick market overview for casual conversation');
      expect(marketSnapshotTool.inputSchema).toBeDefined();
      expect(marketSnapshotTool.outputSchema).toBeDefined();
    });
  });

  describe('execute - successful market data retrieval', () => {
    beforeEach(() => {
      // Setup mock responses for different symbols
      mockMarketDataExecute.mockImplementation(({ context }) => {
        const symbol = context.symbol;
        const mockData: Record<string, any> = {
          BTCUSDT: { currentPrice: 50000, priceChangePercent24h: 5.2 },
          ETHUSDT: { currentPrice: 3000, priceChangePercent24h: -2.1 },
          SOLUSDT: { currentPrice: 100, priceChangePercent24h: 15.5 },
          AVAXUSDT: { currentPrice: 35, priceChangePercent24h: -8.3 },
          MATICUSDT: { currentPrice: 1.2, priceChangePercent24h: 3.7 },
          XRPUSDT: { currentPrice: 0.5, priceChangePercent24h: -0.5 },
          ADAUSDT: { currentPrice: 0.4, priceChangePercent24h: 1.2 },
          DOTUSDT: { currentPrice: 8, priceChangePercent24h: -4.6 },
        };
        return Promise.resolve(mockData[symbol] || { currentPrice: 0, priceChangePercent24h: 0 });
      });
    });

    it('should fetch market snapshot with general focus', async () => {
      const result = await executeMarketSnapshot({
        context: {
          focus: 'general',
          limit: 3,
        },
      });

      expect(mockMarketDataExecute).toHaveBeenCalledTimes(8); // For all symbols
      expect(result).toMatchObject({
        marketMood: expect.any(String),
        topGainers: expect.any(Array),
        topLosers: expect.any(Array),
        marketHighlight: expect.any(String),
        totalMarketCap: expect.any(Number),
        btcDominance: expect.any(Number),
      });

      // Check top gainers are sorted correctly
      expect(result.topGainers).toHaveLength(3);
      expect(result.topGainers[0]).toMatchObject({
        symbol: 'SOL',
        price: 100,
        change24h: 15.5,
      });

      // Check top losers are sorted correctly
      expect(result.topLosers).toHaveLength(3);
      expect(result.topLosers[0]).toMatchObject({
        symbol: 'AVAX',
        price: 35,
        change24h: -8.3,
      });

      expect(logger.info).toHaveBeenCalledWith(
        '[MarketSnapshot] Fetching market overview',
        { focus: 'general', limit: 3 }
      );
    });

    it('should determine bullish market mood', async () => {
      // Mock all positive changes
      mockMarketDataExecute.mockResolvedValue({
        currentPrice: 100,
        priceChangePercent24h: 5.0,
      });

      const result = await executeMarketSnapshot({
        context: {
          focus: 'general',
          limit: 2,
        },
      });

      expect(result.marketMood).toBe('bullish');
      expect(result.marketHighlight).toContain('Strong support level');
