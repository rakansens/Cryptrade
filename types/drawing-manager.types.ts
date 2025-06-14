/**
 * Type definitions for drawing manager
 */

import type { DrawingStyle } from '@/types/ui-events.types';

export interface DrawingMetadata {
  createdAt?: number;
  modifiedAt?: number;
  [key: string]: unknown;
}

export interface DrawingItem {
  id: string;
  isPattern: boolean;
  idx: number;
  color: string;
  direction: 'up' | 'down' | null;
  createdAt?: number;
}

export interface DrawingWithMetadata {
  id: string;
  type: string;
  points: Array<{ time: number; value: number }>;
  style?: DrawingStyle;
  metadata?: DrawingMetadata;
}

export interface PatternItem {
  id: string;
  type: string;
  visualization: unknown;
  metrics?: unknown;
}