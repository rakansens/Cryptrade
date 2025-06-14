// ML-based line validation types and interfaces

export interface LineValidationData {
  // Line information
  lineId: string;
  type: 'support' | 'resistance' | 'trendline' | 'horizontal' | 'fibonacci';
  detectedAt: number; // Unix timestamp
  symbol: string;
  interval: string;
  price: number;

  // Line features for ML
  features: LineFeatures;

  // Outcome (recorded later)
  outcome?: LineOutcome;
}

export interface LineFeatures {
  // Basic features
  touchCount: number;
  rSquared: number;
  confidence: number;
  
  // Touch point quality
  wickTouchRatio: number;     // Ratio of wick touches vs body touches
  bodyTouchRatio: number;     // Ratio of body touches
  exactTouchRatio: number;    // Ratio of exact price touches
  
  // Volume features
  volumeAverage: number;      // Average volume at touch points
  volumeMax: number;          // Max volume at touch points
  volumeStrength: number;     // Volume relative to average
  
  // Time features
  ageInCandles: number;       // How old the line is
  recentTouchCount: number;   // Touches in last N candles
  timeSinceLastTouch: number; // Candles since last touch
  
  // Market context
  marketCondition: 'trending' | 'ranging' | 'volatile';
  trendStrength: number;      // -1 to 1 (bearish to bullish)
  volatility: number;         // Normalized volatility
  timeOfDay: number;          // Hour in UTC
  dayOfWeek: number;          // 0-6 (Sunday to Saturday)
  
  // Multi-timeframe confluence
  timeframeConfluence: number; // 0-1 score
  higherTimeframeAlignment: boolean;
  
  // Pattern context
  nearPattern: boolean;       // Is there a pattern nearby
  patternType?: string;       // Type of nearby pattern
  
  // Price context
  distanceFromPrice: number;  // Current distance from line
  priceRoundness: number;     // How round the number is (50000 vs 50123)
  nearPsychological: boolean; // Near round number
}

export interface LineOutcome {
  wasRespected: boolean;      // Did the line hold
  bounceCount: number;        // Number of bounces
  breakoutStrength?: number;  // If broken, how strong
  profitLoss?: number;        // PnL if traded
  holdDuration?: number;      // How long it held
  finalResult: 'success' | 'failure' | 'partial';
}

export interface MLPrediction {
  successProbability: number;     // 0-1 probability
  expectedBounces: number;        // Predicted bounce count
  confidenceInterval: [number, number]; // Confidence range
  riskScore: number;              // 0-1 risk assessment
  suggestedStopLoss?: number;     // ML suggested SL
  suggestedTakeProfit?: number;   // ML suggested TP
  reasoning: MLReasoning[];       // Explanation
}

export interface MLReasoning {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  category: 'basic' | 'volume' | 'time' | 'market' | 'pattern';
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  lastUpdated: number;
  trainingSamples: number;
  version: string;
}

export interface StreamingMLUpdate {
  stage: 'collecting' | 'extracting' | 'predicting' | 'analyzing' | 'complete';
  progress: number; // 0-100
  currentStep: string;
  details?: {
    featuresExtracted?: number;
    importantFeatures?: string[];
    preliminaryScore?: number;
    processingTime?: number;
  };
}

// Currency pair specific configurations
export interface CurrencyPairMLConfig {
  symbol: string;
  roundNumberBonus: number;      // Bonus for round prices
  weekendReliability: number;    // Weekend trading reliability
  newsImpactMultiplier: number;  // News event sensitivity
  liquidityThreshold: number;     // Min volume for validity
  customFeatures?: Record<string, number>;
}

// Feature normalization ranges
export const FEATURE_RANGES = {
  touchCount: { min: 2, max: 20 },
  rSquared: { min: 0, max: 1 },
  confidence: { min: 0, max: 1 },
  wickTouchRatio: { min: 0, max: 1 },
  bodyTouchRatio: { min: 0, max: 1 },
  exactTouchRatio: { min: 0, max: 1 },
  volumeAverage: { min: 0, max: 10000 },
  volumeMax: { min: 0, max: 50000 },
  volumeStrength: { min: 0, max: 5 },
  ageInCandles: { min: 0, max: 500 },
  recentTouchCount: { min: 0, max: 10 },
  timeSinceLastTouch: { min: 0, max: 100 },
  trendStrength: { min: -1, max: 1 },
  volatility: { min: 0, max: 1 },
  timeOfDay: { min: 0, max: 23 },
  dayOfWeek: { min: 0, max: 6 },
  timeframeConfluence: { min: 0, max: 1 },
  distanceFromPrice: { min: 0, max: 0.1 },
  priceRoundness: { min: 0, max: 1 }
} as const;