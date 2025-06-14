/**
 * Proposal Generation Constants
 * 
 * マジックナンバーを定数化し、設定を一元管理
 */

// ========================================
// 分析パラメータ
// ========================================

export const ANALYSIS_PARAMS = {
  /**
   * データポイント数
   */
  MAX_KLINES: 1000,
  DEFAULT_KLINES: 500,
  
  /**
   * ピーク/トラフ検出
   */
  PEAK_WINDOW_SIZE: 10,
  PEAK_MIN_PROMINENCE: 0.001, // 0.1%
  
  /**
   * トレンドライン
   */
  TRENDLINE_MIN_POINTS: 2,
  TRENDLINE_MAX_POINTS: 10,
  TRENDLINE_MIN_TIMESPAN: 10, // 最小10本のキャンドル
  TRENDLINE_MAX_TIMESPAN: 200, // 最大200本
  
  /**
   * サポート/レジスタンス
   */
  SUPPORT_RESISTANCE_ZONES: 5,
  SUPPORT_RESISTANCE_TOLERANCE: 0.002, // 0.2%
  
  /**
   * フィボナッチ
   */
  FIBONACCI_LEVELS: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1],
  FIBONACCI_EXTENSION_LEVELS: [1.272, 1.414, 1.618, 2.0, 2.618],
  
  /**
   * パターン認識
   */
  PATTERN_MIN_CONFIDENCE: 0.7,
  PATTERN_LOOKBACK_PERIODS: 50,
} as const;

// ========================================
// スコアリング重み
// ========================================

export const SCORING_WEIGHTS = {
  /**
   * トレンドラインスコア
   */
  TRENDLINE: {
    TIME_SPAN: 0.4,
    VOLUME: 0.4,
    RECENCY: 0.2,
  },
  
  /**
   * 信頼度計算
   */
  CONFIDENCE: {
    BASE: 0.2,
    TOUCHES: 0.15,
    VOLUME: 0.15,
    TIMESPAN: 0.1,
    R_SQUARED: 0.1,
    PATTERN: 0.1,
    MTF_ALIGNMENT: 0.1,
    RECENT_ACTIVITY: 0.1,
  },
  
  /**
   * サポート/レジスタンス
   */
  SUPPORT_RESISTANCE: {
    TOUCH_COUNT: 0.3,
    VOLUME: 0.25,
    RECENCY: 0.25,
    STRENGTH: 0.2,
  },
} as const;

// ========================================
// 時間関連
// ========================================

export const TIME_CONSTANTS = {
  /**
   * 最新判定（キャンドル本数）
   */
  RECENT_CANDLES: 20,
  
  /**
   * タイムフレーム変換
   */
  INTERVAL_TO_MINUTES: {
    '1m': 1,
    '3m': 3,
    '5m': 5,
    '15m': 15,
    '30m': 30,
    '1h': 60,
    '2h': 120,
    '4h': 240,
    '6h': 360,
    '8h': 480,
    '12h': 720,
    '1d': 1440,
    '3d': 4320,
    '1w': 10080,
    '1M': 43200,
  } as const,
  
  /**
   * 上位タイムフレーム
   */
  HIGHER_TIMEFRAMES: {
    '1m': '15m',
    '3m': '15m',
    '5m': '30m',
    '15m': '1h',
    '30m': '2h',
    '1h': '4h',
    '2h': '8h',
    '4h': '1d',
    '6h': '1d',
    '8h': '3d',
    '12h': '3d',
    '1d': '1w',
  } as const,
} as const;

// ========================================
// 閾値
// ========================================

export const THRESHOLDS = {
  /**
   * 信頼度
   */
  MIN_CONFIDENCE: 0.3,
  HIGH_CONFIDENCE: 0.7,
  
  /**
   * ボリューム
   */
  HIGH_VOLUME_RATIO: 1.5,
  LOW_VOLUME_RATIO: 0.5,
  
  /**
   * 角度（度）
   */
  FLAT_ANGLE: 5,
  STEEP_ANGLE: 45,
  
  /**
   * R二乗値
   */
  GOOD_FIT_R_SQUARED: 0.8,
  ACCEPTABLE_FIT_R_SQUARED: 0.6,
  
  /**
   * アウトライア
   */
  MAX_OUTLIER_RATIO: 0.2, // 20%以下
} as const;

// ========================================
// 優先度設定
// ========================================

export const PRIORITY_RULES = {
  /**
   * 高優先度の条件
   */
  HIGH: {
    MIN_CONFIDENCE: 0.8,
    MIN_TOUCHES: 5,
    RECENT_ACTIVITY: true,
    MTF_ALIGNMENT: true,
  },
  
  /**
   * 中優先度の条件
   */
  MEDIUM: {
    MIN_CONFIDENCE: 0.6,
    MIN_TOUCHES: 3,
  },
  
  /**
   * デフォルトは低優先度
   */
  DEFAULT: 'low',
} as const;

// ========================================
// 色設定
// ========================================

export const COLOR_PALETTE = {
  /**
   * トレンドライン
   */
  TRENDLINE: {
    UPTREND: '#00ff00',
    DOWNTREND: '#ff0000',
    NEUTRAL: '#888888',
  },
  
  /**
   * サポート/レジスタンス
   */
  SUPPORT_RESISTANCE: {
    SUPPORT: '#00ff00',
    RESISTANCE: '#ff0000',
    ZONE: '#ffff00',
  },
  
  /**
   * フィボナッチ
   */
  FIBONACCI: {
    RETRACEMENT: '#ff9800',
    EXTENSION: '#9c27b0',
  },
  
  /**
   * パターン
   */
  PATTERN: {
    BULLISH: '#00ff00',
    BEARISH: '#ff0000',
    NEUTRAL: '#888888',
  },
} as const;

// ========================================
// メッセージテンプレート
// ========================================

export const MESSAGE_TEMPLATES = {
  /**
   * トレンドライン
   */
  TRENDLINE: {
    TITLE: (type: string) => `${type === 'uptrend' ? '上昇' : '下降'}トレンドライン`,
    DESCRIPTION: (touches: number, confidence: number) => 
      `${touches}回のタッチポイントを持つトレンドライン (信頼度: ${Math.round(confidence * 100)}%)`,
    REASONING: (factors: Record<string, unknown>) => 
      `ボリューム分析と価格アクションに基づく${factors.pattern ? 'パターン認識あり' : ''}`,
  },
  
  /**
   * サポート/レジスタンス
   */
  SUPPORT_RESISTANCE: {
    TITLE: (type: string, price: number) => 
      `${type === 'support' ? 'サポート' : 'レジスタンス'}ライン @ ${price.toFixed(2)}`,
    DESCRIPTION: (touches: number, strength: string) => 
      `${touches}回テストされた${strength}ライン`,
  },
  
  /**
   * エラーメッセージ
   */
  ERROR: {
    NO_DATA: 'No market data available',
    INVALID_PARAMS: 'Invalid parameters provided',
    GENERATION_FAILED: 'Failed to generate proposals',
  },
} as const;

// Type exports
export type IntervalType = keyof typeof TIME_CONSTANTS.INTERVAL_TO_MINUTES;
export type HigherTimeframeMap = typeof TIME_CONSTANTS.HIGHER_TIMEFRAMES;