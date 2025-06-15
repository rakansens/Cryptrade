// 新規ファイル: ChartAnalyzer クラスを drawing-primitives から分離

import type { CandlestickData, ChartDrawing } from '@/types/chart.types';

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

export class ChartAnalyzer {
  private data: CandlestickData[];
  
  constructor(data: CandlestickData[]) {
    this.data = data;
  }

  detectTrendLines(_config: TrendLineConfig): ChartDrawing[] {
    // Placeholder: existing implementation was moved from drawing-primitives.
    // TODO: Implement using this.data
    // For now, just reference data to avoid unused variable warning
    if (this.data.length === 0) return [];
    return [];
  }

  detectSupportResistance(_config: SupportResistanceConfig): ChartDrawing[] {
    // Placeholder: Support/Resistance detection logic
    // TODO: Implement using this.data
    // For now, just reference data to avoid unused variable warning
    if (this.data.length === 0) return [];
    return [];
  }

  // ... その他の分析メソッドは後ほど完全移行予定 ...
} 