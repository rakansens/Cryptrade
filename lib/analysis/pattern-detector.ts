// Pattern detection algorithms

import { logger } from '@/lib/utils/logger';
import type { PriceData as CandlestickData } from '@/types/market';
import type { 
  PatternAnalysis, 
  PatternKeyPoint, 
  PatternVisualization,
  PatternDetectionParams 
} from '@/types/pattern';

export class PatternDetector {
  private data: CandlestickData[];
  
  constructor(data: CandlestickData[]) {
    this.data = data;
  }
  
  /**
   * Detect all patterns in the data
   */
  detectPatterns(params: PatternDetectionParams): PatternAnalysis[] {
    const patterns: PatternAnalysis[] = [];
    const { lookbackPeriod, minConfidence, patternTypes } = params;
    
    // Use recent data for pattern detection
    const recentData = this.data.slice(-lookbackPeriod);
    
    // Head and Shoulders patterns
    if (!patternTypes || patternTypes.includes('headAndShoulders')) {
      const hsPatterns = this.detectHeadAndShoulders(recentData, false);
      patterns.push(...hsPatterns.filter(p => p.confidence >= minConfidence));
    }
    
    if (!patternTypes || patternTypes.includes('inverseHeadAndShoulders')) {
      const ihsPatterns = this.detectHeadAndShoulders(recentData, true);
      patterns.push(...ihsPatterns.filter(p => p.confidence >= minConfidence));
    }
    
    // Triangle patterns
    if (!patternTypes || patternTypes.includes('ascendingTriangle')) {
      const ascTriangles = this.detectTriangle(recentData, 'ascending');
      patterns.push(...ascTriangles.filter(p => p.confidence >= minConfidence));
    }
    
    if (!patternTypes || patternTypes.includes('descendingTriangle')) {
      const descTriangles = this.detectTriangle(recentData, 'descending');
      patterns.push(...descTriangles.filter(p => p.confidence >= minConfidence));
    }
    
    if (!patternTypes || patternTypes.includes('symmetricalTriangle')) {
      const symTriangles = this.detectTriangle(recentData, 'symmetrical');
      patterns.push(...symTriangles.filter(p => p.confidence >= minConfidence));
    }
    
    // Double/Triple patterns
    if (!patternTypes || patternTypes.includes('doubleTop')) {
      const doubleTops = this.detectDoublePattern(recentData, 'top');
      patterns.push(...doubleTops.filter(p => p.confidence >= minConfidence));
    }
    
    if (!patternTypes || patternTypes.includes('doubleBottom')) {
      const doubleBottoms = this.detectDoublePattern(recentData, 'bottom');
      patterns.push(...doubleBottoms.filter(p => p.confidence >= minConfidence));
    }
    
    return patterns;
  }
  
  /**
   * Detect Head and Shoulders pattern
   */
  private detectHeadAndShoulders(data: CandlestickData[], inverse: boolean = false): PatternAnalysis[] {
    const patterns: PatternAnalysis[] = [];
    const minPatternBars = 15; // Minimum bars for pattern formation
    
    if (data.length < minPatternBars) return patterns;
    
    // Find peaks and troughs
    const extremes = inverse ? this.findTroughs(data) : this.findPeaks(data);
    
    // Need at least 3 extremes for shoulders and head
    if (extremes.length < 3) return patterns;
    
    // Try to find pattern with different combinations
    for (let i = 0; i < extremes.length - 2; i++) {
      for (let j = i + 1; j < extremes.length - 1; j++) {
        for (let k = j + 1; k < extremes.length; k++) {
          const leftShoulder = extremes[i];
          const head = extremes[j];
          const rightShoulder = extremes[k];
          
          // Validate pattern rules
          const validation = this.validateHeadAndShoulders(
            data,
            leftShoulder.index,
            head.index,
            rightShoulder.index,
            inverse
          );
          
          if (validation.isValid && validation.confidence >= 0.6) {
            const pattern = this.createHeadAndShouldersPattern(
              data,
              leftShoulder.index,
              head.index,
              rightShoulder.index,
              validation,
              inverse
            );
            patterns.push(pattern);
          }
        }
      }
    }
    
    // Sort by confidence and return best matches
    return patterns.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }
  
  /**
   * Validate Head and Shoulders pattern
   */
  private validateHeadAndShoulders(
    data: CandlestickData[],
    leftShoulderIdx: number,
    headIdx: number,
    rightShoulderIdx: number,
    inverse: boolean
  ): { isValid: boolean; confidence: number; necklinePoints?: number[] } {
    const leftShoulder = data[leftShoulderIdx];
    const head = data[headIdx];
    const rightShoulder = data[rightShoulderIdx];
    
    // Get the relevant price field
    const priceField = inverse ? 'low' : 'high';
    
    // Rule 1: Head must be highest/lowest
    if (inverse) {
      if (head.low >= leftShoulder.low || head.low >= rightShoulder.low) {
        return { isValid: false, confidence: 0 };
      }
    } else {
      if (head.high <= leftShoulder.high || head.high <= rightShoulder.high) {
        return { isValid: false, confidence: 0 };
      }
    }
    
    // Rule 2: Shoulders should be roughly equal (within 3%)
    const shoulderDiff = Math.abs(leftShoulder[priceField] - rightShoulder[priceField]) / leftShoulder[priceField];
    if (shoulderDiff > 0.03) {
      return { isValid: false, confidence: 0 };
    }
    
    // Rule 3: Find neckline (valleys between shoulders and head)
    const leftValleyIdx = this.findValleyBetween(data, leftShoulderIdx, headIdx, inverse);
    const rightValleyIdx = this.findValleyBetween(data, headIdx, rightShoulderIdx, inverse);
    
    if (leftValleyIdx === -1 || rightValleyIdx === -1) {
      return { isValid: false, confidence: 0 };
    }
    
    // Rule 4: Neckline should be relatively horizontal (within 2%)
    const leftValley = data[leftValleyIdx];
    const rightValley = data[rightValleyIdx];
    const valleyField = inverse ? 'high' : 'low';
    const necklineDiff = Math.abs(leftValley[valleyField] - rightValley[valleyField]) / leftValley[valleyField];
    
    // Calculate confidence based on pattern quality
    let confidence = 0.7; // Base confidence
    
    // Shoulder symmetry bonus
    confidence += (1 - shoulderDiff * 10) * 0.15;
    
    // Neckline horizontality bonus
    confidence += (1 - necklineDiff * 20) * 0.15;
    
    // Time symmetry bonus
    const leftFormation = headIdx - leftShoulderIdx;
    const rightFormation = rightShoulderIdx - headIdx;
    const timeSymmetry = 1 - Math.abs(leftFormation - rightFormation) / Math.max(leftFormation, rightFormation);
    confidence += timeSymmetry * 0.1;
    
    return {
      isValid: true,
      confidence: Math.min(confidence, 0.95),
      necklinePoints: [leftValleyIdx, rightValleyIdx]
    };
  }
  
  /**
   * Create Head and Shoulders pattern analysis
   */
  private createHeadAndShouldersPattern(
    data: CandlestickData[],
    leftShoulderIdx: number,
    headIdx: number,
    rightShoulderIdx: number,
    validation: { isValid: boolean; confidence: number; necklinePoints?: number[] },
    inverse: boolean
  ): PatternAnalysis {
    const leftValleyIdx = validation.necklinePoints[0];
    const rightValleyIdx = validation.necklinePoints[1];
    
    // Create key points
    const keyPoints: PatternKeyPoint[] = [
      {
        time: data[leftShoulderIdx].time,
        value: data[leftShoulderIdx][inverse ? 'low' : 'high'],
        type: 'peak',
        label: 'LS'
      },
      {
        time: data[leftValleyIdx].time,
        value: data[leftValleyIdx][inverse ? 'high' : 'low'],
        type: 'trough',
        label: 'LV'
      },
      {
        time: data[headIdx].time,
        value: data[headIdx][inverse ? 'low' : 'high'],
        type: 'peak',
        label: 'H'
      },
      {
        time: data[rightValleyIdx].time,
        value: data[rightValleyIdx][inverse ? 'high' : 'low'],
        type: 'trough',
        label: 'RV'
      },
      {
        time: data[rightShoulderIdx].time,
        value: data[rightShoulderIdx][inverse ? 'low' : 'high'],
        type: 'peak',
        label: 'RS'
      }
    ];
    
    // Calculate neckline and target
    const necklinePrice = (keyPoints[1].value + keyPoints[3].value) / 2;
    const patternHeight = Math.abs(keyPoints[2].value - necklinePrice);
    const targetPrice = inverse ? necklinePrice + patternHeight : necklinePrice - patternHeight;
    
    // Add neckline and target points
    keyPoints.push({
      time: data[data.length - 1].time,
      value: targetPrice,
      type: 'target',
      label: 'T'
    });
    
    // Create visualization
    const visualization: PatternVisualization = {
      keyPoints,
      lines: [
        // Pattern outline
        { from: 0, to: 1, type: 'outline', style: { lineStyle: 'dashed' } },
        { from: 1, to: 2, type: 'outline', style: { lineStyle: 'dashed' } },
        { from: 2, to: 3, type: 'outline', style: { lineStyle: 'dashed' } },
        { from: 3, to: 4, type: 'outline', style: { lineStyle: 'dashed' } },
        // Neckline
        { from: 1, to: 3, type: 'neckline', style: { color: '#ff0000', lineWidth: 2 } }
      ],
      areas: [{
        points: [0, 1, 2, 3, 4],
        style: { fillColor: inverse ? '#00ff00' : '#ff0000', opacity: 0.1 }
      }]
    };
    
    return {
      type: inverse ? 'inverseHeadAndShoulders' : 'headAndShoulders',
      startTime: data[leftShoulderIdx].time,
      endTime: data[rightShoulderIdx].time,
      startIndex: leftShoulderIdx,
      endIndex: rightShoulderIdx,
      confidence: validation.confidence,
      visualization,
      metrics: {
        formation_period: rightShoulderIdx - leftShoulderIdx + 1,
        symmetry: 1 - Math.abs(keyPoints[0].value - keyPoints[4].value) / keyPoints[0].value,
        breakout_level: necklinePrice,
        target_level: targetPrice,
        stop_loss: keyPoints[2].value
      },
      description: `${inverse ? '逆' : ''}ヘッドアンドショルダーパターンを検出。ネックライン: $${necklinePrice.toFixed(2)}`,
      trading_implication: inverse ? 'bullish' : 'bearish'
    };
  }
  
  /**
   * Find valley (local minimum) between two peaks
   */
  private findValleyBetween(data: CandlestickData[], startIdx: number, endIdx: number, inverse: boolean): number {
    if (startIdx >= endIdx - 1) return -1;
    
    const field = inverse ? 'high' : 'low';
    let minIdx = startIdx + 1;
    let minValue = data[minIdx][field];
    
    for (let i = startIdx + 1; i < endIdx; i++) {
      if (inverse ? data[i][field] > minValue : data[i][field] < minValue) {
        minValue = data[i][field];
        minIdx = i;
      }
    }
    
    return minIdx;
  }
  
  /**
   * Detect triangle patterns
   */
  private detectTriangle(data: CandlestickData[], type: 'ascending' | 'descending' | 'symmetrical'): PatternAnalysis[] {
    const patterns: PatternAnalysis[] = [];
    const minBars = 20;
    
    if (data.length < minBars) return patterns;
    
    // Find swing highs and lows
    const highs = this.findPeaks(data);
    const lows = this.findTroughs(data);
    
    // Need at least 2 highs and 2 lows
    if (highs.length < 2 || lows.length < 2) return patterns;
    
    // Try to fit triangle patterns
    for (let lookback = minBars; lookback <= Math.min(60, data.length); lookback += 5) {
      const recentHighs = highs.filter(h => h.index >= data.length - lookback);
      const recentLows = lows.filter(l => l.index >= data.length - lookback);
      
      if (recentHighs.length >= 2 && recentLows.length >= 2) {
        const trianglePattern = this.fitTrianglePattern(data, recentHighs, recentLows, type);
        if (trianglePattern && trianglePattern.confidence >= 0.6) {
          patterns.push(trianglePattern);
        }
      }
    }
    
    return patterns.sort((a, b) => b.confidence - a.confidence).slice(0, 2);
  }
  
  /**
   * Fit triangle pattern to swing points
   */
  private fitTrianglePattern(
    data: CandlestickData[],
    highs: Array<{ index: number; value: number }>,
    lows: Array<{ index: number; value: number }>,
    type: 'ascending' | 'descending' | 'symmetrical'
  ): PatternAnalysis | null {
    // Calculate trend lines for highs and lows
    const highTrend = this.calculateTrendLine(highs);
    const lowTrend = this.calculateTrendLine(lows);
    
    // Validate triangle type
    let isValid = false;
    let confidence = 0.7;
    
    switch (type) {
      case 'ascending':
        // Upper line should be horizontal, lower line ascending
        isValid = Math.abs(highTrend.slope) < 0.001 && lowTrend.slope > 0.001;
        confidence += (1 - Math.abs(highTrend.slope) * 100) * 0.15;
        break;
        
      case 'descending':
        // Upper line descending, lower line horizontal
        isValid = highTrend.slope < -0.001 && Math.abs(lowTrend.slope) < 0.001;
        confidence += (1 - Math.abs(lowTrend.slope) * 100) * 0.15;
        break;
        
      case 'symmetrical':
        // Both lines converging
        isValid = highTrend.slope < -0.001 && lowTrend.slope > 0.001;
        const convergenceRate = Math.abs(highTrend.slope) / Math.abs(lowTrend.slope);
        confidence += (1 - Math.abs(1 - convergenceRate)) * 0.15;
        break;
    }
    
    if (!isValid) return null;
    
    // Create visualization
    const keyPoints: PatternKeyPoint[] = [
      ...highs.map((h, i) => ({
        time: data[h.index].time,
        value: h.value,
        type: 'peak' as const,
        label: `H${i + 1}`
      })),
      ...lows.map((l, i) => ({
        time: data[l.index].time,
        value: l.value,
        type: 'trough' as const,
        label: `L${i + 1}`
      }))
    ];
    
    const visualization: PatternVisualization = {
      keyPoints,
      lines: [
        // Upper trend line
        { 
          from: 0, 
          to: highs.length - 1, 
          type: 'resistance',
          style: { color: '#ff0000', lineWidth: 2 }
        },
        // Lower trend line
        { 
          from: highs.length, 
          to: keyPoints.length - 1, 
          type: 'support',
          style: { color: '#00ff00', lineWidth: 2 }
        }
      ],
      areas: [{
        points: Array.from({ length: keyPoints.length }, (_, i) => i),
        style: { 
          fillColor: type === 'ascending' ? '#00ff00' : type === 'descending' ? '#ff0000' : '#0000ff',
          opacity: 0.1
        }
      }]
    };
    
    const patternType = type === 'ascending' ? 'ascendingTriangle' : 
                       type === 'descending' ? 'descendingTriangle' : 'symmetricalTriangle';
    
    const startIdx = Math.min(highs[0].index, lows[0].index);
    const endIdx = Math.max(highs[highs.length - 1].index, lows[lows.length - 1].index);
    
    return {
      type: patternType,
      startTime: data[startIdx].time,
      endTime: data[endIdx].time,
      startIndex: startIdx,
      endIndex: endIdx,
      confidence,
      visualization,
      metrics: {
        formation_period: endIdx - startIdx + 1,
        breakout_level: type === 'ascending' ? highs[highs.length - 1].value :
                       type === 'descending' ? lows[lows.length - 1].value :
                       (highs[highs.length - 1].value + lows[lows.length - 1].value) / 2
      },
      description: `${type === 'ascending' ? '上昇' : type === 'descending' ? '下降' : '対称'}トライアングルパターン`,
      trading_implication: type === 'ascending' ? 'bullish' : 
                          type === 'descending' ? 'bearish' : 'neutral'
    };
  }
  
  /**
   * Detect double top/bottom patterns
   */
  private detectDoublePattern(data: CandlestickData[], type: 'top' | 'bottom'): PatternAnalysis[] {
    const patterns: PatternAnalysis[] = [];
    const extremes = type === 'top' ? this.findPeaks(data) : this.findTroughs(data);
    
    if (extremes.length < 2) return patterns;
    
    // Look for two similar extremes
    for (let i = 0; i < extremes.length - 1; i++) {
      for (let j = i + 1; j < extremes.length; j++) {
        const first = extremes[i];
        const second = extremes[j];
        
        // Check if peaks/troughs are similar (within 1%)
        const priceDiff = Math.abs(first.value - second.value) / first.value;
        if (priceDiff > 0.01) continue;
        
        // Find valley/peak between them
        const betweenIdx = this.findValleyBetween(data, first.index, second.index, type === 'bottom');
        if (betweenIdx === -1) continue;
        
        const pattern = this.createDoublePattern(data, first, second, betweenIdx, type);
        if (pattern.confidence >= 0.6) {
          patterns.push(pattern);
        }
      }
    }
    
    return patterns.sort((a, b) => b.confidence - a.confidence).slice(0, 2);
  }
  
  /**
   * Create double pattern analysis
   */
  private createDoublePattern(
    data: CandlestickData[],
    first: { index: number; value: number },
    second: { index: number; value: number },
    betweenIdx: number,
    type: 'top' | 'bottom'
  ): PatternAnalysis {
    const keyPoints: PatternKeyPoint[] = [
      {
        time: data[first.index].time,
        value: first.value,
        type: type === 'top' ? 'peak' : 'trough',
        label: type === 'top' ? 'T1' : 'B1'
      },
      {
        time: data[betweenIdx].time,
        value: data[betweenIdx][type === 'top' ? 'low' : 'high'],
        type: type === 'top' ? 'trough' : 'peak',
        label: 'N'
      },
      {
        time: data[second.index].time,
        value: second.value,
        type: type === 'top' ? 'peak' : 'trough',
        label: type === 'top' ? 'T2' : 'B2'
      }
    ];
    
    const necklinePrice = keyPoints[1].value;
    const patternHeight = Math.abs(first.value - necklinePrice);
    const targetPrice = type === 'top' ? necklinePrice - patternHeight : necklinePrice + patternHeight;
    
    const visualization: PatternVisualization = {
      keyPoints,
      lines: [
        { from: 0, to: 1, type: 'outline', style: { lineStyle: 'dashed' } },
        { from: 1, to: 2, type: 'outline', style: { lineStyle: 'dashed' } },
        { 
          from: 1, 
          to: 1, 
          type: 'neckline',
          style: { color: '#ff0000', lineWidth: 2 }
        }
      ]
    };
    
    const priceSimilarity = 1 - Math.abs(first.value - second.value) / first.value;
    const confidence = 0.7 + priceSimilarity * 0.3;
    
    return {
      type: type === 'top' ? 'doubleTop' : 'doubleBottom',
      startTime: data[first.index].time,
      endTime: data[second.index].time,
      startIndex: first.index,
      endIndex: second.index,
      confidence,
      visualization,
      metrics: {
        formation_period: second.index - first.index + 1,
        breakout_level: necklinePrice,
        target_level: targetPrice,
        stop_loss: type === 'top' ? Math.max(first.value, second.value) : Math.min(first.value, second.value),
        firstPeakPrice: first.value,
        secondPeakPrice: second.value,
        valleyPrice: necklinePrice
      },
      description: `ダブル${type === 'top' ? 'トップ' : 'ボトム'}パターン。ネックライン: $${necklinePrice.toFixed(2)}`,
      trading_implication: type === 'top' ? 'bearish' : 'bullish'
    };
  }
  
  /**
   * Find peaks (local maxima)
   */
  private findPeaks(data: CandlestickData[]): Array<{ index: number; value: number }> {
    const peaks: Array<{ index: number; value: number }> = [];
    const window = 5;
    
    for (let i = window; i < data.length - window; i++) {
      const current = data[i].high;
      let isPeak = true;
      
      for (let j = i - window; j <= i + window; j++) {
        if (j !== i && data[j].high >= current) {
          isPeak = false;
          break;
        }
      }
      
      if (isPeak) {
        peaks.push({ index: i, value: current });
      }
    }
    
    return peaks;
  }
  
  /**
   * Find troughs (local minima)
   */
  private findTroughs(data: CandlestickData[]): Array<{ index: number; value: number }> {
    const troughs: Array<{ index: number; value: number }> = [];
    const window = 5;
    
    for (let i = window; i < data.length - window; i++) {
      const current = data[i].low;
      let isTrough = true;
      
      for (let j = i - window; j <= i + window; j++) {
        if (j !== i && data[j].low <= current) {
          isTrough = false;
          break;
        }
      }
      
      if (isTrough) {
        troughs.push({ index: i, value: current });
      }
    }
    
    return troughs;
  }
  
  /**
   * Calculate trend line from points
   */
  private calculateTrendLine(points: Array<{ index: number; value: number }>): {
    slope: number;
    intercept: number;
  } {
    if (points.length < 2) return { slope: 0, intercept: 0 };
    
    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.index, 0);
    const sumY = points.reduce((sum, p) => sum + p.value, 0);
    const sumXY = points.reduce((sum, p) => sum + p.index * p.value, 0);
    const sumXX = points.reduce((sum, p) => sum + p.index * p.index, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
  }
}