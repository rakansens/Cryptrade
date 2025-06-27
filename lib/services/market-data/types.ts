/**
 * Market Data Microservices Type Definitions
 * 
 * Enhanced型安全性とマイクロサービス間の契約定義
 */

import type { ProcessedKline } from '@/types/market';

// KlineData is an alias for ProcessedKline for consistency across services
export type KlineData = ProcessedKline;

// ============================================================================
// Core Configuration Types
// ============================================================================

export interface TimeframeConfig {
  interval: string;
  weight: number;
  dataPoints: number;
}

export interface FetchOptions {
  timeoutMs?: number;
  retryAttempts?: number;
  exponentialBackoff?: boolean;
}

// ============================================================================
// Data Fetcher Service Types
// ============================================================================

export interface TimeframeData {
  data: ProcessedKline[];
  weight: number;
  dataPoints: number;
  fetchedAt: number;
}

export interface ParallelFetchResult {
  symbol: string;
  data: Record<string, TimeframeData>;
  totalFetchTime: number;
  successCount: number;
  failureCount: number;
}

// ============================================================================
// Cache Manager Service Types
// ============================================================================

export interface CacheEntry<T = any> {
  data: T;
  createdAt: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  size: number;
  hitRate: number;
  memoryUsage: number;
  expiredEntries: number;
  oldestEntry: number;
  newestEntry: number;
  entries?: Array<{
    key: string;
    size: number;
    age: number;
    accessCount: number;
  }>;
  hitRatio?: number;
}

export interface CacheConfig {
  maxSize: number;
  defaultTtlMs: number;
  cleanupIntervalMs: number;
  evictionPolicy?: 'lru' | 'oldest';
  memoryThreshold?: number;
}

export type CacheEvictionPolicy = 'lru' | 'oldest';

export interface MarketDataCacheKey {
  symbol: string;
  timeframe: string;
  operation: string;
  params?: Record<string, any>;
}

export interface CacheManagerServiceInterface {
  get<T>(key: MarketDataCacheKey, signal?: AbortSignal): Promise<T | null>;
  set<T>(key: MarketDataCacheKey, data: T, ttl?: number, signal?: AbortSignal): Promise<void>;
  delete(key: MarketDataCacheKey, signal?: AbortSignal): Promise<boolean>;
  clear(signal?: AbortSignal): Promise<void>;
  has(key: MarketDataCacheKey, signal?: AbortSignal): Promise<boolean>;
  getStats(signal?: AbortSignal): Promise<CacheStats>;
  cleanup(signal?: AbortSignal): Promise<number>;
  destroy(): void;
}

// ============================================================================
// Analysis Engine Service Types
// ============================================================================

export interface SupportResistanceLevel {
  price: number;
  strength: number;
  touchCount: number;
  timeframeSupport: string[];
  confidenceScore: number;
  firstSeen: number;
  lastSeen: number;
  type: 'support' | 'resistance';
  // Additional properties for backwards compatibility
  timeframe?: string;
  firstTouch?: Date;
  lastTouch?: Date;
  confidence?: number;
}

export interface ConfluenceZone {
  priceRange: {
    min: number;
    max: number;
    center?: number;
  };
  strength: number;
  timeframeCount: number;
  supportingTimeframes: string[];
  levels: SupportResistanceLevel[];
  type: 'support' | 'resistance' | 'pivot';
  // Additional properties for backwards compatibility
  confidence?: number;
  timeframe?: string;
}

export interface AnalysisOptions {
  minTouchCount?: number;
  priceTolerancePercent?: number;
  minTimeframes?: number;
  zoneWidthPercent?: number;
}

// ============================================================================
// Aggregator Service Types
// ============================================================================

export interface GroupingResult<T> {
  groups: T[][];
  metadata: {
    totalItems: number;
    groupCount: number;
    avgGroupSize: number;
    processingTimeMs: number;
  };
}

export interface SimilarityMatcher<T> {
  calculate: (a: T, b: T) => number;
  threshold: number;
}

// ============================================================================
// Validator Service Types  
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  score: number;
  errors: string[];
  warnings: string[];
  metadata: {
    validatedAt: number;
    validationDurationMs: number;
  };
}

export interface SwingPoint {
  price: number;
  time: number;
  type: 'support' | 'resistance';
  index: number;
  strength: number;
}

export interface StatisticalMetrics {
  mean: number;
  standardDeviation: number;
  variance: number;
  skewness: number;
  kurtosis: number;
}

// ============================================================================
// Technical Indicators Types
// ============================================================================

export interface RSIIndicator {
  value: number;
  period: number;
  signal: 'overbought' | 'oversold' | 'neutral';
  timestamp: Date;
}

export interface MACDIndicator {
  macd: number;
  signal: number;
  histogram: number;
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
}

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
  period: number;
  standardDeviation: number;
}

export interface MovingAverages {
  sma20: number;
  sma50: number;
  ema20: number;
  ema50: number;
}

export interface TechnicalIndicators {
  rsi: RSIIndicator;
  macd: MACDIndicator;
  bollingerBands: BollingerBands;
  movingAverages: MovingAverages;
}

// ============================================================================
// Swing Point Detection Types
// ============================================================================

export interface SwingPointDetectionResult {
  swingPoints: SupportResistanceLevel[];
  processingTimeMs: number;
  algorithmComplexity: string;
  totalPoints: number;
  timeframe: string;
  sensitivity: number;
}

export interface PriceLevelAnalysis {
  confluenceZones: ConfluenceZone[];
  isolatedLevels: SupportResistanceLevel[];
  averageStrength: number;
  totalLevels: number;
}

export interface StatisticalAnalysis {
  mean: number;
  median: number;
  standardDeviation: number;
  variance: number;
  skewness: number;
  kurtosis: number;
  min: number;
  max: number;
  range: number;
  sampleSize: number;
}

export interface OutlierDetection {
  outlierIndices: number[];
  outlierValues: number[];
  zScores: number[];
  threshold: number;
  totalOutliers: number;
  outlierPercentage: number;
}

// ============================================================================
// Multi-Timeframe Integration Types
// ============================================================================

export interface MultiTimeframeData {
  symbol: string;
  timeframes: Record<string, TimeframeData>;
  fetchedAt: number;
  cacheKey: string;
}

export interface CrossTimeframeValidation {
  validationScore: number;
  supportingTimeframes: string[];
  touchCounts: Record<string, number>;
  avgStrength: number;
  metadata: {
    calculatedAt: number;
    tolerancePercent: number;
  };
}

// ============================================================================
// Analysis Engine Result Types (for Orchestrator)
// ============================================================================

export interface AnalysisResult {
  swingPoints: SwingPointDetectionResult;
  priceAnalysis: PriceLevelAnalysis;
  technicalIndicators: TechnicalIndicators;
  statisticalAnalysis: StatisticalAnalysis;
  outlierDetection: OutlierDetection;
  processingTimeMs: number;
}

export interface AggregatedData {
  symbol: string;
  timeframes: Record<string, TimeframeData>;
  consolidatedData: ProcessedKline[];
  aggregationMetrics: {
    totalVolume: number;
    avgPrice: number;
    priceRange: { min: number; max: number };
    volatility: number;
    crossTimeframeStrength: number;
  };
  processingTimeMs: number;
}