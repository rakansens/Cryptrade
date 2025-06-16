import { calculateSMA } from '@/lib/indicators/moving-average';
import type { UTCTimestamp } from 'lightweight-charts';

// Test data - simple case for easy verification
const testData = [
  { time: 1 as UTCTimestamp, close: 10 },
  { time: 2 as UTCTimestamp, close: 20 },
  { time: 3 as UTCTimestamp, close: 30 },
  { time: 4 as UTCTimestamp, close: 40 },
  { time: 5 as UTCTimestamp, close: 50 },
  { time: 6 as UTCTimestamp, close: 60 },
];

describe('calculateSMA', () => {
  test('calculates SMA(3) correctly', () => {
    const result = calculateSMA(testData, 3);
    
    expect(result).toHaveLength(4);
    
    // First SMA: (10+20+30)/3 = 20
    expect(result[0]?.value).toBe(20);
    expect(result[0]?.time).toBe(3);
    
    // Second SMA: (20+30+40)/3 = 30
    expect(result[1]?.value).toBe(30);
    expect(result[1]?.time).toBe(4);
    
    // Third SMA: (30+40+50)/3 = 40
    expect(result[2]?.value).toBe(40);
    expect(result[2]?.time).toBe(5);
    
    // Fourth SMA: (40+50+60)/3 = 50
    expect(result[3]?.value).toBe(50);
    expect(result[3]?.time).toBe(6);
  });

  test('returns empty array when insufficient data', () => {
    const result = calculateSMA(testData.slice(0, 2), 3);
    expect(result).toHaveLength(0);
  });

  test('handles single period correctly', () => {
    const result = calculateSMA([{ time: 1 as UTCTimestamp, close: 42 }], 1);
    expect(result).toHaveLength(1);
    expect(result[0]?.value).toBe(42);
  });

  test('verifies O(N) optimization consistency', () => {
    // Test with larger dataset to ensure optimization doesn't break correctness
    const largeData = Array.from({ length: 100 }, (_: unknown, i: number) => ({
      time: (i + 1) as UTCTimestamp,
      close: i + 1
    }));
    
    const result = calculateSMA(largeData, 5);
    
    // Verify first few values manually
    expect(result[0]?.value).toBe(3); // (1+2+3+4+5)/5
    expect(result[1]?.value).toBe(4); // (2+3+4+5+6)/5
    expect(result[2]?.value).toBe(5); // (3+4+5+6+7)/5
    
    // Verify last value
    expect(result[result.length - 1]?.value).toBe(98); // (96+97+98+99+100)/5
  });
});