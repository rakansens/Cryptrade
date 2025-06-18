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
  multiTimeframeOptions?: {
    enabled: boolean;
    timeframes?: string[];
    dataProvider?: (timeframe: string) => Promise<CandlestickData[]>;
  };
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
   * @param {Object} config - トレンドライン検出の設定
   * @param {number} config.lookbackPeriod - 分析対象期間（直近のキャンドル数）
   * @param {number} config.minTouchPoints - 最小タッチポイント数（2以上）
   * @param {number} config.confidenceThreshold - 信頼度の閾値（0.0〜1.0）
   * @returns 検出されたトレンドライン配列
   * @throws {Error} データが不十分な場合（本番環境のみ）
   */
  detectTrendLines(config: TrendLineConfig): ChartDrawing[] {
    // 最小限のバリデーション
    if (!this.data || this.data.length < config.minTouchPoints) {
      if (env.NODE_ENV === 'development') {
        console.warn(`[ChartAnalyzer] Insufficient data for trend line detection: ${this.data?.length || 0} candles, need at least ${config.minTouchPoints}`);
      }
      return [];
    }

    const trendLines: ChartDrawing[] = [];
    const recentData = this.data.slice(-config.lookbackPeriod);
    
    if (recentData.length < 3) {
      return trendLines; // 少なくとも3点は必要
    }
    
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
    
    // ローカルミニマ/マキシマが見つからない場合、簡易的に検出
    if (localMinima.length < 2) {
      // 最低値と最高値の位置を見つける
      let minIndex = 0;
      let minPrice = Number.MAX_VALUE;
      let secondMinIndex = 1;
      let secondMinPrice = Number.MAX_VALUE;
      
      for (let i = 0; i < recentData.length; i++) {
        const current = recentData[i];
        if (current && 'low' in current) {
          if (current.low < minPrice) {
            secondMinIndex = minIndex;
            secondMinPrice = minPrice;
            minIndex = i;
            minPrice = current.low;
          } else if (current.low < secondMinPrice && i !== minIndex) {
            secondMinIndex = i;
            secondMinPrice = current.low;
          }
        }
      }
      
      if (minIndex !== secondMinIndex) {
        localMinima.push({
          index: Math.min(minIndex, secondMinIndex),
          price: (recentData[Math.min(minIndex, secondMinIndex)] && 'low' in recentData[Math.min(minIndex, secondMinIndex)] ? (recentData[Math.min(minIndex, secondMinIndex)] as any).low : 0) || 0,
          time: Number(recentData[Math.min(minIndex, secondMinIndex)]?.time || 0)
        });
        localMinima.push({
          index: Math.max(minIndex, secondMinIndex),
          price: (recentData[Math.max(minIndex, secondMinIndex)] && 'low' in recentData[Math.max(minIndex, secondMinIndex)] ? (recentData[Math.max(minIndex, secondMinIndex)] as any).low : 0) || 0,
          time: Number(recentData[Math.max(minIndex, secondMinIndex)]?.time || 0)
        });
      }
    }
    
    if (localMaxima.length < 2) {
      // 最高値を見つける
      let maxIndex = 0;
      let maxPrice = -Number.MAX_VALUE;
      let secondMaxIndex = 1;
      let secondMaxPrice = -Number.MAX_VALUE;
      
      for (let i = 0; i < recentData.length; i++) {
        const current = recentData[i];
        if (current && 'high' in current) {
          const high = (current as any).high;
          if (high > maxPrice) {
            secondMaxIndex = maxIndex;
            secondMaxPrice = maxPrice;
            maxIndex = i;
            maxPrice = high;
          } else if (high > secondMaxPrice && i !== maxIndex) {
            secondMaxIndex = i;
            secondMaxPrice = high;
          }
        }
      }
      
      if (maxIndex !== secondMaxIndex) {
        localMaxima.push({
          index: Math.min(maxIndex, secondMaxIndex),
          price: (recentData[Math.min(maxIndex, secondMaxIndex)] as any)?.high || 0,
          time: Number(recentData[Math.min(maxIndex, secondMaxIndex)]?.time || 0)
        });
        localMaxima.push({
          index: Math.max(maxIndex, secondMaxIndex),
          price: (recentData[Math.max(maxIndex, secondMaxIndex)] as any)?.high || 0,
          time: Number(recentData[Math.max(maxIndex, secondMaxIndex)]?.time || 0)
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
        } else if (config.minTouchPoints <= 2) {
          // minTouchPointsが2以下の場合、2点でもトレンドラインを作成
          const confidence = 0.7;
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
                touches: 2
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
        } else if (config.minTouchPoints <= 2) {
          // minTouchPointsが2以下の場合、2点でもトレンドラインを作成
          const confidence = 0.7;
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
                touches: 2
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
   * @param {Object} config - サポート・レジスタンス検出の設定
   * @param {number} config.lookbackPeriod - 分析対象期間（直近のキャンドル数）
   * @param {number} config.minTouches - 最小タッチ回数
   * @param {number} config.priceThreshold - 価格の丸め単位（同一価格とみなす範囲）
   * @param {number} config.strengthThreshold - 強度の閾値（0.0〜2.0）
   * @returns 検出された水平ライン配列（サポート・レジスタンス）
   * @throws {Error} データが不十分な場合（本番環境のみ）
   */
  detectSupportResistance(config: SupportResistanceConfig): ChartDrawing[] {
    // 最小限のバリデーション
    if (!this.data || this.data.length < config.lookbackPeriod) {
      if (env.NODE_ENV === 'development') {
        console.warn(`[ChartAnalyzer] Insufficient data for support/resistance detection: ${this.data?.length || 0} candles, need at least ${config.lookbackPeriod}`);
      }
      return [];
    }

    const supportResistanceLines: ChartDrawing[] = [];
    const dataToAnalyze = config.lookbackPeriod < this.data.length 
      ? this.data.slice(-config.lookbackPeriod)
      : this.data;
    
    if (dataToAnalyze.length < 2) {
      return supportResistanceLines;
    }
    
    // Price levels and their touch counts
    const priceLevels = new Map<number, { touches: number; type: 'support' | 'resistance' | 'both' }>();
    
    // Round price to nearest threshold
    const roundPrice = (price: number) => {
      // 価格しきい値を価格に対する割合として使用
      const threshold = price * config.priceThreshold;
      return Math.round(price / threshold) * threshold;
    };
    
    // Count touches for each price level
    for (const candle of dataToAnalyze) {
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
    const startTime = dataToAnalyze[0]?.time || 0;
    const endTime = dataToAnalyze[dataToAnalyze.length - 1]?.time || 0;

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

  /**
   * サポート・レジスタンスラインを非同期で検出する（マルチタイムフレーム対応）
   * 上位時間軸のデータを参照して、より信頼性の高いレベルを検出します
   * 
   * @param config - サポート・レジスタンス検出の設定（マルチタイムフレームオプション含む）
   * @returns 検出された水平ライン配列（サポート・レジスタンス）
   */
  async detectSupportResistanceAsync(config: SupportResistanceConfig): Promise<ChartDrawing[]> {
    // マルチタイムフレームが無効の場合は同期メソッドにフォールバック
    if (!config.multiTimeframeOptions?.enabled) {
      return this.detectSupportResistance(config);
    }

    // ベースタイムフレームでの検出結果を取得
    const baseResults = this.detectSupportResistance(config);

    // データプロバイダーが提供されていない場合はベース結果を返す
    if (!config.multiTimeframeOptions.dataProvider) {
      return baseResults;
    }

    try {
      // 上位時間軸を決定（指定がない場合は自動計算）
      const higherTimeframe = config.multiTimeframeOptions.timeframes?.[0] || 
                             this.getHigherTimeframe();

      // 上位時間軸のデータを取得
      const higherTfData = await config.multiTimeframeOptions.dataProvider(higherTimeframe);
      
      if (!higherTfData || higherTfData.length === 0) {
        return baseResults;
      }

      // 上位時間軸でのサポート・レジスタンスを検出
      const higherTfAnalyzer = new ChartAnalyzer(higherTfData);
      const higherTfResults = higherTfAnalyzer.detectSupportResistance({
        ...config,
        multiTimeframeOptions: undefined // 再帰を防ぐ
      });

      // ベース結果を上位時間軸の結果で強化
      return this.enhanceLevelsWithMTF(baseResults, higherTfResults);
    } catch (error) {
      // エラーが発生した場合はベース結果を返す
      if (env.NODE_ENV === 'development') {
        console.warn('[ChartAnalyzer] Multi-timeframe analysis failed:', error);
      }
      return baseResults;
    }
  }

  /**
   * 現在のデータから上位時間軸を推定する
   * @returns 推定された上位時間軸の文字列表現
   */
  private getHigherTimeframe(): string {
    if (this.data.length < 2) {
      return '1h'; // デフォルト
    }

    // データポイント間の時間差から現在の時間軸を推定
    const timeDiff = Math.abs(Number(this.data[1]?.time || 0) - Number(this.data[0]?.time || 0));
    
    // 秒単位の時間差に基づいて時間軸を判定し、4倍の上位時間軸を返す
    if (timeDiff <= 60) return '5m';          // 1分足 → 5分足
    if (timeDiff <= 300) return '15m';        // 5分足 → 15分足
    if (timeDiff <= 900) return '1h';         // 15分足 → 1時間足
    if (timeDiff <= 3600) return '4h';        // 1時間足 → 4時間足
    if (timeDiff <= 14400) return '1d';       // 4時間足 → 日足
    
    return '1w'; // それ以上は週足
  }

  /**
   * ベースタイムフレームのレベルを上位時間軸の結果で強化する
   * @param baseResults - ベースタイムフレームの検出結果
   * @param higherTfResults - 上位時間軸の検出結果
   * @returns 強化されたレベル配列
   */
  private enhanceLevelsWithMTF(
    baseResults: ChartDrawing[], 
    higherTfResults: ChartDrawing[]
  ): ChartDrawing[] {
    const enhancedResults = baseResults.map(baseLevel => {
      const enhancedLevel = { ...baseLevel };
      if (!enhancedLevel.metadata) {
        enhancedLevel.metadata = {};
      }
      
      // デフォルトでmtfConfirmedをfalseに設定
      enhancedLevel.metadata['mtfConfirmed'] = false;
      
      if (!enhancedLevel?.points?.[0]?.value) return enhancedLevel;
      
      const basePrice = enhancedLevel.points[0].value;
      const baseType = enhancedLevel.metadata['type'];
      const priceThreshold = 0.02; // 2%の価格差を許容

      // 上位時間軸で同じタイプの近いレベルを探す
      const confirmedOnHigherTf = higherTfResults.some(htfLevel => {
        if (!htfLevel?.points?.[0]?.value) return false;
        
        const htfPrice = htfLevel.points[0].value;
        const htfType = htfLevel.metadata?.['type'];
        
        // 同じタイプで価格が近い場合
        return htfType === baseType && 
               Math.abs(htfPrice - basePrice) / basePrice < priceThreshold;
      });

      if (confirmedOnHigherTf) {
        // 上位時間軸で確認されたレベルの強度を上げる
        const currentStrength = enhancedLevel.metadata['strength'] as number || 1;
        enhancedLevel.metadata['strength'] = Math.min(currentStrength * 1.5, 3.0); // 50%増加
        enhancedLevel.metadata['mtfConfirmed'] = true;

        // ラインスタイルも更新（より太く、実線に）
        if (enhancedLevel.style) {
          enhancedLevel.style = { ...enhancedLevel.style };
          enhancedLevel.style.lineWidth = Math.min(3, (enhancedLevel.style.lineWidth || 1) + 1);
          enhancedLevel.style.lineStyle = 'solid';
        }
      }
      
      return enhancedLevel;
    });

    return enhancedResults;
  }

  // ... その他の分析メソッドは後ほど完全移行予定 ...
} 