// TDD Green Phase: ValidatorService Test Suite - テスト通過確認用
// Created: 2025-06-27 - Comprehensive validation service testing

import { ValidatorService } from '@/lib/services/market-data/validator.service';
import type { KlineData, MultiTimeframeData } from '@/lib/services/market-data/types';

describe('ValidatorService - TDD Green Phase', () => {
  let service: ValidatorService;

  beforeEach(() => {
    service = new ValidatorService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateKlineData', () => {
    it('should validate correct OHLC data successfully', async () => {
      const mockData: KlineData[] = [
        { time: 1640995200, open: 47000, high: 47500, low: 46800, close: 47200, volume: 100 },
        { time: 1640995260, open: 47200, high: 47400, low: 47000, close: 47100, volume: 150 }
      ];

      const result = await service.validateKlineData(mockData);

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(0.9);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.validatedAt).toBeDefined();
    });

    it('should detect OHLC inconsistencies', async () => {
      const mockData: KlineData[] = [
        { time: 1640995200, open: 47000, high: 46500, low: 46800, close: 47200, volume: 100 } // high < low
      ];

      const result = await service.validateKlineData(mockData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('High');
    });

    it('should detect negative volume', async () => {
      const mockData: KlineData[] = [
        { time: 1640995200, open: 47000, high: 47500, low: 46800, close: 47200, volume: -100 }
      ];

      const result = await service.validateKlineData(mockData);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(err => err.includes('Negative volume'))).toBe(true);
    });

    it('should handle abort signal', async () => {
      const abortController = new AbortController();
      abortController.abort();

      await expect(service.validateKlineData([], abortController.signal))
        .rejects.toThrow('Operation aborted');
    });
  });

  describe('detectPriceAnomalies', () => {
    it('should detect price jumps', async () => {
      const mockData: KlineData[] = [
        { time: 1640995200, open: 47000, high: 47500, low: 46800, close: 47200, volume: 100 },
        { time: 1640995260, open: 47200, high: 52000, low: 47000, close: 52000, volume: 150 } // 10%+ jump
      ];

      const result = await service.detectPriceAnomalies(mockData);

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies[0].type).toBe('price_jump');
      expect(result.detectionAccuracy).toBeLessThan(1.0);
    });

    it('should detect OHLC inconsistencies', async () => {
      const mockData: KlineData[] = [
        { time: 1640995200, open: 47000, high: 46500, low: 46800, close: 47200, volume: 100 }
      ];

      const result = await service.detectPriceAnomalies(mockData);

      expect(result.anomalies.some(a => a.type === 'inconsistent_ohlc')).toBe(true);
    });

    it('should return empty results for insufficient data', async () => {
      const result = await service.detectPriceAnomalies([]);

      expect(result.anomalies).toHaveLength(0);
      expect(result.detectionAccuracy).toBe(1.0);
    });
  });

  describe('checkMultiTimeframeConsistency', () => {
    it('should check consistency across timeframes', async () => {
      const mockMultiData: MultiTimeframeData = {
        symbol: 'BTCUSDT',
        timeframes: {
          '1m': {
            data: [{ time: 1640995200, open: 47000, high: 47500, low: 46800, close: 47200, volume: 100 }],
            weight: 1,
            dataPoints: 1,
            fetchedAt: Date.now()
          },
          '5m': {
            data: [{ time: 1640995200, open: 47000, high: 47500, low: 46800, close: 47200, volume: 500 }],
            weight: 1,
            dataPoints: 1,
            fetchedAt: Date.now()
          }
        },
        fetchedAt: Date.now(),
        cacheKey: 'test-key'
      };

      const result = await service.checkMultiTimeframeConsistency(mockMultiData);

      expect(result.isConsistent).toBe(true);
      expect(result.overallScore).toBe(1.0);
      expect(result.totalComparisons).toBeGreaterThan(0);
    });

    it('should detect inconsistencies', async () => {
      const mockMultiData: MultiTimeframeData = {
        symbol: 'BTCUSDT',
        timeframes: {
          '1m': {
            data: [{ time: 1640995200, open: 47000, high: 47500, low: 46800, close: 47200, volume: 100 }],
            weight: 1,
            dataPoints: 1,
            fetchedAt: Date.now()
          },
          '5m': {
            data: [{ time: 1640995200, open: 47000, high: 47500, low: 46800, close: 50000, volume: 500 }], // Large difference
            weight: 1,
            dataPoints: 1,
            fetchedAt: Date.now()
          }
        },
        fetchedAt: Date.now(),
        cacheKey: 'test-key'
      };

      const result = await service.checkMultiTimeframeConsistency(mockMultiData);

      expect(result.isConsistent).toBe(false);
      expect(result.inconsistencies.length).toBeGreaterThan(0);
    });
  });

  describe('validateDataIntegrity', () => {
    it('should detect duplicate timestamps', async () => {
      const mockData: KlineData[] = [
        { time: 1640995200, open: 47000, high: 47500, low: 46800, close: 47200, volume: 100 },
        { time: 1640995200, open: 47200, high: 47400, low: 47000, close: 47100, volume: 150 } // Duplicate time
      ];

      const result = await service.validateDataIntegrity(mockData);

      expect(result.duplicateTimestamps.length).toBeGreaterThan(0);
      expect(result.integrityScore).toBeLessThan(1.0);
    });

    it('should detect out-of-order entries', async () => {
      const mockData: KlineData[] = [
        { time: 1640995260, open: 47000, high: 47500, low: 46800, close: 47200, volume: 100 },
        { time: 1640995200, open: 47200, high: 47400, low: 47000, close: 47100, volume: 150 } // Out of order
      ];

      const result = await service.validateDataIntegrity(mockData);

      expect(result.outOfOrderEntries.length).toBeGreaterThan(0);
    });

    it('should detect missing data points', async () => {
      const mockData: KlineData[] = [
        { time: 1640995200, open: 47000, high: 47500, low: 46800, close: 47200, volume: 100 },
        { time: 1640995380, open: 47200, high: 47400, low: 47000, close: 47100, volume: 150 } // 3 minute gap
      ];

      const result = await service.validateDataIntegrity(mockData);

      expect(result.missingDataPoints.length).toBeGreaterThan(0);
    });
  });

  describe('validateStreamingData', () => {
    it('should validate new streaming data', async () => {
      const newData: KlineData = {
        time: 1640995260,
        open: 47200,
        high: 47400,
        low: 47000,
        close: 47100,
        volume: 150
      };

      const previousData: KlineData[] = [
        { time: 1640995200, open: 47000, high: 47500, low: 46800, close: 47200, volume: 100 }
      ];

      const result = await service.validateStreamingData(newData, previousData);

      expect(result.isValid).toBe(true);
      expect(result.score).toBe(1.0);
    });

    it('should detect timestamp issues in streaming data', async () => {
      const newData: KlineData = {
        time: 1640995100, // Earlier than previous
        open: 47200,
        high: 47400,
        low: 47000,
        close: 47100,
        volume: 150
      };

      const previousData: KlineData[] = [
        { time: 1640995200, open: 47000, high: 47500, low: 46800, close: 47200, volume: 100 }
      ];

      const result = await service.validateStreamingData(newData, previousData);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(err => err.includes('timestamp'))).toBe(true);
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const newConfig = { anomalyThreshold: 3.0 };
      service.updateConfig(newConfig);

      const config = service.getConfig();
      expect(config.anomalyThreshold).toBe(3.0);
    });

    it('should return current configuration', () => {
      const config = service.getConfig();

      expect(config).toHaveProperty('anomalyThreshold');
      expect(config).toHaveProperty('consistencyTolerance');
      expect(config).toHaveProperty('volumeOutlierThreshold');
      expect(config).toHaveProperty('priceJumpThreshold');
      expect(config).toHaveProperty('accuracyTarget');
    });
  });
});