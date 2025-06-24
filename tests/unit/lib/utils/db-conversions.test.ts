import {
  convertDbAnalysisRecord,
  serializeBigInt,
  serializeDecimal,
  prepareChartDrawingData,
  preparePatternAnalysisData,
  type DbAnalysisRecord,
  type DbTouchEvent,
} from '@/lib/utils/db-conversions';
import type { AnalysisRecord } from '@/types/analysis-history';

describe('db-conversions utilities', () => {
  describe('convertDbAnalysisRecord', () => {
    const createMockDbRecord = (overrides?: Partial<DbAnalysisRecord>): DbAnalysisRecord => ({
      id: 'test-id',
      proposalId: 'proposal-123',
      sessionId: 'session-456',
      symbol: 'BTCUSDT',
      interval: '1h',
      type: 'support',
      timestamp: BigInt(1609459200000),
      proposalData: {
        price: 50000,
        confidence: 0.85,
        drawingData: {
          type: 'support',
          points: [[100, 50000], [200, 50000]],
        },
      },
      trackingData: {
        status: 'active',
        startTime: 1609459200000,
        touches: [],
      },
      performanceData: {
        accuracy: 0.75,
        profitLoss: 1000,
        holdDuration: 3600,
      },
      synced: true,
      createdAt: new Date(Date.now() - 86400000) // 2021-01-01'),
      updatedAt: new Date(Date.now() - 86400000) // 2021-01-01'),
      touchEvents: [],
      ...overrides,
    });

    it('should convert basic db record to client format', () => {
      const dbRecord = createMockDbRecord();
      const result = convertDbAnalysisRecord(dbRecord);

      expect(result).toMatchObject({
        id: 'test-id',
        proposalId: 'proposal-123',
        sessionId: 'session-456',
        symbol: 'BTCUSDT',
        interval: '1h',
        type: 'support',
        timestamp: 1609459200000,
      });
    });

    it('should extract price from proposalData.price', () => {
      const dbRecord = createMockDbRecord({
        proposalData: { price: 60000 },
      });
      
      const result = convertDbAnalysisRecord(dbRecord);
      expect(result.proposal.price).toBe(60000);
    });

    it('should extract price from proposalData.levels', () => {
      const dbRecord = createMockDbRecord({
        proposalData: {
          levels: [55000, 56000, 57000],
        },
      });
      
      const result = convertDbAnalysisRecord(dbRecord);
      expect(result.proposal.price).toBe(55000);
    });

    it('should extract price from proposalData.startPrice', () => {
      const dbRecord = createMockDbRecord({
        proposalData: {
          startPrice: 48000,
        },
      });
      
      const result = convertDbAnalysisRecord(dbRecord);
      expect(result.proposal.price).toBe(48000);
    });

    it('should handle null proposalData', () => {
      const dbRecord = createMockDbRecord({
        proposalData: null,
      });
      
      const result = convertDbAnalysisRecord(dbRecord);
      expect(result.proposal.price).toBe(0);
      expect(result.proposal.confidence).toBe(0.5);
    });

    it('should convert touch events', () => {
      const touchEvents: DbTouchEvent[] = [
        {
          id: 'touch-1',
          timestamp: BigInt(1609459300000),
          price: { toString: () => '50100' },
          result: 'bounce',
          volume: { toString: () => '1000' },
          strength: { toString: () => '0.8' },
        },
        {
          id: 'touch-2',
          timestamp: BigInt(1609459400000),
          price: { toString: () => '50200' },
          result: 'breakout',
          volume: null,
          strength: { toString: () => '0.9' },
        },
      ];
      
      const dbRecord = createMockDbRecord({ touchEvents });
      const result = convertDbAnalysisRecord(dbRecord);
      
      expect(result.tracking.touches).toHaveLength(2);
      expect(result.tracking.touches[0]).toEqual({
        time: 1609459300000,
        price: 50100,
        result: 'bounce',
        volume: 1000,
        strength: 0.8,
      });
      expect(result.tracking.touches[1]).toEqual({
        time: 1609459400000,
        price: 50200,
        result: 'break', // 'breakout' is converted to 'break'
        volume: undefined,
        strength: 0.9,
      });
    });

    it('should extract sentiment data', () => {
      const dbRecord = createMockDbRecord({
        proposalData: {
          sentiment: {
            overall: 'bullish',
            score: 0.75,
            indicators: {
              rsi: 65,
              macd: 'bullish',
            },
          },
        },
      });
      
      const result = convertDbAnalysisRecord(dbRecord);
      expect(result.proposal.sentiment).toEqual({
        overall: 'bullish',
        score: 0.75,
        indicators: {
          rsi: 65,
          macd: 'bullish',
        },
      });
    });

    it('should extract confidence from multiple sources', () => {
      // From performanceData
      let dbRecord = createMockDbRecord({
        performanceData: { confidence: 0.9 },
        proposalData: {},
      });
      let result = convertDbAnalysisRecord(dbRecord);
      expect(result.proposal.confidence).toBe(0.9);

      // From proposalData as number
      dbRecord = createMockDbRecord({
        performanceData: {},
        proposalData: { confidence: 0.85 },
      });
      result = convertDbAnalysisRecord(dbRecord);
      expect(result.proposal.confidence).toBe(0.85);

      // From proposalData as string
      dbRecord = createMockDbRecord({
        performanceData: {},
        proposalData: { confidence: '0.75' },
      });
      result = convertDbAnalysisRecord(dbRecord);
      expect(result.proposal.confidence).toBe(0.75);

      // Default when not found
      dbRecord = createMockDbRecord({
        performanceData: {},
        proposalData: {},
      });
      result = convertDbAnalysisRecord(dbRecord);
      expect(result.proposal.confidence).toBe(0.5);
    });

    it('should handle null/empty fields gracefully', () => {
      const dbRecord = createMockDbRecord({
        proposalId: null,
        sessionId: null,
        proposalData: null,
        trackingData: null,
        performanceData: null,
        touchEvents: undefined,
      });
      
      const result = convertDbAnalysisRecord(dbRecord);
      
      expect(result.proposalId).toBe('');
      expect(result.sessionId).toBe('');
      expect(result.tracking.status).toBe('active');
      expect(result.tracking.touches).toEqual([]);
      expect(result.performance).toBeUndefined();
    });

    it('should include dbMeta information', () => {
      const createdAt = new Date(Date.now() - 86400000) // 2021-01-01T10:00:00Z');
      const updatedAt = new Date(Date.now() - 86400000) // 2021-01-02T10:00:00Z');
      
      const dbRecord = createMockDbRecord({
        synced: false,
        createdAt,
        updatedAt,
      });
      
      const result = convertDbAnalysisRecord(dbRecord);
      
      expect(result.dbMeta).toEqual({
        version: 1,
        synced: false,
        createdAt,
        updatedAt,
      });
    });
  });

  describe('serializeBigInt', () => {
    it('should convert BigInt to string', () => {
      expect(serializeBigInt(BigInt(123))).toBe('123');
      expect(serializeBigInt(BigInt('9007199254740991'))).toBe('9007199254740991');
      expect(serializeBigInt(BigInt(0))).toBe('0');
      expect(serializeBigInt(BigInt(-123))).toBe('-123');
    });
  });

  describe('serializeDecimal', () => {
    it('should convert Decimal-like object to number', () => {
      const decimal = { toString: () => '123.45' };
      expect(serializeDecimal(decimal)).toBe(123.45);
    });

    it('should handle integer strings', () => {
      const decimal = { toString: () => '100' };
      expect(serializeDecimal(decimal)).toBe(100);
    });

    it('should handle negative values', () => {
      const decimal = { toString: () => '-50.5' };
      expect(serializeDecimal(decimal)).toBe(-50.5);
    });

    it('should handle zero', () => {
      const decimal = { toString: () => '0' };
      expect(serializeDecimal(decimal)).toBe(0);
    });
  });

  describe('prepareChartDrawingData', () => {
    it('should prepare complete drawing data', () => {
      const drawing = {
        id: 'drawing-1',
        sessionId: 'session-1',
        type: 'trendline',
        points: [[100, 50000], [200, 51000]],
        style: { color: 'red', width: 2 },
        price: 50500,
        time: 1609459200,
        levels: [50000, 51000, 52000],
        metadata: { source: 'user' },
        visible: false,
        interactive: false,
      };
      
      const result = prepareChartDrawingData(drawing);
      
      expect(result).toEqual({
        id: 'drawing-1',
        sessionId: 'session-1',
        type: 'trendline',
        points: [[100, 50000], [200, 51000]],
        style: { color: 'red', width: 2 },
        price: 50500,
        time: BigInt(1609459200),
        levels: [50000, 51000, 52000],
        metadata: { source: 'user' },
        visible: false,
        interactive: false,
      });
    });

    it('should handle missing optional fields', () => {
      const drawing = {
        id: 'drawing-1',
        sessionId: 'session-1',
        type: 'support',
      };
      
      const result = prepareChartDrawingData(drawing);
      
      expect(result).toEqual({
        id: 'drawing-1',
        sessionId: 'session-1',
        type: 'support',
        points: [],
        style: {},
        price: undefined,
        time: undefined,
        levels: undefined,
        metadata: undefined,
        visible: true,
        interactive: true,
      });
    });

    it('should convert time to BigInt when provided', () => {
      const drawing = {
        id: 'drawing-1',
        sessionId: 'session-1',
        type: 'resistance',
        time: 1609459200000,
      };
      
      const result = prepareChartDrawingData(drawing);
      
      expect(result.time).toBe(BigInt(1609459200000));
    });
  });

  describe('preparePatternAnalysisData', () => {
    it('should prepare complete pattern data', () => {
      const pattern = {
        id: 'pattern-1',
        sessionId: 'session-1',
        type: 'triangle',
        symbol: 'BTCUSDT',
        interval: '1h',
        startTime: 1609459200,
        endTime: 1609462800,
        confidence: 0.85,
        visualization: { type: 'ascending' },
        metrics: { breakoutProbability: 0.7 },
        description: 'Ascending triangle pattern',
        tradingImplication: 'Bullish breakout expected',
      };
      
      const result = preparePatternAnalysisData(pattern);
      
      expect(result).toEqual({
        id: 'pattern-1',
        sessionId: 'session-1',
        type: 'triangle',
        symbol: 'BTCUSDT',
        interval: '1h',
        startTime: BigInt(1609459200),
        endTime: BigInt(1609462800),
        confidence: 0.85,
        visualization: { type: 'ascending' },
        metrics: { breakoutProbability: 0.7 },
        description: 'Ascending triangle pattern',
        tradingImplication: 'Bullish breakout expected',
      });
    });

    it('should handle missing optional fields', () => {
      const pattern = {
        id: 'pattern-1',
        sessionId: 'session-1',
        type: 'flag',
        symbol: 'ETHUSDT',
        interval: '15m',
        startTime: 1609459200,
        endTime: 1609460100,
        confidence: 0.6,
        description: 'Bull flag',
        tradingImplication: 'Continuation expected',
      };
      
      const result = preparePatternAnalysisData(pattern);
      
      expect(result.visualization).toEqual({});
      expect(result.metrics).toEqual({});
    });

    it('should convert timestamps to BigInt', () => {
      const pattern = {
        id: 'pattern-1',
        sessionId: 'session-1',
        type: 'wedge',
        symbol: 'BTCUSDT',
        interval: '4h',
        startTime: 1609459200000, // Large number
        endTime: 1609462800000,
        confidence: 0.75,
        description: 'Rising wedge',
        tradingImplication: 'Bearish reversal likely',
      };
      
      const result = preparePatternAnalysisData(pattern);
      
      expect(result.startTime).toBe(BigInt(1609459200000));
      expect(result.endTime).toBe(BigInt(1609462800000));
    });
  });
});

export {};