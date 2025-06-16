import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { calculateRiskManagement } from '../calculators/risk-calculator';
import type { PriceData as CandlestickData } from '@/types/market';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('calculateRiskManagement', () => {
  const mockMarketData: CandlestickData[] = Array.from({ length: 100 }, (_, i) => ({
    time: 1234567890000 + i * 3600000,
    open: 50000 + Math.sin(i * 0.1) * 1000,
    high: 50500 + Math.sin(i * 0.1) * 1000,
    low: 49500 + Math.sin(i * 0.1) * 1000,
    close: 50000 + Math.sin(i * 0.1) * 1000,
    volume: 100 + Math.random() * 50,
  }));

  const baseParams = {
    entryPrice: 50000,
    direction: 'long' as const,
    marketData: mockMarketData,
    volatility: 'normal' as const,
    strategy: 'swingTrading' as const,
    riskPercentage: 1,
  };

  describe('Basic Risk Calculations', () => {
    it('should calculate stop loss for long position', async () => {
      const result = await calculateRiskManagement(baseParams);

      expect(result.stopLoss).toBeLessThan(baseParams.entryPrice);
      expect(result.stopLoss).toBeGreaterThan(0);
    });

    it('should calculate stop loss for short position', async () => {
      const result = await calculateRiskManagement({
        ...baseParams,
        direction: 'short',
      });

      expect(result.stopLoss).toBeGreaterThan(baseParams.entryPrice);
    });

    it('should calculate take profit levels', async () => {
      const result = await calculateRiskManagement(baseParams);

      expect(result.takeProfits).toBeDefined();
      expect(Array.isArray(result.takeProfits)).toBe(true);
      expect(result.takeProfits.length).toBeGreaterThan(0);

      // For long position, take profits should be above entry
      result.takeProfits.forEach(tp => {
        expect(tp.price).toBeGreaterThan(baseParams.entryPrice);
        expect(tp.percentage).toBeGreaterThan(0);
        expect(tp.percentage).toBeLessThanOrEqual(100);
      });
    });

    it('should calculate position size', async () => {
      const result = await calculateRiskManagement(baseParams);

      expect(result.positionSize).toBeGreaterThan(0);
      expect(result.positionSize).toBeLessThanOrEqual(1); // Max 100% of capital
    });

    it('should calculate risk amount', async () => {
      const result = await calculateRiskManagement(baseParams);

      expect(result.riskAmount).toBeGreaterThan(0);
      // Risk amount should be related to risk percentage
      expect(result.riskAmount).toBeLessThanOrEqual(baseParams.riskPercentage * 100);
    });

    it('should calculate risk/reward ratio', async () => {
      const result = await calculateRiskManagement(baseParams);

      expect(result.riskRewardRatio).toBeGreaterThan(0);
      // Good trades should have R:R > 1
      expect(result.riskRewardRatio).toBeGreaterThanOrEqual(1);
    });

    it('should calculate max loss and expected profit', async () => {
      const result = await calculateRiskManagement(baseParams);

      expect(result.maxLoss).toBeGreaterThan(0);
      expect(result.expectedProfit).toBeGreaterThan(0);
      
      // Expected profit should be greater than max loss for positive R:R
      expect(result.expectedProfit).toBeGreaterThan(result.maxLoss);
    });
  });

  describe('Strategy-Based Adjustments', () => {
    it('should adjust for scalping strategy', async () => {
      const scalpingResult = await calculateRiskManagement({
        ...baseParams,
        strategy: 'scalping',
      });

      const swingResult = await calculateRiskManagement({
        ...baseParams,
        strategy: 'swingTrading',
      });

      // Scalping should have tighter stop loss
      const scalpingStopDistance = Math.abs(baseParams.entryPrice - scalpingResult.stopLoss);
      const swingStopDistance = Math.abs(baseParams.entryPrice - swingResult.stopLoss);
      
      expect(scalpingStopDistance).toBeLessThan(swingStopDistance);
    });

    it('should adjust for day trading strategy', async () => {
      const result = await calculateRiskManagement({
        ...baseParams,
        strategy: 'dayTrading',
      });

      expect(result.stopLoss).toBeDefined();
      expect(result.takeProfits.length).toBeGreaterThanOrEqual(2);
    });

    it('should adjust for position trading strategy', async () => {
      const positionResult = await calculateRiskManagement({
        ...baseParams,
        strategy: 'position',
      });

      const dayResult = await calculateRiskManagement({
        ...baseParams,
        strategy: 'dayTrading',
      });

      // Position trading should have wider stop loss
      const positionStopDistance = Math.abs(baseParams.entryPrice - positionResult.stopLoss);
      const dayStopDistance = Math.abs(baseParams.entryPrice - dayResult.stopLoss);
      
      expect(positionStopDistance).toBeGreaterThan(dayStopDistance);
    });
  });

  describe('Volatility Adjustments', () => {
    it('should adjust for high volatility', async () => {
      const highVolResult = await calculateRiskManagement({
        ...baseParams,
        volatility: 'high',
      });

      const normalVolResult = await calculateRiskManagement({
        ...baseParams,
        volatility: 'normal',
      });

      // High volatility should have wider stop loss
      const highVolStopDistance = Math.abs(baseParams.entryPrice - highVolResult.stopLoss);
      const normalVolStopDistance = Math.abs(baseParams.entryPrice - normalVolResult.stopLoss);
      
      expect(highVolStopDistance).toBeGreaterThan(normalVolStopDistance);
    });

    it('should adjust for low volatility', async () => {
      const lowVolResult = await calculateRiskManagement({
        ...baseParams,
        volatility: 'low',
      });

      const normalVolResult = await calculateRiskManagement({
        ...baseParams,
        volatility: 'normal',
      });

      // Low volatility should have tighter stop loss
      const lowVolStopDistance = Math.abs(baseParams.entryPrice - lowVolResult.stopLoss);
      const normalVolStopDistance = Math.abs(baseParams.entryPrice - normalVolResult.stopLoss);
      
      expect(lowVolStopDistance).toBeLessThan(normalVolStopDistance);
    });

    it('should adjust position size for volatility', async () => {
      const highVolResult = await calculateRiskManagement({
        ...baseParams,
        volatility: 'high',
      });

      const lowVolResult = await calculateRiskManagement({
        ...baseParams,
        volatility: 'low',
      });

      // Higher volatility should have smaller position size
      expect(highVolResult.positionSize).toBeLessThan(lowVolResult.positionSize);
    });
  });

  describe('Risk Percentage Variations', () => {
    it('should scale with risk percentage', async () => {
      const lowRiskResult = await calculateRiskManagement({
        ...baseParams,
        riskPercentage: 0.5,
      });

      const highRiskResult = await calculateRiskManagement({
        ...baseParams,
        riskPercentage: 2,
      });

      expect(highRiskResult.riskAmount).toBeGreaterThan(lowRiskResult.riskAmount);
      expect(highRiskResult.positionSize).toBeGreaterThan(lowRiskResult.positionSize);
    });

    it('should maintain risk/reward ratio regardless of risk percentage', async () => {
      const results = await Promise.all([0.5, 1, 2, 3].map(risk =>
        calculateRiskManagement({
          ...baseParams,
          riskPercentage: risk,
        })
      ));

      // R:R ratio should be consistent
      const ratios = results.map(r => r.riskRewardRatio);
      const avgRatio = ratios.reduce((a, b) => a + b) / ratios.length;
      
      ratios.forEach(ratio => {
        expect(Math.abs(ratio - avgRatio)).toBeLessThan(0.5);
      });
    });
  });

  describe('Market Data Analysis', () => {
    it('should use recent price action for stop loss', async () => {
      const volatileData = mockMarketData.map((candle, i) => ({
        ...candle,
        low: i > 90 ? 48000 : candle.low, // Recent swing low
      }));

      const result = await calculateRiskManagement({
        ...baseParams,
        marketData: volatileData,
      });

      // Stop loss should consider recent swing low
      expect(result.stopLoss).toBeLessThanOrEqual(48000 * 1.01); // With small buffer
    });

    it('should handle insufficient market data', async () => {
      const result = await calculateRiskManagement({
        ...baseParams,
        marketData: mockMarketData.slice(0, 5),
      });

      expect(result.stopLoss).toBeDefined();
      expect(result.takeProfits).toBeDefined();
    });

    it('should handle empty market data', async () => {
      const result = await calculateRiskManagement({
        ...baseParams,
        marketData: [],
      });

      // Should use default calculations
      expect(result.stopLoss).toBeDefined();
      expect(result.takeProfits).toBeDefined();
    });
  });

  describe('Take Profit Calculations', () => {
    it('should create multiple take profit levels', async () => {
      const result = await calculateRiskManagement(baseParams);

      expect(result.takeProfits.length).toBeGreaterThanOrEqual(2);
      expect(result.takeProfits.length).toBeLessThanOrEqual(5);
    });

    it('should distribute percentages correctly', async () => {
      const result = await calculateRiskManagement(baseParams);

      const totalPercentage = result.takeProfits.reduce(
        (sum, tp) => sum + tp.percentage,
        0
      );

      expect(totalPercentage).toBe(100);
    });

    it('should order take profits by distance for long', async () => {
      const result = await calculateRiskManagement(baseParams);

      for (let i = 1; i < result.takeProfits.length; i++) {
        expect(result.takeProfits[i].price).toBeGreaterThan(
          result.takeProfits[i - 1].price
        );
      }
    });

    it('should order take profits by distance for short', async () => {
      const result = await calculateRiskManagement({
        ...baseParams,
        direction: 'short',
      });

      for (let i = 1; i < result.takeProfits.length; i++) {
        expect(result.takeProfits[i].price).toBeLessThan(
          result.takeProfits[i - 1].price
        );
      }
    });

    it('should have decreasing percentages for further targets', async () => {
      const result = await calculateRiskManagement(baseParams);

      for (let i = 1; i < result.takeProfits.length; i++) {
        expect(result.takeProfits[i].percentage).toBeLessThanOrEqual(
          result.takeProfits[i - 1].percentage
        );
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle extreme entry prices', async () => {
      const result = await calculateRiskManagement({
        ...baseParams,
        entryPrice: 1000000,
      });

      expect(result.stopLoss).toBeGreaterThan(0);
      expect(result.stopLoss).toBeLessThan(1000000);
    });

    it('should handle very low entry prices', async () => {
      const result = await calculateRiskManagement({
        ...baseParams,
        entryPrice: 0.01,
      });

      expect(result.stopLoss).toBeGreaterThan(0);
      expect(result.stopLoss).toBeLessThan(0.01);
    });

    it('should handle extreme risk percentages', async () => {
      const minRiskResult = await calculateRiskManagement({
        ...baseParams,
        riskPercentage: 0.1,
      });

      const maxRiskResult = await calculateRiskManagement({
        ...baseParams,
        riskPercentage: 5,
      });

      expect(minRiskResult.positionSize).toBeGreaterThan(0);
      expect(maxRiskResult.positionSize).toBeLessThanOrEqual(1);
    });

    it('should handle identical high/low prices', async () => {
      const flatData = mockMarketData.map(candle => ({
        ...candle,
        high: 50000,
        low: 50000,
      }));

      const result = await calculateRiskManagement({
        ...baseParams,
        marketData: flatData,
      });

      expect(result.stopLoss).toBeDefined();
      expect(result.stopLoss).not.toBe(baseParams.entryPrice);
    });
  });

  describe('Consistency Checks', () => {
    it('should maintain consistent risk across different scenarios', async () => {
      const scenarios = [
        { ...baseParams, entryPrice: 30000 },
        { ...baseParams, entryPrice: 50000 },
        { ...baseParams, entryPrice: 70000 },
      ];

      const results = await Promise.all(
        scenarios.map(params => calculateRiskManagement(params))
      );

      // Risk percentage should be consistent
      results.forEach(result => {
        const riskPercentage = (result.riskAmount / (result.positionSize * 10000)) * 100;
        expect(Math.abs(riskPercentage - baseParams.riskPercentage)).toBeLessThan(0.1);
      });
    });

    it('should produce deterministic results', async () => {
      const result1 = await calculateRiskManagement(baseParams);
      const result2 = await calculateRiskManagement(baseParams);

      expect(result1.stopLoss).toBe(result2.stopLoss);
      expect(result1.positionSize).toBe(result2.positionSize);
      expect(result1.riskRewardRatio).toBe(result2.riskRewardRatio);
    });
  });
});