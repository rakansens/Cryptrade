import type { DetectedLine } from '@/lib/analysis/types';

/**
 * Factory for creating simple test DetectedLine objects (analysis/types version)
 */
export function createSimpleTestLine(overrides: Partial<DetectedLine> = {}): DetectedLine {
  const defaultLine: DetectedLine = {
    type: 'horizontal',
    price: 50000,
    touchPoints: [],
    confidence: 0.85,
    timeframe: '1h'
  };

  return { ...defaultLine, ...overrides };
}

/**
 * Create a horizontal support/resistance line
 */
export function createSimpleHorizontalLine(price: number, overrides: Partial<DetectedLine> = {}): DetectedLine {
  return createSimpleTestLine({
    type: 'horizontal',
    price,
    ...overrides
  });
}

/**
 * Create a support line
 */
export function createSimpleSupportLine(price: number, overrides: Partial<DetectedLine> = {}): DetectedLine {
  return createSimpleTestLine({
    type: 'support',
    price,
    ...overrides
  });
}

/**
 * Create a resistance line
 */
export function createSimpleResistanceLine(price: number, overrides: Partial<DetectedLine> = {}): DetectedLine {
  return createSimpleTestLine({
    type: 'resistance',
    price,
    ...overrides
  });
}