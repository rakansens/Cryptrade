import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BaseIndicator } from '@/lib/indicators/base-indicator';
import type { ValidationOptions, ValidationResult, PriceDataLightweight } from '@/lib/indicators/types';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  }
}));

// 実際のvalidation.tsを使用してBaseIndicatorのコア機能をテスト
// jest.mock('@/lib/indicators/validation', () => ({
//   validatePriceData: jest.fn(),
//   handleIndicatorError: jest.fn()
// }));

// Concrete test implementation of BaseIndicator
class TestIndicator extends BaseIndicator<{ time: number; value: number }> {
  protected calculateCore(data: PriceDataLightweight[]): { time: number; value: number }[] {
    return data.map(d => ({ time: d.time, value: d.close }));
  }
}

describe('BaseIndicator', () => {
  let indicator: TestIndicator;
  
  const mockData: PriceDataLightweight[] = [
    { time: 1638360000, close: 100 },
    { time: 1638363600, close: 101 },
    { time: 1638367200, close: 102 }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    indicator = new TestIndicator('TEST', { minLength: 1 });
  });

  describe('constructor', () => {
    it('should create BaseIndicator instance successfully', () => {
      const indicator = new TestIndicator('TEST', { minLength: 1 });
      expect(indicator).toBeDefined();
      expect(indicator.getIndicatorName()).toBe('TEST');
    });

    it('should accept indicatorName and defaultOptions', () => {
      const indicator = new TestIndicator('RSI', { 
        minLength: 14,
        checkMonotonic: true,
        allowNaN: false 
      });
      
      expect(indicator).toBeDefined();
      expect(indicator.getIndicatorName()).toBe('RSI');
    });
  });

  describe('calculate method', () => {
    it('should successfully calculate with valid data', () => {
      const result = indicator.calculate(mockData);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([
        { time: 1638360000, value: 100 },
        { time: 1638363600, value: 101 },
        { time: 1638367200, value: 102 }
      ]);
    });

    it('should handle insufficient data gracefully', () => {
      // Test with empty data
      const result = indicator.calculate([]);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should handle calculation errors with try-catch', () => {
      // Force an error in calculateCore
      const errorIndicator = new (class extends BaseIndicator<any> {
        protected calculateCore(): any {
          throw new Error('Calculation failed');
        }
      })('ERROR_TEST', { minLength: 1 });

      const result = errorIndicator.calculate(mockData);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('public methods', () => {
    it('should return correct indicator name', () => {
      const name = indicator.getIndicatorName();
      expect(name).toBe('TEST');
    });
  });

  describe('abstract methods', () => {
    it('should enforce calculateCore is abstract and must be implemented', () => {
      // TypeScript should prevent direct instantiation of abstract class
      // This test verifies the concept through a working concrete implementation
      expect(indicator).toBeInstanceOf(BaseIndicator);
      expect(typeof (indicator as any).calculateCore).toBe('function');
    });
  });
});