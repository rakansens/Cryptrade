// Jest is configured globally, no imports needed
import type {
  PriceDataPoint,
  MACDDataPoint,
  RSIDataPoint,
  IndicatorDataPoint,
  MultiValueIndicatorDataPoint,
  MACDParameters,
  RSIParameters,
  MAParameters,
  BollingerBandsDataPoint,
  BollingerBandsParameters,
  VolumeDataPoint,
  StochasticDataPoint,
  StochasticParameters
} from '../indicator.types';
import {
  isPriceDataPoint,
  isMACDDataPoint,
  isRSIDataPoint
} from '../indicator.types';

describe('indicator.types', () => {
  describe('isPriceDataPoint', () => {
    it('should return true for valid PriceDataPoint with only required fields', () => {
      const validPoint: PriceDataPoint = {
        time: Date.now(),
        close: 100.50
      };

      expect(isPriceDataPoint(validPoint)).toBe(true);
    });

    it('should return true for PriceDataPoint with all fields', () => {
      const validPoint: PriceDataPoint = {
        time: Date.now(),
        open: 99.50,
        high: 101.00,
        low: 99.00,
        close: 100.50,
        volume: 1000000
      };

      expect(isPriceDataPoint(validPoint)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isPriceDataPoint(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isPriceDataPoint(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isPriceDataPoint('string')).toBe(false);
      expect(isPriceDataPoint(123)).toBe(false);
      expect(isPriceDataPoint(true)).toBe(false);
      expect(isPriceDataPoint([])).toBe(false);
    });

    it('should return false for missing required fields', () => {
      expect(isPriceDataPoint({})).toBe(false);
      expect(isPriceDataPoint({ time: Date.now() })).toBe(false);
      expect(isPriceDataPoint({ close: 100.50 })).toBe(false);
    });

    it('should return false for wrong field types', () => {
      expect(isPriceDataPoint({
        time: '2024-01-01', // should be number
        close: 100.50
      })).toBe(false);

      expect(isPriceDataPoint({
        time: Date.now(),
        close: '100.50' // should be number
      })).toBe(false);
    });
  });

  describe('isMACDDataPoint', () => {
    it('should return true for valid MACDDataPoint', () => {
      const validPoint: MACDDataPoint = {
        time: Date.now(),
        macd: 1.25,
        signal: 1.10,
        histogram: 0.15
      };

      expect(isMACDDataPoint(validPoint)).toBe(true);
    });

    it('should return true for MACDDataPoint with negative values', () => {
      const validPoint: MACDDataPoint = {
        time: Date.now(),
        macd: -1.25,
        signal: -1.10,
        histogram: -0.15
      };

      expect(isMACDDataPoint(validPoint)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isMACDDataPoint(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isMACDDataPoint(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isMACDDataPoint('string')).toBe(false);
      expect(isMACDDataPoint(123)).toBe(false);
      expect(isMACDDataPoint(true)).toBe(false);
      expect(isMACDDataPoint([])).toBe(false);
    });

    it('should return false for missing required fields', () => {
      expect(isMACDDataPoint({})).toBe(false);
      expect(isMACDDataPoint({ time: Date.now() })).toBe(false);
      expect(isMACDDataPoint({ time: Date.now(), macd: 1.25 })).toBe(false);
      expect(isMACDDataPoint({ time: Date.now(), macd: 1.25, signal: 1.10 })).toBe(false);
    });

    it('should return false for wrong field types', () => {
      expect(isMACDDataPoint({
        time: '2024-01-01', // should be number
        macd: 1.25,
        signal: 1.10,
        histogram: 0.15
      })).toBe(false);

      expect(isMACDDataPoint({
        time: Date.now(),
        macd: '1.25', // should be number
        signal: 1.10,
        histogram: 0.15
      })).toBe(false);

      expect(isMACDDataPoint({
        time: Date.now(),
        macd: 1.25,
        signal: '1.10', // should be number
        histogram: 0.15
      })).toBe(false);

      expect(isMACDDataPoint({
        time: Date.now(),
        macd: 1.25,
        signal: 1.10,
        histogram: '0.15' // should be number
      })).toBe(false);
    });
  });

  describe('isRSIDataPoint', () => {
    it('should return true for valid RSIDataPoint', () => {
      const validPoint: RSIDataPoint = {
        time: Date.now(),
        rsi: 65.5
      };

      expect(isRSIDataPoint(validPoint)).toBe(true);
    });

    it('should return true for RSI values at extremes', () => {
      const oversold: RSIDataPoint = {
        time: Date.now(),
        rsi: 20
      };

      const overbought: RSIDataPoint = {
        time: Date.now(),
        rsi: 80
      };

      expect(isRSIDataPoint(oversold)).toBe(true);
      expect(isRSIDataPoint(overbought)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isRSIDataPoint(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isRSIDataPoint(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isRSIDataPoint('string')).toBe(false);
      expect(isRSIDataPoint(123)).toBe(false);
      expect(isRSIDataPoint(true)).toBe(false);
      expect(isRSIDataPoint([])).toBe(false);
    });

    it('should return false for missing required fields', () => {
      expect(isRSIDataPoint({})).toBe(false);
      expect(isRSIDataPoint({ time: Date.now() })).toBe(false);
      expect(isRSIDataPoint({ rsi: 65.5 })).toBe(false);
    });

    it('should return false for wrong field types', () => {
      expect(isRSIDataPoint({
        time: '2024-01-01', // should be number
        rsi: 65.5
      })).toBe(false);

      expect(isRSIDataPoint({
        time: Date.now(),
        rsi: '65.5' // should be number
      })).toBe(false);
    });
  });

  describe('IndicatorDataPoint interface', () => {
    it('should accept valid IndicatorDataPoint objects', () => {
      const point: IndicatorDataPoint = {
        time: Date.now(),
        value: 100.50
      };

      expect(point).toBeDefined();
    });
  });

  describe('MultiValueIndicatorDataPoint interface', () => {
    it('should accept valid MultiValueIndicatorDataPoint objects', () => {
      const point: MultiValueIndicatorDataPoint = {
        time: Date.now(),
        value1: 100.50,
        value2: 101.00,
        value3: 99.50
      };

      expect(point).toBeDefined();
    });
  });

  describe('Parameter interfaces', () => {
    it('should accept valid MACDParameters', () => {
      const params: MACDParameters = {
        short: 12,
        long: 26,
        signal: 9
      };

      expect(params).toBeDefined();
    });

    it('should accept valid RSIParameters', () => {
      const params: RSIParameters = {
        period: 14
      };

      expect(params).toBeDefined();
    });

    it('should accept valid MAParameters', () => {
      const params1: MAParameters = {
        period: 20
      };

      const params2: MAParameters = {
        period: 50,
        type: 'exponential'
      };

      expect(params1).toBeDefined();
      expect(params2).toBeDefined();
    });

    it('should accept valid BollingerBandsParameters', () => {
      const params: BollingerBandsParameters = {
        period: 20,
        stdDev: 2
      };

      expect(params).toBeDefined();
    });

    it('should accept valid StochasticParameters', () => {
      const params: StochasticParameters = {
        kPeriod: 14,
        dPeriod: 3,
        smoothK: 3
      };

      expect(params).toBeDefined();
    });
  });

  describe('Data point interfaces', () => {
    it('should accept valid BollingerBandsDataPoint', () => {
      const point: BollingerBandsDataPoint = {
        time: Date.now(),
        upper: 105.00,
        middle: 100.00,
        lower: 95.00
      };

      expect(point).toBeDefined();
    });

    it('should accept valid VolumeDataPoint', () => {
      const point1: VolumeDataPoint = {
        time: Date.now(),
        value: 1000000
      };

      const point2: VolumeDataPoint = {
        time: Date.now(),
        value: 1500000,
        color: '#00ff00'
      };

      expect(point1).toBeDefined();
      expect(point2).toBeDefined();
    });

    it('should accept valid StochasticDataPoint', () => {
      const point: StochasticDataPoint = {
        time: Date.now(),
        k: 75.5,
        d: 72.3
      };

      expect(point).toBeDefined();
    });
  });
});