/**
 * Line Renderer Plugin
 * 
 * パターンのライン（接続線、トレンドライン等）を描画
 */

import type { ISeriesApi, Time, SeriesType } from 'lightweight-charts';
import type { PatternVisualization } from '@/types/pattern';
import type { 
  ILineRendererPlugin, 
  PluginContext, 
  LineStyle, 
  RenderResult 
} from './interfaces';
import { PluginError } from './interfaces';
import { ValidationUtils, ColorUtils, TimeUtils } from './utils';
import { logger } from '@/lib/utils/logger';

interface LineData {
  time: number;
  value: number;
}

export class LineRenderer implements ILineRendererPlugin {
  readonly name = 'LineRenderer';
  
  private context?: PluginContext;
  private lineSeries = new Map<string, ISeriesApi<SeriesType>[]>();
  private lineStyle: LineStyle = {
    color: '#2196F3',
    width: 2,
    style: 'solid',
    opacity: 1.0,
  };
  
  /**
   * プラグインの初期化
   */
  initialize(context: PluginContext): void {
    this.context = context;
    logger.info('[LineRenderer] Plugin initialized', {
      instanceId: context.instanceId,
    });
  }
  
  /**
   * ラインの描画をサポートするかチェック
   */
  supports(data: PatternVisualization): boolean {
    const hasLines = Array.isArray(data.lines) && data.lines.length > 0;
    logger.debug('[LineRenderer] Support check', {
      hasLines,
      linesCount: data.lines?.length || 0,
    });
    return hasLines;
  }
  
  /**
   * ラインスタイルを設定
   */
  setLineStyle(style: LineStyle): void {
    this.lineStyle = { ...this.lineStyle, ...style };
    logger.info('[LineRenderer] Line style updated', { style });
  }
  
  /**
   * ライン色の一括変更
   */
  updateLineColors(patternId: string, colors: Record<string, string>): void {
    const series = this.lineSeries.get(patternId);
    if (!series) {
      logger.warn('[LineRenderer] Pattern not found for color update', { patternId });
      return;
    }
    
    logger.info('[LineRenderer] Updating line colors', {
      patternId,
      colors,
      seriesCount: series.length,
    });
    
    // 色の変更は新しいシリーズを作成し直す必要があるため、
    // 実際の実装では remove → render を呼び出すことを推奨
    logger.warn('[LineRenderer] Color update requires re-rendering. Use remove() and render() instead.');
  }
  
  /**
   * ラインを描画
   */
  async render(id: string, data: PatternVisualization): Promise<void> {
    if (!this.context) {
      throw new PluginError(this.name, 'render', 'Plugin not initialized');
    }
    
    if (!this.supports(data)) {
      logger.warn('[LineRenderer] Data not supported', { id });
      return;
    }
    
    try {
      // 入力データの検証
      if (!ValidationUtils.validatePatternId(id)) {
        throw new PluginError(this.name, 'render', `Invalid pattern ID: ${id}`);
      }
      
      if (!ValidationUtils.validateLines(data.lines)) {
        throw new PluginError(this.name, 'render', 'Invalid lines data');
      }
      
      logger.info('[LineRenderer] Starting line rendering', {
        id,
        linesCount: data.lines.length,
        instanceId: this.context.instanceId,
      });
      
      // 既存のラインがある場合は削除
      await this.remove(id);
      
      // ラインを描画
      const createdSeries = await this.createLineSeries(id, data);
      
      if (createdSeries.length === 0) {
        logger.warn('[LineRenderer] No lines created', { id });
        return;
      }
      
      // レジストリに登録
      this.lineSeries.set(id, createdSeries);
      this.context.registry.registerSeries(id, createdSeries, 'line', {
        linesCount: data.lines.length,
        createdAt: Date.now(),
      });
      
      logger.info('[LineRenderer] Lines rendered successfully', {
        id,
        linesCreated: createdSeries.length,
        instanceId: this.context.instanceId,
      });
      
    } catch (error) {
      const pluginError = error instanceof PluginError 
        ? error 
        : new PluginError(this.name, 'render', `Unexpected error: ${String(error)}`, error as Error);
      
      logger.error('[LineRenderer] Failed to render lines', {
        id,
        error: pluginError.message,
        stack: pluginError.stack,
      });
      
      throw pluginError;
    }
  }
  
  /**
   * パターンのラインを削除
   */
  async remove(id: string): Promise<void> {
    if (!this.context) {
      throw new PluginError(this.name, 'remove', 'Plugin not initialized');
    }
    
    try {
      const series = this.lineSeries.get(id);
      if (!series || series.length === 0) {
        logger.debug('[LineRenderer] No lines to remove', { id });
        return;
      }
      
      logger.info('[LineRenderer] Removing lines', {
        id,
        linesCount: series.length,
        instanceId: this.context.instanceId,
      });
      
      // チャートからシリーズを削除
      let removedCount = 0;
      for (const s of series) {
        try {
          this.context.chart.removeSeries(s);
          removedCount++;
        } catch (error) {
          logger.warn('[LineRenderer] Failed to remove series from chart', {
            id,
            error: String(error),
          });
        }
      }
      
      // レジストリから削除
      this.lineSeries.delete(id);
      
      logger.info('[LineRenderer] Lines removed successfully', {
        id,
        removedCount,
        instanceId: this.context.instanceId,
      });
      
    } catch (error) {
      const pluginError = new PluginError(
        this.name, 
        'remove', 
        `Failed to remove lines: ${String(error)}`,
        error as Error
      );
      
      logger.error('[LineRenderer] Failed to remove lines', {
        id,
        error: pluginError.message,
      });
      
      throw pluginError;
    }
  }
  
  /**
   * プラグインのクリーンアップ
   */
  async dispose(): Promise<void> {
    logger.info('[LineRenderer] Disposing plugin', {
      patternsToClean: this.lineSeries.size,
    });
    
    // すべてのパターンのラインを削除
    const patternIds = Array.from(this.lineSeries.keys());
    for (const id of patternIds) {
      try {
        await this.remove(id);
      } catch (error) {
        logger.warn('[LineRenderer] Failed to remove pattern during disposal', {
          id,
          error: String(error),
        });
      }
    }
    
    // 内部状態をクリア
    this.lineSeries.clear();
    this.context = undefined;
    
    logger.info('[LineRenderer] Plugin disposed');
  }
  
  /**
   * ラインシリーズを作成
   */
  private async createLineSeries(
    patternId: string, 
    data: PatternVisualization
  ): Promise<ISeriesApi<SeriesType>[]> {
    if (!this.context || !data.lines) {
      return [];
    }
    
    const createdSeries: ISeriesApi<SeriesType>[] = [];
    const { keyPoints } = data;
    
    for (let lineIndex = 0; lineIndex < data.lines.length; lineIndex++) {
      const line = data.lines[lineIndex];
      
      try {
        // ラインデータの生成
        const lineData = this.generateLineData(line, keyPoints);
        if (lineData.length < 2) {
          logger.warn('[LineRenderer] Insufficient line data points', {
            patternId,
            lineIndex,
            pointsCount: lineData.length,
          });
          continue;
        }
        
        // ラインスタイルの決定
        const lineStyle = this.resolveLineStyle(line, lineIndex);
        
        // ラインシリーズの作成
        const series = this.context.chart.addLineSeries({
          color: lineStyle.color,
          lineWidth: lineStyle.width,
          lineStyle: this.context.utilities.convertLineStyle(lineStyle.style || 'solid'),
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          title: this.generateLineTitle(line, lineIndex),
        });
        
        // データを設定
        series.setData(lineData.map(point => ({
          time: point.time as Time,
          value: point.value,
        })));
        
        createdSeries.push(series);
        
        logger.debug('[LineRenderer] Created line series', {
          patternId,
          lineIndex,
          dataPoints: lineData.length,
          style: lineStyle,
        });
        
      } catch (error) {
        logger.warn('[LineRenderer] Failed to create line series', {
          patternId,
          lineIndex,
          error: String(error),
        });
      }
    }
    
    return createdSeries;
  }
  
  /**
   * ラインデータを生成
   */
  private generateLineData(
    line: { points?: number[]; extend?: boolean }, 
    keyPoints: Array<{ time: number; value: number }>
  ): LineData[] {
    if (!line.points || !Array.isArray(line.points) || line.points.length < 2) {
      return [];
    }
    
    const lineData: LineData[] = [];
    
    // ポイントインデックスから実際の座標に変換
    for (const pointIndex of line.points) {
      const keyPoint = keyPoints[pointIndex];
      if (keyPoint) {
        lineData.push({
          time: TimeUtils.normalizeTime(keyPoint.time),
          value: keyPoint.value,
        });
      }
    }
    
    // 時間順にソート
    lineData.sort((a, b) => a.time - b.time);
    
    // ライン延長処理（必要に応じて）
    if (line.extend === true && lineData.length >= 2) {
      const extendedData = this.extendLine(lineData);
      return extendedData;
    }
    
    return lineData;
  }
  
  /**
   * ラインを延長
   */
  private extendLine(lineData: LineData[]): LineData[] {
    if (lineData.length < 2) return lineData;
    
    const first = lineData[0];
    const last = lineData[lineData.length - 1];
    
    // 傾きを計算
    const slope = (last.value - first.value) / (last.time - first.time);
    
    // 時間範囲を計算
    const timeRange = last.time - first.time;
    const extension = timeRange * 0.3; // 30%延長
    
    // 延長ポイントを追加
    const extended = [...lineData];
    
    // 左側に延長
    const leftTime = first.time - extension;
    const leftValue = first.value - slope * extension;
    extended.unshift({ time: leftTime, value: leftValue });
    
    // 右側に延長
    const rightTime = last.time + extension;
    const rightValue = last.value + slope * extension;
    extended.push({ time: rightTime, value: rightValue });
    
    return extended;
  }
  
  /**
   * ラインスタイルを解決
   */
  private resolveLineStyle(line: { style?: Partial<LineStyle>; type?: string }, index: number): Required<LineStyle> {
    const baseStyle = { ...this.lineStyle };
    
    // ライン固有のスタイルを適用
    if (line.style) {
      Object.assign(baseStyle, line.style);
    }
    
    // タイプベースのスタイルを適用
    if (line.type) {
      const typeStyle = this.getStyleByType(line.type);
      Object.assign(baseStyle, typeStyle);
    }
    
    // インデックスベースの色を適用（スタイルで指定されていない場合）
    if (!line.style?.color && !baseStyle.color) {
      baseStyle.color = ColorUtils.getFromPalette(index);
    }
    
    // 必須フィールドのデフォルト値を保証
    return {
      color: baseStyle.color || '#2196F3',
      width: baseStyle.width || 2,
      style: baseStyle.style || 'solid',
      opacity: baseStyle.opacity || 1.0,
    };
  }
  
  /**
   * タイプに基づくスタイルを取得
   */
  private getStyleByType(type: string): Partial<LineStyle> {
    const typeStyles: Record<string, Partial<LineStyle>> = {
      trendline: { color: '#4CAF50', width: 2, style: 'solid' },
      support: { color: '#00BCD4', width: 2, style: 'dashed' },
      resistance: { color: '#E91E63', width: 2, style: 'dashed' },
      neckline: { color: '#FF5722', width: 3, style: 'solid' },
      outline: { color: '#9E9E9E', width: 1, style: 'solid' },
      fibonacci: { color: '#9C27B0', width: 1, style: 'dotted' },
      channel: { color: '#FF9800', width: 2, style: 'dashed' },
    };
    
    return typeStyles[type.toLowerCase()] || {};
  }
  
  /**
   * ラインタイトルを生成
   */
  private generateLineTitle(line: { label?: string; type?: string }, index: number): string {
    if (line.label) {
      return line.label;
    }
    
    if (line.type) {
      const typeNames: Record<string, string> = {
        trendline: 'トレンドライン',
        support: 'サポートライン',
        resistance: 'レジスタンスライン',
        neckline: 'ネックライン',
        outline: 'アウトライン',
        fibonacci: 'フィボナッチ',
        channel: 'チャネル',
      };
      
      return typeNames[line.type.toLowerCase()] || line.type;
    }
    
    return `Line ${index + 1}`;
  }
  
  /**
   * デバッグ用状態取得
   */
  getDebugState() {
    return {
      name: this.name,
      initialized: !!this.context,
      patternsCount: this.lineSeries.size,
      patterns: Array.from(this.lineSeries.entries()).map(([id, series]) => ({
        id,
        seriesCount: series.length,
      })),
      lineStyle: this.lineStyle,
    };
  }
}