/**
 * Key Point Renderer Plugin
 * 
 * パターンのキーポイント（重要な価格ポイント）をマーカーとして描画
 */

import type { SeriesMarker, Time } from 'lightweight-charts';
import type { PatternVisualization } from '@/types/pattern';
import type { 
  IKeyPointRendererPlugin, 
  PluginContext, 
  MarkerStyle, 
  RenderResult 
} from './interfaces';
import { PluginError } from './interfaces';
import { ValidationUtils, ColorUtils } from './utils';
import { logger } from '@/lib/utils/logger';

export class KeyPointRenderer implements IKeyPointRendererPlugin {
  readonly name = 'KeyPointRenderer';
  
  private context?: PluginContext;
  private markers = new Map<string, SeriesMarker<Time>[]>();
  private markerStyle: MarkerStyle = {
    shape: 'circle',
    color: '#2196F3',
    size: 8,
    text: {
      color: '#ffffff',
      fontSize: 12,
    },
  };
  
  /**
   * プラグインの初期化
   */
  initialize(context: PluginContext): void {
    this.context = context;
    logger.info('[KeyPointRenderer] Plugin initialized', {
      instanceId: context.instanceId,
    });
  }
  
  /**
   * キーポイントの描画をサポートするかチェック
   */
  supports(data: PatternVisualization): boolean {
    const hasKeyPoints = Array.isArray(data.keyPoints) && data.keyPoints.length > 0;
    logger.debug('[KeyPointRenderer] Support check', {
      hasKeyPoints,
      keyPointsCount: data.keyPoints?.length || 0,
    });
    return hasKeyPoints;
  }
  
  /**
   * マーカースタイルを設定
   */
  setMarkerStyle(style: MarkerStyle): void {
    this.markerStyle = { ...this.markerStyle, ...style };
    logger.info('[KeyPointRenderer] Marker style updated', { style });
  }
  
  /**
   * キーポイントをマーカーとして描画
   */
  async render(id: string, data: PatternVisualization): Promise<void> {
    if (!this.context) {
      throw new PluginError(this.name, 'render', 'Plugin not initialized');
    }
    
    if (!this.supports(data)) {
      logger.warn('[KeyPointRenderer] Data not supported', { id });
      return;
    }
    
    try {
      // 入力データの検証
      if (!ValidationUtils.validatePatternId(id)) {
        throw new PluginError(this.name, 'render', `Invalid pattern ID: ${id}`);
      }
      
      if (!ValidationUtils.validateKeyPoints(data.keyPoints)) {
        throw new PluginError(this.name, 'render', 'Invalid key points data');
      }
      
      logger.info('[KeyPointRenderer] Starting key point rendering', {
        id,
        keyPointsCount: data.keyPoints.length,
        instanceId: this.context.instanceId,
      });
      
      // 既存のマーカーがある場合は削除
      await this.remove(id);
      
      // キーポイントをマーカーに変換
      const markers = this.createMarkers(id, data.keyPoints);
      
      if (markers.length === 0) {
        logger.warn('[KeyPointRenderer] No markers created', { id });
        return;
      }
      
      // メインシリーズに既存のマーカーを取得
      const existingMarkers = this.context.mainSeries.markers() || [];
      
      // 新しいマーカーを追加
      const allMarkers = [...existingMarkers, ...markers];
      this.context.mainSeries.setMarkers(allMarkers);
      
      // レジストリに登録
      this.markers.set(id, markers);
      
      logger.info('[KeyPointRenderer] Key points rendered successfully', {
        id,
        markersCreated: markers.length,
        totalMarkers: allMarkers.length,
        instanceId: this.context.instanceId,
      });
      
    } catch (error) {
      const pluginError = error instanceof PluginError 
        ? error 
        : new PluginError(this.name, 'render', `Unexpected error: ${String(error)}`, error as Error);
      
      logger.error('[KeyPointRenderer] Failed to render key points', {
        id,
        error: pluginError.message,
        stack: pluginError.stack,
      });
      
      throw pluginError;
    }
  }
  
  /**
   * パターンのマーカーを削除
   */
  async remove(id: string): Promise<void> {
    if (!this.context) {
      throw new PluginError(this.name, 'remove', 'Plugin not initialized');
    }
    
    try {
      const patternMarkers = this.markers.get(id);
      if (!patternMarkers || patternMarkers.length === 0) {
        logger.debug('[KeyPointRenderer] No markers to remove', { id });
        return;
      }
      
      logger.info('[KeyPointRenderer] Removing key point markers', {
        id,
        markersCount: patternMarkers.length,
        instanceId: this.context.instanceId,
      });
      
      // 既存のすべてのマーカーを取得
      const allMarkers = this.context.mainSeries.markers() || [];
      
      // パターンのマーカーを除外した新しいマーカーリストを作成
      const filteredMarkers = allMarkers.filter(marker => 
        !patternMarkers.some(pm => 
          pm.time === marker.time && 
          pm.text === marker.text &&
          pm.color === marker.color
        )
      );
      
      // フィルタリングされたマーカーを設定
      this.context.mainSeries.setMarkers(filteredMarkers);
      
      // レジストリから削除
      this.markers.delete(id);
      
      logger.info('[KeyPointRenderer] Markers removed successfully', {
        id,
        removedCount: patternMarkers.length,
        remainingMarkers: filteredMarkers.length,
        instanceId: this.context.instanceId,
      });
      
    } catch (error) {
      const pluginError = new PluginError(
        this.name, 
        'remove', 
        `Failed to remove markers: ${String(error)}`,
        error as Error
      );
      
      logger.error('[KeyPointRenderer] Failed to remove markers', {
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
    logger.info('[KeyPointRenderer] Disposing plugin', {
      patternsToClean: this.markers.size,
    });
    
    // すべてのパターンのマーカーを削除
    const patternIds = Array.from(this.markers.keys());
    for (const id of patternIds) {
      try {
        await this.remove(id);
      } catch (error) {
        logger.warn('[KeyPointRenderer] Failed to remove pattern during disposal', {
          id,
          error: String(error),
        });
      }
    }
    
    // 内部状態をクリア
    this.markers.clear();
    this.context = undefined;
    
    logger.info('[KeyPointRenderer] Plugin disposed');
  }
  
  /**
   * キーポイントからマーカーを作成
   */
  private createMarkers(
    patternId: string, 
    keyPoints: Array<{ time: number; value: number; label?: string }>
  ): SeriesMarker<Time>[] {
    const markers: SeriesMarker<Time>[] = [];
    
    keyPoints.forEach((point, index) => {
      try {
        // 時間の正規化
        const normalizedTime = this.normalizeTime(point.time);
        
        // マーカーテキストの決定
        const text = this.generateMarkerText(point, index);
        
        // マーカー色の決定
        const color = this.generateMarkerColor(point, index);
        
        // マーカーシェイプの決定
        const shape = this.generateMarkerShape(point, index);
        
        const marker: SeriesMarker<Time> = {
          time: normalizedTime as Time,
          position: 'aboveBar',
          color,
          shape,
          text,
          size: this.markerStyle.size,
        };
        
        markers.push(marker);
        
        logger.debug('[KeyPointRenderer] Created marker', {
          patternId,
          index,
          time: normalizedTime,
          value: point.value,
          text,
          color,
          shape,
        });
        
      } catch (error) {
        logger.warn('[KeyPointRenderer] Failed to create marker for key point', {
          patternId,
          index,
          point,
          error: String(error),
        });
      }
    });
    
    return markers;
  }
  
  /**
   * マーカーテキストを生成
   */
  private generateMarkerText(
    point: { time: number; value: number; label?: string }, 
    index: number
  ): string {
    if (point.label) {
      return point.label;
    }
    
    // デフォルトのラベル生成
    const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    return labels[index] || `P${index + 1}`;
  }
  
  /**
   * マーカー色を生成
   */
  private generateMarkerColor(
    point: { time: number; value: number; label?: string }, 
    index: number
  ): string {
    // ラベルベースの色分け
    if (point.label) {
      const labelColorMap: Record<string, string> = {
        'HIGH': '#4CAF50',
        'LOW': '#F44336',
        'BREAK': '#FF9800',
        'TARGET': '#2196F3',
        'SUPPORT': '#00BCD4',
        'RESISTANCE': '#E91E63',
      };
      
      const upperLabel = point.label.toUpperCase();
      for (const [keyword, color] of Object.entries(labelColorMap)) {
        if (upperLabel.includes(keyword)) {
          return color;
        }
      }
    }
    
    // インデックスベースの色分け
    return ColorUtils.getFromPalette(index);
  }
  
  /**
   * マーカーシェイプを生成
   */
  private generateMarkerShape(
    point: { time: number; value: number; label?: string }, 
    index: number
  ): 'circle' | 'square' | 'arrowUp' | 'arrowDown' {
    if (point.label) {
      const upperLabel = point.label.toUpperCase();
      
      if (upperLabel.includes('UP') || upperLabel.includes('HIGH')) {
        return 'arrowUp';
      }
      if (upperLabel.includes('DOWN') || upperLabel.includes('LOW')) {
        return 'arrowDown';
      }
      if (upperLabel.includes('BREAK') || upperLabel.includes('TARGET')) {
        return 'square';
      }
    }
    
    return this.markerStyle.shape || 'circle';
  }
  
  /**
   * 時間を正規化
   */
  private normalizeTime(timestamp: number): number {
    // JavaScriptのDateオブジェクトと互換性のある形式に変換
    if (timestamp < 1e10) {
      // Unix秒タイムスタンプ
      return timestamp;
    } else if (timestamp < 1e13) {
      // Unix ミリ秒タイムスタンプ、秒に変換
      return Math.floor(timestamp / 1000);
    }
    return timestamp;
  }
  
  /**
   * デバッグ用状態取得
   */
  getDebugState() {
    return {
      name: this.name,
      initialized: !!this.context,
      patternsCount: this.markers.size,
      patterns: Array.from(this.markers.entries()).map(([id, markers]) => ({
        id,
        markersCount: markers.length,
      })),
      markerStyle: this.markerStyle,
    };
  }
}