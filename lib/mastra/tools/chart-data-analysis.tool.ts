import { createTool } from '@mastra/core';
import { z } from 'zod';
import { logger } from '../../utils/logger';

// Type definitions for chart data analysis
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalAnalysis {
  trend: {
    direction: 'bullish' | 'bearish' | 'sideways';
    strength: number;
    confidence: number;
    trendlines?: Array<{
      type: 'support' | 'resistance' | 'trend';
      points: Array<{ time: number; price: number }>;
      strength: number;
      touchPoints: number;
    }>;
  };
  momentum: {
    rsi: number;
    macd: {
      macd: number;
      signal: number;
      histogram: number;
    };
  };
  volatility: {
    atr: number;
    atrPercent: number;
    volatilityLevel: 'high' | 'medium' | 'low';
  };
  supportResistance: {
    supports: Array<{
      price: number;
      strength: number;
      touchCount: number;
      lastTouch: number;
    }>;
    resistances: Array<{
      price: number;
      strength: number;
      touchCount: number;
      lastTouch: number;
    }>;
  };
  movingAverages: {
    ma20?: number;
    ma50?: number;
    ema12?: number;
    ema26?: number;
  };
}

export interface Pattern {
  type: string;
  confidence: number;
  timeframe: string;
  description: string;
}

/**
 * Advanced Chart Data Analysis Tool
 * 
 * エージェントが現在表示されているチャートの詳細データを取得・分析するツール
 * - 時間足対応のローソク足データ取得
 * - 技術分析指標の計算
 * - サポート・レジスタンス自動検出
 * - トレンド分析とパターン認識
 */

const ChartDataAnalysisInput = z.object({
  symbol: z.string().optional().describe('Trading symbol (e.g., BTCUSDT). If not provided, uses current chart symbol'),
  timeframe: z.string().optional().describe('Timeframe (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w). If not provided, uses current chart timeframe'),
  limit: z.number().min(10).max(1000).default(200).describe('Number of candles to analyze'),
  analysisType: z.enum(['full', 'trend', 'support_resistance', 'patterns', 'volatility']).default('full'),
  lookbackPeriod: z.number().min(20).max(500).default(100).describe('Period for technical analysis calculations'),
});

const ChartDataAnalysisOutput = z.object({
  symbol: z.string(),
  timeframe: z.string(),
  dataRange: z.object({
    startTime: z.number(),
    endTime: z.number(),
    candleCount: z.number(),
  }),
  currentPrice: z.object({
    price: z.number(),
    timestamp: z.number(),
    change24h: z.number().optional(),
    changePercent24h: z.number().optional(),
  }),
  technicalAnalysis: z.object({
    trend: z.object({
      direction: z.enum(['bullish', 'bearish', 'sideways']),
      strength: z.number().min(0).max(1),
      confidence: z.number().min(0).max(1),
      trendlines: z.array(z.object({
        type: z.enum(['support', 'resistance', 'trend']),
        points: z.array(z.object({
          time: z.number(),
          price: z.number(),
        })),
        strength: z.number().min(0).max(1),
        touchPoints: z.number(),
      })).optional(),
    }),
    supportResistance: z.object({
      supports: z.array(z.object({
        price: z.number(),
        strength: z.number().min(0).max(1),
        touchCount: z.number(),
        lastTouch: z.number(),
      })),
      resistances: z.array(z.object({
        price: z.number(),
        strength: z.number().min(0).max(1),
        touchCount: z.number(),
        lastTouch: z.number(),
      })),
    }),
    volatility: z.object({
      atr: z.number(),
      volatilityLevel: z.enum(['low', 'medium', 'high']),
      atrPercent: z.number(),
    }),
    momentum: z.object({
      rsi: z.number().min(0).max(100),
      macd: z.object({
        macd: z.number(),
        signal: z.number(),
        histogram: z.number(),
      }),
      stochastic: z.object({
        k: z.number(),
        d: z.number(),
      }).optional(),
    }),
    movingAverages: z.object({
      ma20: z.number().optional(),
      ma50: z.number().optional(),
      ma200: z.number().optional(),
      ema12: z.number().optional(),
      ema26: z.number().optional(),
    }),
  }),
  patterns: z.array(z.object({
    type: z.string(),
    confidence: z.number().min(0).max(1),
    timeframe: z.string(),
    description: z.string(),
    targetPrice: z.number().optional(),
    stopLoss: z.number().optional(),
  })).optional(),
  recommendations: z.object({
    trendlineDrawing: z.array(z.object({
      type: z.enum(['trendline', 'fibonacci', 'horizontal']),
      description: z.string(),
      points: z.array(z.object({
        time: z.number(),
        price: z.number(),
      })),
      style: z.object({
        color: z.string(),
        lineWidth: z.number(),
        lineStyle: z.enum(['solid', 'dashed', 'dotted']),
      }),
      priority: z.number().min(1).max(10),
    })),
    analysis: z.string(),
    nextAction: z.string(),
  }),
  rawData: z.object({
    candles: z.array(z.object({
      time: z.number(),
      open: z.number(),
      high: z.number(),
      low: z.number(),
      close: z.number(),
      volume: z.number(),
    })).optional(),
    indicators: z.record(z.array(z.number())).optional(),
  }).optional(),
});

export const chartDataAnalysisTool = createTool({
  id: 'chart-data-analysis',
  description: `
    Advanced chart data analysis tool for detailed technical analysis.
    
    Capabilities:
    - Fetch and analyze candlestick data for any timeframe
    - Calculate technical indicators (RSI, MACD, Moving Averages, ATR)
    - Detect support/resistance levels automatically
    - Identify chart patterns and trends
    - Generate intelligent drawing recommendations
    - Provide timeframe-specific analysis
    
    Use this tool to:
    - Get current chart data for analysis
    - Find optimal trendline placement points
    - Identify key support/resistance levels
    - Analyze market structure and patterns
    - Generate drawing suggestions based on technical analysis
  `,
  inputSchema: ChartDataAnalysisInput,
  outputSchema: ChartDataAnalysisOutput,

  execute: async ({ context }): Promise<z.infer<typeof ChartDataAnalysisOutput>> => {
    const { 
      symbol = 'BTCUSDT', 
      timeframe = '1h', 
      limit = 200, 
      analysisType = 'full',
      lookbackPeriod = 100 
    } = context as z.infer<typeof ChartDataAnalysisInput>;

    try {
      logger.info('[ChartDataAnalysis] Starting analysis', {
        symbol,
        timeframe,
        limit,
        analysisType
      });

      // Fetch candlestick data from Binance
      const candleData = await fetchCandlestickData(symbol, timeframe, limit);
      
      // Calculate technical indicators
      const technicalAnalysis = await calculateTechnicalAnalysis(candleData, lookbackPeriod);
      
      // Detect patterns if requested
      const patterns = analysisType === 'full' || analysisType === 'patterns' 
        ? await detectChartPatterns(candleData, timeframe)
        : [];
      
      // Generate drawing recommendations
      const recommendations = await generateDrawingRecommendations(
        candleData, 
        technicalAnalysis, 
        patterns, 
        timeframe
      );

      const result = {
        symbol,
        timeframe,
        dataRange: {
          startTime: candleData[0]?.time || 0,
          endTime: candleData[candleData.length - 1]?.time || 0,
          candleCount: candleData.length,
        },
        currentPrice: {
          price: candleData[candleData.length - 1]?.close || 0,
          timestamp: candleData[candleData.length - 1]?.time || 0,
        },
        technicalAnalysis,
        recommendations,
        patterns: patterns.length > 0 ? patterns : undefined,
        rawData: {
          candles: candleData.slice(-50), // Last 50 candles for reference
        },
      };

      logger.info('[ChartDataAnalysis] Analysis completed successfully', {
        symbol,
        timeframe,
        recommendationCount: recommendations.trendlineDrawing.length
      });

      return result;

    } catch (error) {
      logger.error('[ChartDataAnalysis] Analysis failed', {
        symbol,
        timeframe,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return minimal fallback data
      const now = Date.now();
      return {
        symbol,
        timeframe,
        dataRange: {
          startTime: now - (limit * getTimeframeMs(timeframe)),
          endTime: now,
          candleCount: 0,
        },
        currentPrice: {
          price: 50000, // Fallback price
          timestamp: now,
        },
        technicalAnalysis: {
          trend: {
            direction: 'sideways',
            strength: 0.5,
            confidence: 0.1,
            trendlines: [],
          },
          supportResistance: {
            supports: [],
            resistances: [],
          },
          volatility: {
            atr: 1000,
            volatilityLevel: 'medium',
            atrPercent: 2.0,
          },
          momentum: {
            rsi: 50,
            macd: {
              macd: 0,
              signal: 0,
              histogram: 0,
            },
          },
          movingAverages: {},
        },
        recommendations: {
          trendlineDrawing: [],
          analysis: 'データの取得に失敗しました。しばらく時間をおいて再度お試しください。',
          nextAction: '手動でチャート分析を行ってください。',
        },
      };
    }
  },
});

/**
 * Fetch candlestick data from Binance API
 */
async function fetchCandlestickData(symbol: string, timeframe: string, limit: number) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=${limit}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch candlestick data: ${response.status}`);
  }
  
  const data = await response.json() as Array<[number, string, string, string, string, string]>;
  
  return data.map((candle) => {
    const open = parseFloat(candle[1]);
    const high = parseFloat(candle[2]);
    const low = parseFloat(candle[3]);
    const close = parseFloat(candle[4]);
    const volume = parseFloat(candle[5]);
    
    // Replace NaN values with 0 or skip the candle
    return {
      time: candle[0], // Open time
      open: isNaN(open) ? 0 : open,
      high: isNaN(high) ? 0 : high,
      low: isNaN(low) ? 0 : low,
      close: isNaN(close) ? 0 : close,
      volume: isNaN(volume) ? 0 : volume,
    };
  }).filter(candle => candle.open > 0 && candle.high > 0 && candle.low > 0 && candle.close > 0);
}

/**
 * Calculate comprehensive technical analysis
 */
async function calculateTechnicalAnalysis(candles: Candle[], lookbackPeriod: number): Promise<TechnicalAnalysis> {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  
  // Calculate RSI
  const rsi = calculateRSI(closes, 14);
  
  // Calculate MACD
  const macd = calculateMACD(closes);
  
  // Calculate ATR for volatility
  const atr = calculateATR(highs, lows, closes, 14);
  
  // Calculate moving averages
  const ma20 = calculateSMA(closes, 20);
  const ma50 = calculateSMA(closes, 50);
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  
  // Determine trend
  const trend = analyzeTrend(closes, ma20, ma50);
  
  // Find support/resistance levels
  const supportResistance = findSupportResistanceLevels(candles, lookbackPeriod);
  
  // Calculate volatility level
  const currentPrice = closes[closes.length - 1];
  if (currentPrice === undefined) {
    return {
      trend: { direction: 'sideways', strength: 0.5, confidence: 0.5, trendlines: [] },
      supportResistance: { supports: [], resistances: [] },
      volatility: { atr: 0, volatilityLevel: 'low', atrPercent: 0 },
      momentum: { rsi: 50, macd: { macd: 0, signal: 0, histogram: 0 } },
      movingAverages: {},
    };
  }
  const atrPercent = (atr / currentPrice) * 100;
  const volatilityLevel: 'high' | 'medium' | 'low' = atrPercent > 4 ? 'high' : atrPercent > 2 ? 'medium' : 'low';
  
  return {
    trend,
    supportResistance,
    volatility: {
      atr,
      volatilityLevel,
      atrPercent,
    },
    momentum: {
      rsi: rsi[rsi.length - 1] || 50,
      macd: {
        macd: macd.macd[macd.macd.length - 1] || 0,
        signal: macd.signal[macd.signal.length - 1] || 0,
        histogram: macd.histogram[macd.histogram.length - 1] || 0,
      },
    },
    movingAverages: {
      ...(ma20[ma20.length - 1] !== undefined && { ma20: ma20[ma20.length - 1] }),
      ...(ma50[ma50.length - 1] !== undefined && { ma50: ma50[ma50.length - 1] }),
      ...(ema12[ema12.length - 1] !== undefined && { ema12: ema12[ema12.length - 1] }),
      ...(ema26[ema26.length - 1] !== undefined && { ema26: ema26[ema26.length - 1] }),
    },
  };
}

/**
 * Detect chart patterns
 */
async function detectChartPatterns(candles: Candle[], timeframe: string): Promise<Pattern[]> {
  const patterns: Pattern[] = [];
  
  // Simple pattern detection (can be enhanced)
  const recentCandles = candles.slice(-20);
  
  // Detect double top/bottom patterns
  // Pattern detection logic can be enhanced here
  
  // Example: Ascending triangle pattern
  if (isAscendingTriangle(recentCandles)) {
    patterns.push({
      type: 'ascending_triangle',
      confidence: 0.7,
      timeframe,
      description: '上昇三角形パターンを検出。ブレイクアウトの可能性があります。',
    });
  }
  
  return patterns;
}

/**
 * Generate intelligent drawing recommendations
 */
async function generateDrawingRecommendations(
  candles: Candle[], 
  technicalAnalysis: TechnicalAnalysis, 
  patterns: Pattern[], 
  timeframe: string
): Promise<{
  trendlineDrawing: Array<{
    type: 'trendline' | 'fibonacci' | 'horizontal';
    description: string;
    points: Array<{ time: number; price: number }>;
    style: {
      color: string;
      lineWidth: number;
      lineStyle: 'solid' | 'dashed' | 'dotted';
    };
    priority: number;
  }>;
  analysis: string;
  nextAction: string;
}> {
  const recommendations: Array<{
    type: 'trendline' | 'fibonacci' | 'horizontal';
    description: string;
    points: Array<{ time: number; price: number }>;
    style: {
      color: string;
      lineWidth: number;
      lineStyle: 'solid' | 'dashed' | 'dotted';
    };
    priority: number;
  }> = [];
  const lastCandle = candles[candles.length - 1];
  if (!lastCandle) return {
    trendlineDrawing: [],
    analysis: 'データが不足しています。',
    nextAction: 'チャートデータの取得を確認してください。',
  };
  const currentPrice = lastCandle.close;
  
  // Recommend trendlines based on support/resistance
  const { supports, resistances } = technicalAnalysis.supportResistance;
  if (supports.length > 0 && supports[0]) {
    const strongestSupport = supports[0];
    
    // Find historical points that touched this support level
    const supportPoints = findTouchPoints(candles, strongestSupport.price, 'support');
    
    if (supportPoints.length >= 2) {
      recommendations.push({
        type: 'trendline' as const,
        description: `強いサポートライン (${strongestSupport.price.toFixed(2)}) - ${supportPoints.length}回タッチ`,
        points: supportPoints.slice(0, 2), // Use first 2 points for trendline
        style: {
          color: '#4CAF50',
          lineWidth: 2,
          lineStyle: 'solid' as const,
        },
        priority: Math.round(strongestSupport.strength * 10),
      });
    }
  }
  
  if (resistances.length > 0 && resistances[0]) {
    const strongestResistance = resistances[0];
    
    const resistancePoints = findTouchPoints(candles, strongestResistance.price, 'resistance');
    
    if (resistancePoints.length >= 2) {
      recommendations.push({
        type: 'trendline' as const,
        description: `強いレジスタンスライン (${strongestResistance.price.toFixed(2)}) - ${resistancePoints.length}回タッチ`,
        points: resistancePoints.slice(0, 2),
        style: {
          color: '#F44336',
          lineWidth: 2,
          lineStyle: 'solid' as const,
        },
        priority: Math.round(strongestResistance.strength * 10),
      });
    }
  }
  
  // Recommend trend line based on recent price action
  if (technicalAnalysis.trend.strength > 0.6) {
    const trendPoints = findTrendPoints(candles, technicalAnalysis.trend.direction);
    
    if (trendPoints.length >= 2) {
      recommendations.push({
        type: 'trendline' as const,
        description: `${technicalAnalysis.trend.direction === 'bullish' ? '上昇' : '下降'}トレンドライン`,
        points: trendPoints,
        style: {
          color: technicalAnalysis.trend.direction === 'bullish' ? '#00E676' : '#FF5722',
          lineWidth: 2,
          lineStyle: 'solid' as const,
        },
        priority: Math.round(technicalAnalysis.trend.strength * 10),
      });
    }
  }
  
  // Generate analysis summary
  const analysis = generateAnalysisSummary(technicalAnalysis, patterns, timeframe);
  const nextAction = generateNextActionRecommendation(technicalAnalysis, currentPrice);
  
  return {
    trendlineDrawing: recommendations.sort((a, b) => b.priority - a.priority),
    analysis,
    nextAction,
  };
}

// Helper functions for technical analysis calculations

function calculateRSI(prices: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  
  for (let i = period; i < prices.length; i++) {
    let gains = 0;
    let losses = 0;
    
    for (let j = i - period + 1; j <= i; j++) {
      const prev = prices[j - 1];
      const curr = prices[j];
      if (prev === undefined || curr === undefined) continue;
      const change = curr - prev;
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }
  
  return rsi;
}

function calculateMACD(prices: number[]) {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  const macd: number[] = [];
  for (let i = 0; i < Math.min(ema12.length, ema26.length); i++) {
    const val12 = ema12[i];
    const val26 = ema26[i];
    if (val12 !== undefined && val26 !== undefined) {
      macd.push(val12 - val26);
    }
  }
  
  const signal = calculateEMA(macd, 9);
  const histogram: number[] = [];
  
  for (let i = 0; i < Math.min(macd.length, signal.length); i++) {
    const macdVal = macd[i];
    const signalVal = signal[i];
    if (macdVal !== undefined && signalVal !== undefined) {
      histogram.push(macdVal - signalVal);
    }
  }
  
  return { macd, signal, histogram };
}

function calculateSMA(prices: number[], period: number): number[] {
  const sma: number[] = [];
  
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    if (slice.length === period) {
      const sum = slice.reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  
  return sma;
}

function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  if (prices.length < period) return ema;
  
  // Start with SMA for first value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    const price = prices[i];
    if (price === undefined) return ema;
    sum += price;
  }
  ema.push(sum / period);
  
  // Calculate EMA for remaining values
  for (let i = period; i < prices.length; i++) {
    const currentPrice = prices[i];
    const prevEMA = ema[ema.length - 1];
    if (currentPrice !== undefined && prevEMA !== undefined) {
      ema.push((currentPrice - prevEMA) * multiplier + prevEMA);
    }
  }
  
  return ema;
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  const trueRanges: number[] = [];
  
  for (let i = 1; i < highs.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];
    
    if (high === undefined || low === undefined || prevClose === undefined) continue;
    
    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);
    trueRanges.push(Math.max(tr1, tr2, tr3));
  }
  
  const recentRanges = trueRanges.slice(-period);
  return recentRanges.length > 0 ? recentRanges.reduce((a, b) => a + b, 0) / recentRanges.length : 0;
}

function analyzeTrend(closes: number[], ma20: number[], ma50: number[]): {
  direction: 'bullish' | 'bearish' | 'sideways';
  strength: number;
  confidence: number;
} {
  const currentPrice = closes[closes.length - 1];
  const currentMA20 = ma20[ma20.length - 1];
  const currentMA50 = ma50[ma50.length - 1];
  
  if (currentPrice === undefined || currentMA20 === undefined || currentMA50 === undefined) {
    return { direction: 'sideways', strength: 0.5, confidence: 0.5 };
  }
  
  let direction: 'bullish' | 'bearish' | 'sideways' = 'sideways';
  let strength = 0.5;
  let confidence = 0.5;
  
  // Determine trend direction
  if (currentPrice > currentMA20 && currentMA20 > currentMA50) {
    direction = 'bullish';
    strength = 0.7;
    confidence = 0.8;
  } else if (currentPrice < currentMA20 && currentMA20 < currentMA50) {
    direction = 'bearish';
    strength = 0.7;
    confidence = 0.8;
  }
  
  return { direction, strength, confidence };
}

function findSupportResistanceLevels(candles: Candle[], lookbackPeriod: number): {
  supports: Array<{
    price: number;
    strength: number;
    touchCount: number;
    lastTouch: number;
  }>;
  resistances: Array<{
    price: number;
    strength: number;
    touchCount: number;
    lastTouch: number;
  }>;
} {
  const supports = [];
  const resistances = [];
  
  const recentCandles = candles.slice(-lookbackPeriod);
  const pricePoints = [];
  
  // Collect swing highs and lows
  for (let i = 2; i < recentCandles.length - 2; i++) {
    const current = recentCandles[i];
    const prev2 = recentCandles[i - 2];
    const prev1 = recentCandles[i - 1];
    const next1 = recentCandles[i + 1];
    const next2 = recentCandles[i + 2];
    
    if (!current || !prev2 || !prev1 || !next1 || !next2) continue;
    
    // Swing high
    if (current.high > prev2.high && current.high > prev1.high && 
        current.high > next1.high && current.high > next2.high) {
      pricePoints.push({ price: current.high, type: 'resistance', time: current.time });
    }
    
    // Swing low
    if (current.low < prev2.low && current.low < prev1.low && 
        current.low < next1.low && current.low < next2.low) {
      pricePoints.push({ price: current.low, type: 'support', time: current.time });
    }
  }
  
  // Group similar price levels
  const tolerance = (Math.max(...candles.map(c => c.high)) - Math.min(...candles.map(c => c.low))) * 0.01;
  
  const supportLevels = pricePoints.filter(p => p.type === 'support');
  const resistanceLevels = pricePoints.filter(p => p.type === 'resistance');
  
  // Find strongest support levels
  for (const level of supportLevels) {
    const similarLevels = supportLevels.filter(l => Math.abs(l.price - level.price) <= tolerance);
    if (similarLevels.length >= 2) {
      supports.push({
        price: level.price,
        strength: Math.min(similarLevels.length / 5, 1),
        touchCount: similarLevels.length,
        lastTouch: Math.max(...similarLevels.map(l => l.time)),
      });
    }
  }
  
  // Find strongest resistance levels
  for (const level of resistanceLevels) {
    const similarLevels = resistanceLevels.filter(l => Math.abs(l.price - level.price) <= tolerance);
    if (similarLevels.length >= 2) {
      resistances.push({
        price: level.price,
        strength: Math.min(similarLevels.length / 5, 1),
        touchCount: similarLevels.length,
        lastTouch: Math.max(...similarLevels.map(l => l.time)),
      });
    }
  }
  
  return {
    supports: supports.slice(0, 3).sort((a, b) => b.strength - a.strength),
    resistances: resistances.slice(0, 3).sort((a, b) => b.strength - a.strength),
  };
}

function findTouchPoints(candles: Candle[], targetPrice: number, type: 'support' | 'resistance'): Array<{ time: number; price: number }> {
  const tolerance = targetPrice * 0.005; // 0.5% tolerance
  const touchPoints: Array<{ time: number; price: number }> = [];
  
  for (const candle of candles) {
    if (!candle) continue;
    
    if (type === 'support' && Math.abs(candle.low - targetPrice) <= tolerance) {
      // 時間をミリ秒のまま保持（FloatingChatPanelで秒に変換される）
      touchPoints.push({ time: candle.time, price: candle.low });
    } else if (type === 'resistance' && Math.abs(candle.high - targetPrice) <= tolerance) {
      // 時間をミリ秒のまま保持（FloatingChatPanelで秒に変換される）
      touchPoints.push({ time: candle.time, price: candle.high });
    }
  }
  
  return touchPoints.slice(0, 5); // Return max 5 touch points
}

function findTrendPoints(candles: Candle[], direction: 'bullish' | 'bearish' | 'sideways'): Array<{ time: number; price: number }> {
  const recentCandles = candles.slice(-50);
  const points: Array<{ time: number; price: number }> = [];
  
  if (direction === 'bullish') {
    // Find swing lows for uptrend line
    for (let i = 2; i < recentCandles.length - 2; i++) {
      const current = recentCandles[i];
      const prev1 = recentCandles[i - 1];
      const prev2 = recentCandles[i - 2];
      const next1 = recentCandles[i + 1];
      const next2 = recentCandles[i + 2];
      
      if (!current || !prev1 || !prev2 || !next1 || !next2) continue;
      
      if (current.low < prev1.low && current.low < prev2.low &&
          current.low < next1.low && current.low < next2.low) {
        points.push({ time: current.time, price: current.low });
      }
    }
  } else if (direction === 'bearish') {
    // Find swing highs for downtrend line
    for (let i = 2; i < recentCandles.length - 2; i++) {
      const current = recentCandles[i];
      const prev1 = recentCandles[i - 1];
      const prev2 = recentCandles[i - 2];
      const next1 = recentCandles[i + 1];
      const next2 = recentCandles[i + 2];
      
      if (!current || !prev1 || !prev2 || !next1 || !next2) continue;
      
      if (current.high > prev1.high && current.high > prev2.high &&
          current.high > next1.high && current.high > next2.high) {
        points.push({ time: current.time, price: current.high });
      }
    }
  }
  
  return points.slice(-2); // Return last 2 points for trendline
}

function isAscendingTriangle(candles: Candle[]): boolean {
  // Simple ascending triangle detection
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  
  const recentHighs = highs.slice(-10);
  const recentLows = lows.slice(-10);
  
  // Check if highs are relatively flat and lows are ascending
  const highsVariance = calculateVariance(recentHighs);
  const lowsSlope = calculateSlope(recentLows);
  
  return highsVariance < 0.1 && lowsSlope > 0;
}

function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  return variance / Math.pow(mean, 2); // Normalized variance
}

function calculateSlope(values: number[]): number {
  const n = values.length;
  const sumX = n * (n - 1) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
  const sumXX = n * (n - 1) * (2 * n - 1) / 6;
  
  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
}

function generateAnalysisSummary(technicalAnalysis: TechnicalAnalysis, patterns: Pattern[], timeframe: string): string {
  const { trend, momentum, volatility } = technicalAnalysis;
  
  let summary = `${timeframe}チャート分析結果:\n\n`;
  
  summary += `📈 トレンド: ${trend.direction === 'bullish' ? '上昇' : trend.direction === 'bearish' ? '下降' : 'レンジ'} `;
  summary += `(強度: ${Math.round(trend.strength * 100)}%)\n`;
  
  summary += `📊 RSI: ${momentum.rsi.toFixed(1)} `;
  summary += `(${momentum.rsi > 70 ? '買われすぎ' : momentum.rsi < 30 ? '売られすぎ' : '中立'})\n`;
  
  summary += `📈 MACD: ${momentum.macd.histogram > 0 ? '強気' : '弱気'}シグナル\n`;
  
  summary += `⚡ ボラティリティ: ${volatility.volatilityLevel === 'high' ? '高' : volatility.volatilityLevel === 'medium' ? '中' : '低'}`;
  summary += ` (ATR: ${volatility.atrPercent.toFixed(2)}%)\n`;
  
  if (patterns.length > 0) {
    summary += `\n🔍 検出パターン:\n`;
    patterns.forEach(pattern => {
      summary += `  • ${pattern.description}\n`;
    });
  }
  
  return summary;
}

function generateNextActionRecommendation(technicalAnalysis: TechnicalAnalysis, currentPrice: number): string {
  const { trend, momentum, supportResistance } = technicalAnalysis;
  
  if (trend.direction === 'bullish' && momentum.rsi < 70) {
    return '上昇トレンド継続中。押し目買いのタイミングを探してください。';
  } else if (trend.direction === 'bearish' && momentum.rsi > 30) {
    return '下降トレンド継続中。戻り売りのタイミングを探してください。';
  } else if (momentum.rsi > 80) {
    return 'RSIが買われすぎ水準。利確または調整待ちを検討してください。';
  } else if (momentum.rsi < 30) {
    return 'RSIが売られすぎ水準。反発の可能性があります。';
  } else if (supportResistance.supports.length > 0 && supportResistance.supports[0]) {
    const nearestSupport = supportResistance.supports[0];
    const distanceToSupport = ((currentPrice - nearestSupport.price) / currentPrice) * 100;
    
    if (distanceToSupport < 2) {
      return `サポートライン(${nearestSupport.price.toFixed(2)})に接近中。反発に注意してください。`;
    }
  }
  
  return 'レンジ相場の可能性があります。明確なブレイクアウトまで様子見を推奨します。';
}

function getTimeframeMs(timeframe: string): number {
  const map: Record<string, number> = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000,
  };
  
  return map[timeframe] || 60 * 60 * 1000; // Default to 1h
}