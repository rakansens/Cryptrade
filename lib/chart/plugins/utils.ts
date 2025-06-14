/**
 * Plugin Utility Functions
 * 
 * プラグイン間で共有されるユーティリティ関数
 */

import type { PluginUtilities } from './interfaces';
import { logger } from '@/lib/utils/logger';

/**
 * プラグイン共通ユーティリティ実装
 */
export class PluginUtilitiesImpl implements PluginUtilities {
  /**
   * 線の色を取得
   */
  getLineColor(type: string): string {
    const colors: Record<string, string> = {
      outline: '#888888',
      neckline: '#ff0000',
      support: '#00ff00',
      resistance: '#ff0000',
      target: '#00aaff',
      trendline: '#4CAF50',
      horizontal: '#2196F3',
      diagonal: '#FF9800',
      fibonacci: '#9C27B0',
      pattern: '#673AB7',
    };
    
    const color = colors[type.toLowerCase()] || '#888888';
    logger.debug('[PluginUtils] Retrieved line color', { type, color });
    return color;
  }
  
  /**
   * ラインスタイルを変換
   */
  convertLineStyle(style: string): number {
    const styles: Record<string, number> = {
      solid: 0,
      dashed: 1,
      dotted: 2,
      dashdot: 3,
    };
    
    const converted = styles[style.toLowerCase()] ?? 0;
    logger.debug('[PluginUtils] Converted line style', { style, converted });
    return converted;
  }
  
  /**
   * 色に透明度を追加
   */
  addOpacity(color: string, opacity: number): string {
    // 透明度を0-1の範囲に正規化
    const normalizedOpacity = Math.max(0, Math.min(1, opacity));
    
    // HEX色をRGBAに変換
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const result = `rgba(${r}, ${g}, ${b}, ${normalizedOpacity})`;
      
      logger.debug('[PluginUtils] Added opacity to hex color', { 
        originalColor: color, 
        opacity: normalizedOpacity, 
        result 
      });
      return result;
    }
    
    // RGB色の場合
    if (color.startsWith('rgb(')) {
      const result = color.replace('rgb(', 'rgba(').replace(')', `, ${normalizedOpacity})`);
      logger.debug('[PluginUtils] Added opacity to rgb color', { 
        originalColor: color, 
        opacity: normalizedOpacity, 
        result 
      });
      return result;
    }
    
    // RGBA色の場合（既存のアルファ値を置換）
    if (color.startsWith('rgba(')) {
      const result = color.replace(/,\s*[\d.]+\)$/, `, ${normalizedOpacity})`);
      logger.debug('[PluginUtils] Updated opacity in rgba color', { 
        originalColor: color, 
        opacity: normalizedOpacity, 
        result 
      });
      return result;
    }
    
    // その他の色形式の場合はそのまま返す
    logger.warn('[PluginUtils] Unknown color format, returning as-is', { color });
    return color;
  }
  
  /**
   * 時間範囲を計算
   */
  calculateTimeRange(keyPoints: Array<{ time: number; value: number }>): {
    minTime: number;
    maxTime: number;
    startTime: number;
    endTime: number;
  } {
    if (keyPoints.length === 0) {
      logger.warn('[PluginUtils] No key points provided for time range calculation');
      return {
        minTime: 0,
        maxTime: 0,
        startTime: 0,
        endTime: 0,
      };
    }
    
    const times = keyPoints.map(p => p.time);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    // パターンの両端を延長して視認性を向上
    const timeExtension = (maxTime - minTime) * 0.5;
    const startTime = minTime - timeExtension;
    const endTime = maxTime + timeExtension;
    
    logger.debug('[PluginUtils] Calculated time range', {
      keyPointsCount: keyPoints.length,
      minTime,
      maxTime,
      timeExtension,
      startTime,
      endTime,
    });
    
    return {
      minTime,
      maxTime,
      startTime,
      endTime,
    };
  }
  
  /**
   * IDの部分一致検索（ファジーマッチング）
   */
  findPatternByFuzzyMatch(searchId: string, availableIds: string[]): string | null {
    // 完全一致を最初に試す
    if (availableIds.includes(searchId)) {
      logger.debug('[PluginUtils] Found exact match for pattern ID', { searchId });
      return searchId;
    }
    
    // IDの一部分で検索
    const searchParts = searchId.split('_');
    const uniquePart = searchParts.slice(-2).join('_'); // 末尾2つの部分を使用
    
    for (const availableId of availableIds) {
      // 一意部分が含まれているかチェック
      if (availableId.includes(uniquePart)) {
        logger.debug('[PluginUtils] Found fuzzy match by unique part', {
          searchId,
          foundId: availableId,
          uniquePart,
        });
        return availableId;
      }
      
      // パターンIDで末尾が一致するかチェック
      if (availableId.includes('pattern') && 
          availableId.endsWith(searchParts[searchParts.length - 1])) {
        logger.debug('[PluginUtils] Found fuzzy match by pattern suffix', {
          searchId,
          foundId: availableId,
          suffix: searchParts[searchParts.length - 1],
        });
        return availableId;
      }
    }
    
    logger.debug('[PluginUtils] No fuzzy match found for pattern ID', {
      searchId,
      uniquePart,
      availableIds,
    });
    return null;
  }
}

/**
 * 色関連のユーティリティ関数
 */
export const ColorUtils = {
  /**
   * カラーパレットから色を取得
   */
  getFromPalette(index: number): string {
    const palette = [
      '#4CAF50', // Green
      '#2196F3', // Blue
      '#FF9800', // Orange
      '#9C27B0', // Purple
      '#F44336', // Red
      '#00BCD4', // Cyan
      '#FFEB3B', // Yellow
      '#795548', // Brown
    ];
    
    return palette[index % palette.length];
  },
  
  /**
   * 色の明度を調整
   */
  adjustBrightness(color: string, factor: number): string {
    if (!color.startsWith('#')) return color;
    
    const hex = color.slice(1);
    const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16) * factor));
    const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16) * factor));
    const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16) * factor));
    
    const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  },
  
  /**
   * 色をダークテーマ用に変換
   */
  toDarkTheme(color: string): string {
    // 簡単な実装: 明度を少し上げる
    return ColorUtils.adjustBrightness(color, 1.2);
  },
};

/**
 * 時間関連のユーティリティ関数
 */
export const TimeUtils = {
  /**
   * タイムスタンプを適切な時間単位に変換
   */
  normalizeTime(timestamp: number): number {
    // JavaScriptのDateオブジェクトと互換性のある形式に変換
    if (timestamp < 1e10) {
      // Unix秒タイムスタンプの場合
      return timestamp;
    } else if (timestamp < 1e13) {
      // Unix ミリ秒タイムスタンプの場合、秒に変換
      return Math.floor(timestamp / 1000);
    }
    return timestamp;
  },
  
  /**
   * 時間範囲内にタイムスタンプが含まれるかチェック
   */
  isWithinRange(timestamp: number, start: number, end: number): boolean {
    const normalizedTime = TimeUtils.normalizeTime(timestamp);
    const normalizedStart = TimeUtils.normalizeTime(start);
    const normalizedEnd = TimeUtils.normalizeTime(end);
    
    return normalizedTime >= normalizedStart && normalizedTime <= normalizedEnd;
  },
  
  /**
   * 時間軸のステップサイズを計算
   */
  calculateStepSize(timeRange: number): number {
    // 時間範囲に基づいて適切なステップサイズを決定
    const steps = [
      { range: 3600, step: 300 },      // 1時間 → 5分ステップ
      { range: 86400, step: 3600 },    // 1日 → 1時間ステップ
      { range: 604800, step: 86400 },  // 1週間 → 1日ステップ
      { range: 2592000, step: 604800 }, // 1ヶ月 → 1週間ステップ
    ];
    
    for (const { range, step } of steps) {
      if (timeRange <= range) {
        return step;
      }
    }
    
    return 2592000; // デフォルト: 1ヶ月ステップ
  },
};

/**
 * 数値関連のユーティリティ関数
 */
export const NumberUtils = {
  /**
   * 数値を適切な桁数で丸める
   */
  roundToPrecision(value: number, precision: number = 2): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  },
  
  /**
   * 価格を適切な形式でフォーマット
   */
  formatPrice(price: number, decimals: number = 2): string {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  },
  
  /**
   * パーセンテージを計算
   */
  calculatePercentage(value: number, total: number): number {
    if (total === 0) return 0;
    return NumberUtils.roundToPrecision((value / total) * 100);
  },
  
  /**
   * 値の範囲をチェック
   */
  clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  },
};

/**
 * バリデーション関連のユーティリティ
 */
export const ValidationUtils = {
  /**
   * キーポイントの妥当性をチェック
   */
  validateKeyPoints(keyPoints: unknown[]): boolean {
    if (!Array.isArray(keyPoints) || keyPoints.length === 0) {
      logger.warn('[ValidationUtils] Invalid key points: not an array or empty');
      return false;
    }
    
    for (let i = 0; i < keyPoints.length; i++) {
      const point = keyPoints[i];
      if (!point || typeof point.time !== 'number' || typeof point.value !== 'number') {
        logger.warn('[ValidationUtils] Invalid key point at index', { 
          index: i, 
          point,
          hasTime: typeof point?.time,
          hasValue: typeof point?.value,
        });
        return false;
      }
    }
    
    return true;
  },
  
  /**
   * ラインデータの妥当性をチェック
   */
  validateLines(lines: unknown[]): boolean {
    if (!Array.isArray(lines)) {
      logger.warn('[ValidationUtils] Lines is not an array');
      return false;
    }
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line || !Array.isArray(line.points) || line.points.length < 2) {
        logger.warn('[ValidationUtils] Invalid line at index', { 
          index: i, 
          line,
          hasPoints: Array.isArray(line?.points),
          pointsLength: line?.points?.length,
        });
        return false;
      }
    }
    
    return true;
  },
  
  /**
   * ID形式の妥当性をチェック
   */
  validatePatternId(id: string): boolean {
    if (typeof id !== 'string' || id.trim().length === 0) {
      logger.warn('[ValidationUtils] Invalid pattern ID: not a string or empty');
      return false;
    }
    
    // 基本的な文字制限チェック
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(id)) {
      logger.warn('[ValidationUtils] Pattern ID contains invalid characters', { id });
      return false;
    }
    
    return true;
  },
};