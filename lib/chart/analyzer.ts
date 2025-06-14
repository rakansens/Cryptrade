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
  private _data: CandlestickData[];

  constructor(data: CandlestickData[]) {
    this._data = data;
  }

  detectTrendLines(config: TrendLineConfig): ChartDrawing[] {
    // Placeholder: existing implementation was moved from drawing-primitives.
    // TODO: Implement using this._data
    return [];
  }

  detectSupportResistance(config: SupportResistanceConfig): ChartDrawing[] {
    // Placeholder: Support/Resistance detection logic
    // TODO: Implement using this._data
    return [];
  }

  // ... その他の分析メソッドは後ほど完全移行予定 ...
} 