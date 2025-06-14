/**
 * Type definitions for proposal generators
 */

import type { DrawingPoint, DrawingStyle } from '@/types/ui-events.types';

export interface ProposalData {
  id: string;
  type: string;
  title: string;
  description: string;
  confidence: number;
  priority: 'high' | 'medium' | 'low';
  drawingData: {
    type: string;
    points: DrawingPoint[];
    style?: DrawingStyle;
    metadata?: Record<string, unknown>;
  };
  analysis: {
    direction?: 'bullish' | 'bearish' | 'neutral';
    strength?: number;
    touches?: number;
    angle?: number;
    length?: number;
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown>;
}

export interface ConfidenceFactors {
  baseFactor: number;
  touchFactor?: number;
  lengthFactor?: number;
  volumeFactor?: number;
  timeFactor?: number;
  [key: string]: number | undefined;
}

export interface ConfidenceResult {
  confidence: number;
  factors: ConfidenceFactors;
}

export interface TrendlineCandidate {
  points: DrawingPoint[];
  touches: number;
  angle: number;
  strength: number;
  type: 'support' | 'resistance';
}