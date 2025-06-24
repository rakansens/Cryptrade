import {
  convertDbAnalysisRecord,
  serializeBigInt,
  serializeDecimal,
  prepareChartDrawingData,
  preparePatternAnalysisData,
} from '@/lib/utils/db-conversions.server';
import { Decimal } from '@prisma/client/runtime/library';
import type { AnalysisRecord as DbAnalysisRecord, TouchEvent as DbTouchEvent } from '@prisma/client';

describe('db-conversions.server utilities', () => {
  describe('convertDbAnalysisRecord', () => {
    const createMockDbRecord = (
      overrides?: Partial<DbAnalysisRecord & { touchEvents?: DbTouchEvent[] }>
    ): DbAnalysisRecord & { touchEvents?: DbTouchEvent[] } => ({
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

    it('should convert server db record with Prisma types', () => {
      const touchEvents: DbTouchEvent[] = [
        {
          id: 'touch-1',
          analysisRecordId: 'test-id',
          timestamp: BigInt(1609459300000),
          price: new Decimal('50100'),
          result: 'bounce',
          volume: new Decimal('1000'),
          strength: new Decimal('0.8'),
          createdAt: new Date(Date.now() - 86400000) // 2021-01-01'),
        },
        {
          id: 'touch-2',
          analysisRecordId: 'test-id',
          timestamp: BigInt(1609459400000),
          price: new Decimal('50200'),
          result: 'breakout',
          volume: null,
          strength: new Decimal('0.9'),
          createdAt: new Date(Date.now() - 86400000) // 2021-01-01'),
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
        result: 'break',
        volume: undefined,
        strength: 0.9,
      });
    });

    it('should handle all conversion scenarios same as client version', () => {
      // Test null proposalData
      let dbRecord = createMockDbRecord({ proposalData: null });
      let result = convertDbAnalysisRecord(dbRecord);
      expect(result.proposal.price).toBe(0);
      expect(result.proposal.confidence).toBe(0.5);

      // Test price from levels
      dbRecord = createMockDbRecord({
        proposalData: { levels: [55000, 56000] },
      });
      result = convertDbAnalysisRecord(dbRecord);
      expect(result.proposal.price).toBe(55000);

      // Test sentiment extraction
      dbRecord = createMockDbRecord({
        proposalData: {
          sentiment: {
            overall: 'bearish',
            score: 0.3,
          },
        },
      });
      result = convertDbAnalysisRecord(dbRecord);
      expect(result.proposal.sentiment).toEqual({
        overall: 'bearish',
        score: 0.3,
      });
    });
  });

  describe('serializeDecimal', () => {
    it('should convert Prisma Decimal to number', () => {
      const decimal = new Decimal('123.45');
      expect(serializeDecimal(decimal)).toBe(123.45);
    });

    it('should handle large decimals', () => {
      const decimal = new Decimal('999999999.99');
      expect(serializeDecimal(decimal)).toBe(999999999.99);
    });

    it('should handle negative decimals', () => {
      const decimal = new Decimal('-123.45');
      expect(serializeDecimal(decimal)).toBe(-123.45);
    });

    it('should handle zero decimal', () => {
      const decimal = new Decimal('0');
      expect(serializeDecimal(decimal)).toBe(0);
    });

    it('should handle scientific notation', () => {
      const decimal = new Decimal('1e-10');
      expect(serializeDecimal(decimal)).toBe(1e-10);
    });
  });

  describe('prepareChartDrawingData', () => {
    it('should convert price to Decimal when provided', () => {
      const drawing = {
        id: 'drawing-1',
        sessionId: 'session-1',
        type: 'trendline',
        price: 50500.5,
      };

      const result = prepareChartDrawingData(drawing);

      expect(result.price).toBeInstanceOf(Decimal);
      expect(result.price.toString()).toBe('50500.5');
    });

    it('should handle all fields correctly', () => {
      const drawing = {
        id: 'drawing-1',
        sessionId: 'session-1',
        type: 'fibonacci',
        points: [[100, 50000], [200, 52000]],
        style: { color: 'blue', width: 1 },
        price: 51000,
        time: 1609459200000,
        levels: [0, 0.236, 0.382, 0.5, 0.618, 1],
        metadata: { source: 'ai' },
        visible: true,
        interactive: false,
      };

      const result = prepareChartDrawingData(drawing);

      expect(result).toEqual({
        id: 'drawing-1',
        sessionId: 'session-1',
        type: 'fibonacci',
        points: [[100, 50000], [200, 52000]],
        style: { color: 'blue', width: 1 },
        price: new Decimal(51000),
        time: BigInt(1609459200000),
        levels: [0, 0.236, 0.382, 0.5, 0.618, 1],
        metadata: { source: 'ai' },
        visible: true,
        interactive: false,
      });
    });
  });

  describe('preparePatternAnalysisData', () => {
    it('should convert confidence to Decimal', () => {
      const pattern = {
        id: 'pattern-1',
        sessionId: 'session-1',
        type: 'head_and_shoulders',
        symbol: 'BTCUSDT',
        interval: '1h',
        startTime: 1609459200,
        endTime: 1609462800,
        confidence: 0.92,
        description: 'Head and shoulders pattern',
        tradingImplication: 'Bearish reversal',
      };

      const result = preparePatternAnalysisData(pattern);

      expect(result.confidence).toBeInstanceOf(Decimal);
      expect(result.confidence.toString()).toBe('0.92');
    });

    it('should handle all fields with proper type conversions', () => {
      const pattern = {
        id: 'pattern-1',
        sessionId: 'session-1',
        type: 'double_bottom',
        symbol: 'ETHUSDT',
        interval: '4h',
        startTime: 1609459200000,
        endTime: 1609470000000,
        confidence: 0.78,
        visualization: {
          neckline: 3000,
          bottoms: [2800, 2850],
        },
        metrics: {
          depth: 0.07,
          symmetry: 0.85,
        },
        description: 'Double bottom reversal pattern',
        tradingImplication: 'Bullish reversal signal',
      };

      const result = preparePatternAnalysisData(pattern);

      expect(result).toEqual({
        id: 'pattern-1',
        sessionId: 'session-1',
        type: 'double_bottom',
        symbol: 'ETHUSDT',
        interval: '4h',
        startTime: BigInt(1609459200000),
        endTime: BigInt(1609470000000),
        confidence: new Decimal(0.78),
        visualization: {
          neckline: 3000,
          bottoms: [2800, 2850],
        },
        metrics: {
          depth: 0.07,
          symmetry: 0.85,
        },
        description: 'Double bottom reversal pattern',
        tradingImplication: 'Bullish reversal signal',
      });
    });
  });

  describe('serializeBigInt', () => {
    it('should be identical to client version', () => {
      expect(serializeBigInt(BigInt(123))).toBe('123');
      expect(serializeBigInt(BigInt('9007199254740992'))).toBe('9007199254740992');
      expect(serializeBigInt(BigInt(0))).toBe('0');
      expect(serializeBigInt(BigInt(-456))).toBe('-456');
    });
  });
});

export {};