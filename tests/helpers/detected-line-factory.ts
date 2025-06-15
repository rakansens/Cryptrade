import type { DetectedLine } from '@/lib/analysis/multi-timeframe-line-detector';

/**
 * Factory for creating test DetectedLine objects
 */
export function createTestDetectedLine(overrides: Partial<DetectedLine> = {}): DetectedLine {
  const now = Date.now();
  const defaultLine: DetectedLine = {
    id: 'test-line-' + Math.random().toString(36).substr(2, 9),
    type: 'support', // Valid types: 'support' | 'resistance' | 'trendline'
    price: 50000,
    strength: 0.8,
    confidence: 0.85,
    touchCount: 3,
    supportingTimeframes: ['1h'],
    firstDetected: now - 86400000, // 24 hours ago
    lastTouched: now - 3600000, // 1 hour ago
    points: [],
    metadata: {
      algorithm: 'multi-timeframe',
      version: '1.0.0',
      calculatedAt: now,
      crossTimeframeValidation: 0.9,
      volatilityAdjusted: true
    }
  };

  // Merge with overrides
  const line = { ...defaultLine, ...overrides };

  // If touchPoints were provided in overrides (legacy format), convert to points
  if ('touchPoints' in overrides && Array.isArray(overrides.touchPoints)) {
    line.points = overrides.touchPoints.map((tp: any) => ({
      time: tp.time,
      price: tp.value || tp.price || line.price,
      timeframe: '1h'
    }));
  }

  // Ensure points array is populated if empty
  if (line.points.length === 0) {
    line.points = Array.from({ length: line.touchCount }, (_, i) => ({
      time: line.firstDetected + (i * 3600000), // 1 hour intervals
      price: line.price,
      timeframe: line.supportingTimeframes[0] || '1h'
    }));
  }

  return line;
}

/**
 * Create a support line for testing
 */
export function createTestSupportLine(price: number, overrides: Partial<DetectedLine> = {}): DetectedLine {
  return createTestDetectedLine({
    type: 'support',
    price,
    ...overrides
  });
}

/**
 * Create a resistance line for testing
 */
export function createTestResistanceLine(price: number, overrides: Partial<DetectedLine> = {}): DetectedLine {
  return createTestDetectedLine({
    type: 'resistance',
    price,
    ...overrides
  });
}

/**
 * Create a trendline for testing
 */
export function createTestTrendline(startPrice: number, endPrice: number, overrides: Partial<DetectedLine> = {}): DetectedLine {
  const now = Date.now();
  const startTime = now - 86400000; // 24 hours ago
  const endTime = now;
  
  return createTestDetectedLine({
    type: 'trendline',
    price: (startPrice + endPrice) / 2, // Average price
    points: [
      { time: startTime, price: startPrice, timeframe: '1h' },
      { time: endTime, price: endPrice, timeframe: '1h' }
    ],
    ...overrides
  });
}