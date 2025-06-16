// 新規ファイル: ChartAnalyzer クラスを drawing-primitives から分離

import { env } from '@/config/env';
import type { CandlestickData, ChartDrawing } from '@/types/chart.types';
import type { Time } from 'lightweight-charts';

export interface TrendLineConfig {
  lookbackPeriod: number;
  minTouchPoints: number;
  confidenceThreshold: number;
}

export interface SupportResistanceConfig {
  lookbackPeriod: number;
  minTouches: number;
  priceThreshold: number;
  strengthThreshold: number;
}

/**
 * チャート分析を行うクラス
 * トレンドラインやサポート・レジスタンスラインの検出を行います
 * 
 * @example
 * ```typescript
 * const analyzer = new ChartAnalyzer(candlestickData);
 * const trendLines = analyzer.detectTrendLines({
 *   lookbackPeriod: 20,
 *   minTouchPoints: 3,
 *   confidenceThreshold: 0.8
 * });
 * ```
 */
export class ChartAnalyzer {
  private data: CandlestickData[];
  
  constructor(data: CandlestickData[]) {
    this.data = data;
  }

  /**
   * トレンドラインを検出する
   * ローカルの最小値・最大値を結んで上昇・下降トレンドラインを検出します
   * 
   * @param config - トレンドライン検出の設定
   * @param config.lookbackPeriod - 分析対象期間（直近のキャンドル数）
   * @param config.minTouchPoints - 最小タッチポイント数（2以上）
   * @param config.confidenceThreshold - 信頼度の閾値（0.0〜1.0）
   * @returns 検出されたトレンドライン配列
   * @throws {Error} データが不十分な場合（本番環境のみ）
   */
  detectTrendLines(config: TrendLineConfig): ChartDrawing[] {
    // 最小限のバリデーション
    if (!this.data || this.data.length < config.minTouchPoints) {
      if (env.NODE_ENV === 'development') {
        console.warn(`[ChartAnalyzer] Insufficient data for trend line detection: ${this.data?.length || 0} candles, need at least ${config.minTouchPoints}`);
        return [];
      }
      
      throw new Error(`Insufficient data for trend line detection: ${this.data?.length || 0} candles provided, need at least ${config.minTouchPoints}`);
    }

    const trendLines: ChartDrawing[] = [];
    const recentData = this.data.slice(-config.lookbackPeriod);
    
    // Find local minima and maxima
    const localMinima: { index: number; price: number; time: number }[] = [];
    const localMaxima: { index: number; price: number; time: number }[] = [];
    
    for (let i = 1; i < recentData.length - 1; i++) {
      const prev = recentData[i - 1];
      const current = recentData[i];
      const next = recentData[i + 1];
      
      if (current && prev && next && 
          'low' in current && 'low' in prev && 'low' in next &&
          current.low < prev.low && current.low < next.low) {
        localMinima.push({
          index: i,
          price: current.low,
          time: typeof current.time === 'number' ? current.time : Number(current.time)
        });
      }
      
      if (current && prev && next && 
          'high' in current && 'high' in prev && 'high' in next &&
          (current as any).high > (prev as any).high && (current as any).high > (next as any).high) {
        localMaxima.push({
          index: i,
          price: (current as any).high as number,
          time: typeof current.time === 'number' ? current.time : Number(current.time)
        });
      }
    }
    
    // Generate uptrend lines from minima
    for (let i = 0; i < localMinima.length - 1; i++) {
      for (let j = i + 1; j < localMinima.length; j++) {
        const point1 = localMinima[i];
        const point2 = localMinima[j];
        
        if (!point1 || !point2) continue;
        
        // Calculate slope
        const slope = (point2.price - point1.price) / (point2.index - point1.index);
        
        // Count touches
        let touches = 2;
        for (let k = point1.index + 1; k < point2.index; k++) {
          const expectedPrice = point1.price + slope * (k - point1.index);
          const candle = recentData[k];
          if (!candle || !('low' in candle)) continue;
          const actualLow = candle.low;
          
          if (Math.abs(actualLow - expectedPrice) / expectedPrice < 0.01) {
            touches++;
          }
        }
        
        if (touches >= config.minTouchPoints) {
          const confidence = Math.min(touches / config.minTouchPoints, 1.0);
          if (confidence >= config.confidenceThreshold) {
            trendLines.push({
              id: `trend_up_${Date.now()}_${i}_${j}`,
              type: 'trendline',
              points: [
                { time: point1.time as Time, value: point1.price },
                { time: point2.time as Time, value: point2.price }
              ],
              style: {
                color: '#0ddfba',
                lineWidth: 2,
                lineStyle: 'solid',
                showLabels: false
              },
              visible: true,
              interactive: true,
              metadata: {
                direction: 'up',
                confidence,
                touches
              }
            });
          }
        }
      }
    }
    
    // Generate downtrend lines from maxima
    for (let i = 0; i < localMaxima.length - 1; i++) {
      for (let j = i + 1; j < localMaxima.length; j++) {
        const point1 = localMaxima[i];
        const point2 = localMaxima[j];
        
        if (!point1 || !point2) continue;
        
        // Calculate slope
        const slope = (point2.price - point1.price) / (point2.index - point1.index);
        
        // Count touches
        let touches = 2;
        for (let k = point1.index + 1; k < point2.index; k++) {
          const expectedPrice = point1.price + slope * (k - point1.index);
          const candle = recentData[k];
          if (!candle || !('high' in candle)) continue;
          const actualHigh = candle.high;
          
          if (Math.abs(actualHigh - expectedPrice) / expectedPrice < 0.01) {
            touches++;
          }
        }
        
        if (touches >= config.minTouchPoints) {
          const confidence = Math.min(touches / config.minTouchPoints, 1.0);
          if (confidence >= config.confidenceThreshold) {
            trendLines.push({
              id: `trend_down_${Date.now()}_${i}_${j}`,
              type: 'trendline',
              points: [
                { time: point1.time as Time, value: point1.price },
                { time: point2.time as Time, value: point2.price }
              ],
              style: {
                color: '#ff4d4d',
                lineWidth: 2,
                lineStyle: 'solid',
                showLabels: false
              },
              visible: true,
              interactive: true,
              metadata: {
                direction: 'down',
                confidence,
                touches
              }
            });
          }
        }
      }
    }
    
    return trendLines;
  }

  /**
   * サポート・レジスタンスラインを検出する
   * 価格が複数回反発した水平ラインを検出します
   * 
   * @param config - サポート・レジスタンス検出の設定
   * @param config.lookbackPeriod - 分析対象期間（直近のキャンドル数）
   * @param config.minTouches - 最小タッチ回数
   * @param config.priceThreshold - 価格の丸め単位（同一価格とみなす範囲）
   * @param config.strengthThreshold - 強度の閾値（0.0〜2.0）
   * @returns 検出された水平ライン配列（サポート・レジスタンス）
   * @throws {Error} データが不十分な場合（本番環境のみ）
   */
  detectSupportResistance(config: SupportResistanceConfig): ChartDrawing[] {
    // 最小限のバリデーション
    if (!this.data || this.data.length < config.lookbackPeriod) {
      if (env.NODE_ENV === 'development') {
        console.warn(`[ChartAnalyzer] Insufficient data for support/resistance detection: ${this.data?.length || 0} candles, need at least ${config.lookbackPeriod}`);
        return [];
      }
      
      throw new Error(`Insufficient data for support/resistance detection: ${this.data?.length || 0} candles provided, need at least ${config.lookbackPeriod}`);
    }

    const supportResistanceLines: ChartDrawing[] = [];
    const recentData = this.data.slice(-config.lookbackPeriod);
    
    // Price levels and their touch counts
    const priceLevels = new Map<number, { touches: number; type: 'support' | 'resistance' | 'both' }>();
    
    // Round price to nearest threshold
    const roundPrice = (price: number) => {
      return Math.round(price / config.priceThreshold) * config.priceThreshold;
    };
    
    // Count touches for each price level
    for (const candle of recentData) {
      if (!candle || !('high' in candle) || !('low' in candle)) continue;
      const highLevel = roundPrice((candle as any).high);
      const lowLevel = roundPrice((candle as any).low);
      
      // Check resistance touches
      if (!priceLevels.has(highLevel)) {
        priceLevels.set(highLevel, { touches: 0, type: 'resistance' });
      }
      const highData = priceLevels.get(highLevel)!;
      highData.touches++;
      
      // Check support touches
      if (!priceLevels.has(lowLevel)) {
        priceLevels.set(lowLevel, { touches: 0, type: 'support' });
      }
      const lowData = priceLevels.get(lowLevel)!;
      lowData.touches++;
      if (lowData.type === 'resistance') {
        lowData.type = 'both';
      }
    }
    
    // Filter levels by minimum touches and calculate strength
    const significantLevels = Array.from(priceLevels.entries())
      .filter(([_, data]) => data.touches >= config.minTouches)
      .map(([price, data]) => ({
        price,
        touches: data.touches,
        type: data.type,
        strength: Math.min(data.touches / config.minTouches, 2.0)
      }))
      .filter(level => level.strength >= config.strengthThreshold)
      .sort((a, b) => a.price - b.price);

    // Merge nearby levels within threshold
    const mergedLevels: typeof significantLevels = [];
    for (const level of significantLevels) {
      const last = mergedLevels[mergedLevels.length - 1];
      if (last && Math.abs(level.price - last.price) <= config.priceThreshold) {
        const totalTouches = last.touches + level.touches;
        last.price = (last.price * last.touches + level.price * level.touches) / totalTouches;
        last.touches = totalTouches;
        if (last.type !== level.type) {
          last.type = 'both';
        }
        last.strength = Math.min(last.touches / config.minTouches, 2.0);
      } else {
        mergedLevels.push({ ...level });
      }
    }
    
    // Create horizontal lines for merged significant levels
    const startTime = recentData[0]?.time || 0;
    const endTime = recentData[recentData.length - 1]?.time || 0;

    for (const level of mergedLevels) {
      const isSupportLine = level.type === 'support' || level.type === 'both';
      const isResistanceLine = level.type === 'resistance' || level.type === 'both';
      
      if (isSupportLine) {
        supportResistanceLines.push({
          id: `support_${Date.now()}_${level.price}`,
          type: 'horizontal',
          points: [
            { time: startTime as Time, value: level.price },
            { time: endTime as Time, value: level.price }
          ],
          style: {
            color: '#0ddfba',
            lineWidth: Math.min(1 + level.strength, 3),
            lineStyle: level.strength > 1.5 ? 'solid' : 'dashed',
            showLabels: false
          },
          visible: true,
          interactive: true,
          metadata: {
            type: 'support',
            touches: level.touches,
            strength: level.strength
          }
        });
      }
      
      if (isResistanceLine && level.type !== 'support') {
        supportResistanceLines.push({
          id: `resistance_${Date.now()}_${level.price}`,
          type: 'horizontal',
          points: [
            { time: startTime as Time, value: level.price },
            { time: endTime as Time, value: level.price }
          ],
          style: {
            color: '#ff4d4d',
            lineWidth: Math.min(1 + level.strength, 3),
            lineStyle: level.strength > 1.5 ? 'solid' : 'dashed',
            showLabels: false
          },
          visible: true,
          interactive: true,
          metadata: {
            type: 'resistance',
            touches: level.touches,
            strength: level.strength
          }
        });
      }
    }
    
    return supportResistanceLines;
  }

  // ... その他の分析メソッドは後ほど完全移行予定 ...
} 