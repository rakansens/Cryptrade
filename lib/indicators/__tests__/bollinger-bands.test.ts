import { calculateBollingerBands } from '../bollinger-bands';

// Simple test data for verification
const testData = [
  { time: 1 as any, close: 10 },
  { time: 2 as any, close: 12 },
  { time: 3 as any, close: 14 },
  { time: 4 as any, close: 16 },
  { time: 5 as any, close: 18 },
  { time: 6 as any, close: 20 },
  { time: 7 as any, close: 22 },
];

describe('calculateBollingerBands', () => {
  test('calculates Bollinger Bands correctly for period=3', () => {
    const result = calculateBollingerBands(testData, 3, 2);
    
    expect(result).toHaveLength(5); // 7 - 3 + 1
    
    // Verify first calculation manually
    // Values: [10, 12, 14], SMA = 12, StdDev ≈ 1.63
    const first = result[0];
    expect(first.time).toBe(3);
    expect(first.middle).toBeCloseTo(12, 2);
    expect(first.upper).toBeGreaterThan(first.middle);
    expect(first.lower).toBeLessThan(first.middle);
    
    // Verify structure
    expect(first.upper).toBeCloseTo(12 + 2 * Math.sqrt((4 + 0 + 4) / 3), 2);
    expect(first.lower).toBeCloseTo(12 - 2 * Math.sqrt((4 + 0 + 4) / 3), 2);
  });

  test('returns empty array when insufficient data', () => {
    const result = calculateBollingerBands(testData.slice(0, 2), 3, 2);
    expect(result).toHaveLength(0);
  });

  test('verifies band relationships', () => {
    const result = calculateBollingerBands(testData, 3, 2);
    
    result.forEach(point => {
      expect(point.upper).toBeGreaterThan(point.middle);
      expect(point.middle).toBeGreaterThan(point.lower);
      expect(point.upper - point.middle).toBeCloseTo(point.middle - point.lower, 5);
    });
  });

  test('verifies O(N) optimization consistency', () => {
    // Test with varying stdDev multipliers
    const result1 = calculateBollingerBands(testData, 3, 1);
    const result2 = calculateBollingerBands(testData, 3, 2);
    
    expect(result1).toHaveLength(result2.length);
    
    // Compare middle lines (should be identical)
    result1.forEach((point, i) => {
      expect(point.middle).toBeCloseTo(result2[i].middle, 10);
      
      // Band width should be proportional to stdDev multiplier
      const width1 = point.upper - point.lower;
      const width2 = result2[i].upper - result2[i].lower;
      expect(width2).toBeCloseTo(width1 * 2, 5);
    });
  });
});