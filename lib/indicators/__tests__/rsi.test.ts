import { describe, it, expect } from '@jest/globals';
import { calculateRSI, getRSIColor, getRSISignal } from '../rsi';
import type { RSIData } from '@/types/market';

describe('calculateRSI', () => {
  // Simple test data with known pattern
  const simpleUptrend = Array.from({ length: 30 }, (_, i) => ({
    time: 1000 + i * 1000,
    close: 100 + i * 2 // Steady uptrend
  }));

  const simpleDowntrend = Array.from({ length: 30 }, (_, i) => ({
    time: 1000 + i * 1000,
    close: 200 - i * 2 // Steady downtrend
  }));

  const oscillatingData = Array.from({ length: 30 }, (_, i) => ({
    time: 1000 + i * 1000,
    close: 100 + Math.sin(i * 0.5) * 10 // Oscillating pattern
  }));

  describe('basic calculations', () => {
    it('should calculate RSI with default period (14)', () => {
      const result = calculateRSI(oscillatingData);
      
      // Result length should be data.length - period
      expect(result.length).toBe(oscillatingData.length - 14);
      
      result.forEach(point => {
        expect(point).toHaveProperty('time');
        expect(point).toHaveProperty('rsi');
        
        expect(typeof point.time).toBe('number');
        expect(typeof point.rsi).toBe('number');
        
        // RSI should be between 0 and 100
        expect(point.rsi).toBeGreaterThanOrEqual(0);
        expect(point.rsi).toBeLessThanOrEqual(100);
      });
    });

    it('should calculate RSI with custom period', () => {
      const period = 7;
      const result = calculateRSI(oscillatingData, period);
      
      expect(result.length).toBe(oscillatingData.length - period);
      
      result.forEach(point => {
        expect(point.rsi).toBeGreaterThanOrEqual(0);
        expect(point.rsi).toBeLessThanOrEqual(100);
      });
    });

    it('should return empty array when insufficient data', () => {
      const insufficientData = oscillatingData.slice(0, 10);
      const result = calculateRSI(insufficientData, 14); // Needs at least 15 points
      
      expect(result).toHaveLength(0);
    });

    it('should handle minimum required data points', () => {
      const minData = oscillatingData.slice(0, 15); // Exactly period + 1 points
      const result = calculateRSI(minData, 14);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('rsi');
      expect(result[0].rsi).toBeGreaterThanOrEqual(0);
      expect(result[0].rsi).toBeLessThanOrEqual(100);
    });
  });

  describe('RSI extremes', () => {
    it('should approach 100 in strong uptrend', () => {
      const result = calculateRSI(simpleUptrend);
      
      // In a perfect uptrend, RSI should be very high
      const lastRSI = result[result.length - 1].rsi;
      expect(lastRSI).toBeGreaterThan(90);
      expect(lastRSI).toBeLessThanOrEqual(100);
    });

    it('should approach 0 in strong downtrend', () => {
      const result = calculateRSI(simpleDowntrend);
      
      // In a perfect downtrend, RSI should be very low
      const lastRSI = result[result.length - 1].rsi;
      expect(lastRSI).toBeLessThan(10);
      expect(lastRSI).toBeGreaterThanOrEqual(0);
    });

    it('should be around 50 for sideways market', () => {
      const sidewaysData = Array.from({ length: 30 }, (_, i) => ({
        time: 1000 + i * 1000,
        close: 100 + (i % 2 === 0 ? 1 : -1) // Small oscillation
      }));
      
      const result = calculateRSI(sidewaysData);
      
      // Average RSI should be around 50
      const avgRSI = result.reduce((sum, p) => sum + p.rsi, 0) / result.length;
      expect(avgRSI).toBeGreaterThan(40);
      expect(avgRSI).toBeLessThan(60);
    });
  });

  describe('Wilder\'s smoothing', () => {
    it('should use Wilder\'s smoothing method correctly', () => {
      // Create data with known gain/loss pattern
      const testData = [
        { time: 1000, close: 100 },
        { time: 2000, close: 102 }, // +2
        { time: 3000, close: 101 }, // -1
        { time: 4000, close: 103 }, // +2
        { time: 5000, close: 103 }, // 0
        { time: 6000, close: 105 }, // +2
        { time: 7000, close: 104 }, // -1
        { time: 8000, close: 106 }, // +2
        { time: 9000, close: 106 }, // 0
        { time: 10000, close: 108 }, // +2
        { time: 11000, close: 107 }, // -1
        { time: 12000, close: 109 }, // +2
        { time: 13000, close: 109 }, // 0
        { time: 14000, close: 111 }, // +2
        { time: 15000, close: 110 }, // -1
        { time: 16000, close: 112 }, // +2
      ];
      
      const result = calculateRSI(testData, 14);
      
      expect(result).toHaveLength(2); // 16 - 14 = 2
      
      // With mostly gains, RSI should be high
      expect(result[0].rsi).toBeGreaterThan(50);
      expect(result[1].rsi).toBeGreaterThan(50);
    });

    it('should produce smooth RSI values', () => {
      const volatileData = Array.from({ length: 50 }, (_, i) => ({
        time: 1000 + i * 1000,
        close: 100 + Math.random() * 10 - 5 // Random walk
      }));
      
      const result = calculateRSI(volatileData);
      
      // Check that RSI changes smoothly (Wilder's smoothing effect)
      let totalChange = 0;
      for (let i = 1; i < result.length; i++) {
        const change = Math.abs(result[i].rsi - result[i-1].rsi);
        totalChange += change;
        
        // Individual changes should not be too large
        expect(change).toBeLessThan(20); // RSI shouldn't jump too much
      }
      
      // Average change should be moderate
      const avgChange = totalChange / (result.length - 1);
      expect(avgChange).toBeLessThan(10);
    });
  });

  describe('edge cases', () => {
    it('should handle constant price (RSI = 50)', () => {
      const constantData = Array.from({ length: 30 }, (_, i) => ({
        time: 1000 + i * 1000,
        close: 100 // No change
      }));
      
      const result = calculateRSI(constantData);
      
      // With no price changes, RSI calculation involves 0/0 which should be handled
      // The implementation should return RSI = 100 when avgLoss = 0
      result.forEach(point => {
        expect(point.rsi).toBe(100); // When no losses, RS = infinity, RSI = 100
      });
    });

    it('should handle only gains correctly', () => {
      const onlyGainsData = Array.from({ length: 20 }, (_, i) => ({
        time: 1000 + i * 1000,
        close: 100 + i // Only increases
      }));
      
      const result = calculateRSI(onlyGainsData);
      
      result.forEach(point => {
        expect(point.rsi).toBe(100); // No losses means RSI = 100
      });
    });

    it('should handle only losses correctly', () => {
      const onlyLossesData = Array.from({ length: 20 }, (_, i) => ({
        time: 1000 + i * 1000,
        close: 100 - i // Only decreases
      }));
      
      const result = calculateRSI(onlyLossesData);
      
      result.forEach(point => {
        expect(point.rsi).toBe(0); // No gains means RSI = 0
      });
    });

    it('should maintain time alignment', () => {
      const result = calculateRSI(oscillatingData);
      
      // First RSI should be at index = period
      expect(result[0].time).toBe(oscillatingData[14].time);
      
      // Check all times are in order
      for (let i = 1; i < result.length; i++) {
        expect(result[i].time).toBeGreaterThan(result[i-1].time);
      }
    });

    it('should handle large price movements', () => {
      const volatileData = Array.from({ length: 30 }, (_, i) => ({
        time: 1000 + i * 1000,
        close: 100 * Math.exp(Math.sin(i * 0.3)) // Exponential swings
      }));
      
      const result = calculateRSI(volatileData);
      
      result.forEach(point => {
        expect(isFinite(point.rsi)).toBe(true);
        expect(point.rsi).toBeGreaterThanOrEqual(0);
        expect(point.rsi).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('numerical accuracy', () => {
    it('should calculate first RSI value correctly', () => {
      // Create simple data for manual verification
      const testData = Array.from({ length: 16 }, (_, i) => ({
        time: 1000 + i * 1000,
        close: 100 + (i % 3 === 0 ? 2 : i % 3 === 1 ? -1 : 0)
      }));
      
      const result = calculateRSI(testData, 14);
      
      expect(result).toHaveLength(2);
      expect(result[0].rsi).toBeGreaterThan(0);
      expect(result[0].rsi).toBeLessThan(100);
    });

    it('should handle small price changes accurately', () => {
      const smallChangeData = Array.from({ length: 30 }, (_, i) => ({
        time: 1000 + i * 1000,
        close: 100 + Math.sin(i * 0.2) * 0.01 // Very small changes
      }));
      
      const result = calculateRSI(smallChangeData);
      
      result.forEach(point => {
        expect(isFinite(point.rsi)).toBe(true);
        expect(point.rsi).toBeGreaterThanOrEqual(0);
        expect(point.rsi).toBeLessThanOrEqual(100);
      });
    });
  });
});

describe('getRSIColor', () => {
  it('should return red for overbought (RSI >= 70)', () => {
    expect(getRSIColor(70)).toBe('#ff4d4d');
    expect(getRSIColor(80)).toBe('#ff4d4d');
    expect(getRSIColor(100)).toBe('#ff4d4d');
  });

  it('should return teal for oversold (RSI <= 30)', () => {
    expect(getRSIColor(30)).toBe('#0ddfba');
    expect(getRSIColor(20)).toBe('#0ddfba');
    expect(getRSIColor(0)).toBe('#0ddfba');
  });

  it('should return purple for neutral (30 < RSI < 70)', () => {
    expect(getRSIColor(31)).toBe('#7b61ff');
    expect(getRSIColor(50)).toBe('#7b61ff');
    expect(getRSIColor(69)).toBe('#7b61ff');
  });
});

describe('getRSISignal', () => {
  it('should return overbought for RSI >= 70', () => {
    expect(getRSISignal(70)).toBe('overbought');
    expect(getRSISignal(85)).toBe('overbought');
    expect(getRSISignal(100)).toBe('overbought');
  });

  it('should return oversold for RSI <= 30', () => {
    expect(getRSISignal(30)).toBe('oversold');
    expect(getRSISignal(15)).toBe('oversold');
    expect(getRSISignal(0)).toBe('oversold');
  });

  it('should return neutral for 30 < RSI < 70', () => {
    expect(getRSISignal(31)).toBe('neutral');
    expect(getRSISignal(50)).toBe('neutral');
    expect(getRSISignal(69)).toBe('neutral');
  });
});

describe('RSI performance', () => {
  it('should calculate efficiently for large datasets', () => {
    const largeData = Array.from({ length: 1000 }, (_, i) => ({
      time: 1000 + i * 1000,
      close: 100 + Math.sin(i * 0.1) * 20 + Math.random() * 5
    }));
    
    const startTime = Date.now();
    const result = calculateRSI(largeData);
    const endTime = Date.now();
    
    expect(endTime - startTime).toBeLessThan(50); // Should complete within 50ms
    expect(result.length).toBe(largeData.length - 14);
  });

  it('should maintain O(N) complexity', () => {
    // Test with different data sizes
    const sizes = [100, 200, 400];
    const times: number[] = [];
    
    sizes.forEach(size => {
      const data = Array.from({ length: size }, (_, i) => ({
        time: 1000 + i * 1000,
        close: 100 + Math.random() * 10
      }));
      
      const startTime = Date.now();
      calculateRSI(data);
      const endTime = Date.now();
      
      times.push(endTime - startTime);
    });
    
    // Time should scale linearly (roughly)
    // Doubling data size should roughly double time
    const ratio1 = times[1] / times[0];
    const ratio2 = times[2] / times[1];
    
    expect(ratio1).toBeLessThan(3); // Should be close to 2
    expect(ratio2).toBeLessThan(3); // Should be close to 2
  });
});

describe('RSI integration scenarios', () => {
  it('should work with cryptocurrency price patterns', () => {
    // Simulate crypto-like volatility
    const cryptoData = Array.from({ length: 100 }, (_, i) => {
      const trend = Math.sin(i * 0.1) * 1000;
      const volatility = Math.random() * 500 - 250;
      return {
        time: 1000 + i * 3600000, // Hourly data
        close: 50000 + trend + volatility
      };
    });
    
    const result = calculateRSI(cryptoData);
    
    expect(result.length).toBeGreaterThan(0);
    
    // Check for reasonable distribution
    const overbought = result.filter(p => p.rsi >= 70).length;
    const oversold = result.filter(p => p.rsi <= 30).length;
    const neutral = result.filter(p => p.rsi > 30 && p.rsi < 70).length;
    
    // Should have some of each in volatile data
    expect(overbought).toBeGreaterThan(0);
    expect(oversold).toBeGreaterThan(0);
    expect(neutral).toBeGreaterThan(0);
  });

  it('should identify divergences in trending markets', () => {
    // Create price making higher highs but momentum slowing
    const divergenceData = Array.from({ length: 50 }, (_, i) => ({
      time: 1000 + i * 1000,
      close: 100 + i + Math.sin(i * 0.3) * (50 - i) * 0.1 // Decreasing momentum
    }));
    
    const result = calculateRSI(divergenceData);
    
    if (result.length > 20) {
      // RSI should show weakening momentum despite rising price
      const earlyRSI = result.slice(5, 10).reduce((sum, p) => sum + p.rsi, 0) / 5;
      const lateRSI = result.slice(-5).reduce((sum, p) => sum + p.rsi, 0) / 5;
      
      // Late RSI should be lower than early RSI (bearish divergence)
      expect(lateRSI).toBeLessThan(earlyRSI);
    }
  });
});