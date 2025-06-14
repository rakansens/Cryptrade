import { ProposalGenerationTool } from '../proposal-generation';
import { binanceAPI } from '@/lib/binance/api-service';
import { logger } from '@/lib/utils/logger';
import type { PriceData } from '@/types/market';

// Mock dependencies
jest.mock('@/lib/binance/api-service');
jest.mock('@/lib/utils/logger');

const mockBinanceAPI = binanceAPI as jest.Mocked<typeof binanceAPI>;
const mockLogger = logger as jest.Mocked<typeof logger>;

// Mock data
const mockMarketData: PriceData[] = Array.from({ length: 100 }, (_, i) => ({
  time: 1700000000 + i * 60,
  open: 50000 + Math.random() * 1000,
  high: 50500 + Math.random() * 1000,
  low: 49500 + Math.random() * 1000,
  close: 50000 + Math.random() * 1000,
  volume: 100 + Math.random() * 50,
}));

describe('ProposalGenerationTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger.info.mockImplementation(() => {});
    mockLogger.error.mockImplementation(() => {});
  });

  describe('execute', () => {
    it('should generate proposals successfully with all analysis types', async () => {
      mockBinanceAPI.fetchKlines.mockResolvedValue(mockMarketData);

      const result = await ProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'all',
          maxProposals: 5,
        },
      });

      expect(result.success).toBe(true);
      expect(result.proposalGroup).toBeDefined();
      expect(result.proposalGroup?.proposals).toHaveLength(5);
      expect(mockBinanceAPI.fetchKlines).toHaveBeenCalledWith('BTCUSDT', '1h', 500);
    });

    it('should generate trendline proposals only', async () => {
      mockBinanceAPI.fetchKlines.mockResolvedValue(mockMarketData);

      const result = await ProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '15m',
          analysisType: 'trendline',
          maxProposals: 3,
        },
      });

      expect(result.success).toBe(true);
      expect(result.proposalGroup).toBeDefined();
      
      // All proposals should be trendline type
      result.proposalGroup?.proposals.forEach(proposal => {
        expect(['trend_line', 'ray']).toContain(proposal.type);
      });
    });

    it('should generate support-resistance proposals only', async () => {
      mockBinanceAPI.fetchKlines.mockResolvedValue(mockMarketData);

      const result = await ProposalGenerationTool.execute({
        context: {
          symbol: 'ETHUSDT',
          interval: '5m',
          analysisType: 'support-resistance',
          maxProposals: 4,
        },
      });

      expect(result.success).toBe(true);
      expect(result.proposalGroup).toBeDefined();
      
      // All proposals should be horizontal line type
      result.proposalGroup?.proposals.forEach(proposal => {
        expect(proposal.type).toBe('horizontal_line');
      });
    });

    it('should generate fibonacci proposals only', async () => {
      mockBinanceAPI.fetchKlines.mockResolvedValue(mockMarketData);

      const result = await ProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'fibonacci',
          maxProposals: 2,
        },
      });

      expect(result.success).toBe(true);
      expect(result.proposalGroup).toBeDefined();
      
      // All proposals should be fibonacci type
      result.proposalGroup?.proposals.forEach(proposal => {
        expect(proposal.type).toBe('fibonacci_retracement');
      });
    });

    it('should generate pattern proposals only', async () => {
      mockBinanceAPI.fetchKlines.mockResolvedValue(mockMarketData);

      const result = await ProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '30m',
          analysisType: 'pattern',
          maxProposals: 3,
        },
      });

      expect(result.success).toBe(true);
      expect(result.proposalGroup).toBeDefined();
    });

    it('should handle sinceTimestamp parameter', async () => {
      const sinceTimestamp = Math.floor(Date.now() / 1000) - 86400; // 1 day ago
      mockBinanceAPI.fetchKlines.mockResolvedValue(mockMarketData);

      const result = await ProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'all',
          sinceTimestamp,
        },
      });

      expect(result.success).toBe(true);
      expect(mockBinanceAPI.fetchKlines).toHaveBeenCalledWith(
        'BTCUSDT',
        '1h',
        1000,
        sinceTimestamp,
        expect.any(Number)
      );
    });

    it('should exclude specified proposal IDs', async () => {
      mockBinanceAPI.fetchKlines.mockResolvedValue(mockMarketData);

      const excludeIds = ['proposal1', 'proposal2'];
      const result = await ProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'all',
          excludeIds,
        },
      });

      expect(result.success).toBe(true);
      
      // Check that no excluded IDs are in the results
      result.proposalGroup?.proposals.forEach(proposal => {
        expect(excludeIds).not.toContain(proposal.id);
      });
    });

    it('should sort proposals by confidence', async () => {
      mockBinanceAPI.fetchKlines.mockResolvedValue(mockMarketData);

      const result = await ProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'all',
          maxProposals: 10,
        },
      });

      expect(result.success).toBe(true);
      
      // Check that proposals are sorted by confidence (descending)
      const proposals = result.proposalGroup?.proposals || [];
      for (let i = 1; i < proposals.length; i++) {
        expect(proposals[i - 1].confidence).toBeGreaterThanOrEqual(proposals[i].confidence);
      }
    });

    it('should handle API errors gracefully', async () => {
      mockBinanceAPI.fetchKlines.mockRejectedValue(new Error('API Error'));

      const result = await ProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'all',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unable to fetch market data. Please try again later.');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle insufficient data', async () => {
      mockBinanceAPI.fetchKlines.mockResolvedValue([]);

      const result = await ProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'all',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unable to fetch market data. Please try again later.');
    });

    it('should handle generator errors', async () => {
      mockBinanceAPI.fetchKlines.mockResolvedValue(mockMarketData);
      
      // Simulate error in one of the generators by providing bad data
      const badData = mockMarketData.map(d => ({ ...d, close: NaN }));
      mockBinanceAPI.fetchKlines.mockResolvedValue(badData);

      const result = await ProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'all',
        },
      });

      // Should still succeed but with potentially fewer proposals
      expect(result.success).toBe(true);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should include proper metadata in proposals', async () => {
      mockBinanceAPI.fetchKlines.mockResolvedValue(mockMarketData);

      const result = await ProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'all',
          maxProposals: 1,
        },
      });

      expect(result.success).toBe(true);
      const proposal = result.proposalGroup?.proposals[0];
      
      expect(proposal).toMatchObject({
        id: expect.stringMatching(/^[a-zA-Z0-9_]+$/),
        type: expect.any(String),
        confidence: expect.any(Number),
        description: expect.any(String),
        symbol: 'BTCUSDT',
        interval: '1h',
        reasoning: expect.any(String),
        createdAt: expect.any(Number),
        title: expect.any(String),
        reason: expect.any(String),
        priority: expect.stringMatching(/^(high|medium|low)$/),
      });
    });

    it('should generate proper group metadata', async () => {
      mockBinanceAPI.fetchKlines.mockResolvedValue(mockMarketData);

      const result = await ProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'trendline',
        },
      });

      expect(result.success).toBe(true);
      expect(result.proposalGroup).toMatchObject({
        id: expect.stringMatching(/^pg_\d+_[a-z0-9]+$/),
        title: 'BTCUSDT トレンドライン分析',
        description: expect.stringContaining('1hチャートの分析により'),
        status: 'pending',
        createdAt: expect.any(Number),
      });
    });
  });

  describe('multi-timeframe analysis', () => {
    it('should perform multi-timeframe analysis when available', async () => {
      mockBinanceAPI.fetchKlines.mockResolvedValue(mockMarketData);

      const result = await ProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '15m',
          analysisType: 'all',
        },
      });

      expect(result.success).toBe(true);
      
      // Should call fetchKlines multiple times for different timeframes
      expect(mockBinanceAPI.fetchKlines).toHaveBeenCalledTimes(2); // Main + higher timeframe
    });
  });

  describe('validation', () => {
    it('should validate input parameters', async () => {
      const invalidInputs = [
        { symbol: '', interval: '1h', analysisType: 'all' },
        { symbol: 'BTCUSDT', interval: '', analysisType: 'all' },
        { symbol: 'BTCUSDT', interval: '1h', analysisType: 'invalid' as any },
      ];

      for (const input of invalidInputs) {
        await expect(
          ProposalGenerationTool.execute({ context: input })
        ).rejects.toThrow();
      }
    });

    it('should handle maxProposals constraint', async () => {
      mockBinanceAPI.fetchKlines.mockResolvedValue(mockMarketData);

      const maxProposals = 2;
      const result = await ProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'all',
          maxProposals,
        },
      });

      expect(result.success).toBe(true);
      expect(result.proposalGroup?.proposals.length).toBeLessThanOrEqual(maxProposals);
    });
  });
});