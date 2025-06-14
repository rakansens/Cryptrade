import { createTool } from '@mastra/core';
import { z } from 'zod';

/**
 * UI State Tool - UI状態管理ツール
 * 
 * インジケーター設定、チャート表示状態の管理
 * Chart Storeのindicatorsとsettingsを操作
 */

const UIStateInput = z.object({
  action: z.enum([
    'get_state',           // 現在の状態取得
    'toggle_indicator',    // インジケーターON/OFF
    'update_indicator_settings', // インジケーター設定変更
    'get_indicators',      // インジケーター状態取得
    'reset_indicators',    // インジケーター設定リセット
  ]),
  indicator: z.enum(['movingAverages', 'rsi', 'macd', 'bollingerBands']).optional(),
  enabled: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
});

const UIStateOutput = z.object({
  success: z.boolean(),
  action: z.string(),
  currentState: z.object({
    symbol: z.string(),
    timeframe: z.string(),
    indicators: z.record(z.boolean()),
    settings: z.record(z.unknown()),
  }).optional(),
  changes: z.array(z.string()).optional(),
  message: z.string(),
  error: z.string().optional(),
});

export const uiStateTool = createTool({
  id: 'ui-state-control',
  description: `
    UI state management tool for Cryptrade platform.
    Controls indicator settings, chart display options, and UI configurations.
    
    Actions:
    - get_state: Get current UI state
    - toggle_indicator: Enable/disable specific indicator
    - update_indicator_settings: Modify indicator parameters
    - get_indicators: Get all indicator states
    - reset_indicators: Reset all indicators to default
    
    Supported indicators:
    - movingAverages: Moving average lines
    - rsi: Relative Strength Index
    - macd: MACD indicator
    - bollingerBands: Bollinger Bands
  `,
  inputSchema: UIStateInput,
  outputSchema: UIStateOutput,

  execute: async ({ context }): Promise<z.infer<typeof UIStateOutput>> => {
    const { action, indicator, enabled, settings } = context;
    
    try {
      // ブラウザ環境チェック
      if (typeof window === 'undefined') {
        return {
          success: false,
          action,
          message: 'UI state control requires browser environment',
          error: 'Server-side execution not supported',
        };
      }

      // Chart Storeのアクセス
      const { useChartBaseStore, useIndicatorStore } = await import('@/store/chart');
      const baseStore = useChartBaseStore.getState();
      const indicatorStore = useIndicatorStore.getState();
      
      const changes: string[] = [];
      let message = '';

      switch (action) {
        case 'get_state':
          message = 'Current UI state retrieved';
          return {
            success: true,
            action,
            currentState: {
              symbol: baseStore.symbol,
              timeframe: baseStore.timeframe,
              indicators: indicatorStore.indicators,
              settings: indicatorStore.settings,
            },
            message,
          };

        case 'toggle_indicator':
          if (!indicator) {
            throw new Error('Indicator parameter required for toggle_indicator action');
          }
          
          // Map indicator names to store properties
          const indicatorMap = {
            'rsi': 'rsi',
            'macd': 'macd',
            'movingAverages': 'ma',
            'bollingerBands': 'boll'
          } as const;
          
          const storeKey = indicatorMap[indicator as keyof typeof indicatorMap];
          if (!storeKey) {
            throw new Error(`Unknown indicator: ${indicator}`);
          }
          
          const currentEnabled = indicatorStore.indicators[storeKey];
          const newEnabled = enabled !== undefined ? enabled : !currentEnabled;
          
          // インジケーター切り替え実行
          indicatorStore.setIndicatorEnabled(storeKey, newEnabled);
          
          changes.push(`${indicator}: ${currentEnabled} → ${newEnabled}`);
          message = `Indicator ${indicator} ${newEnabled ? 'enabled' : 'disabled'}`;
          break;

        case 'update_indicator_settings':
          if (!indicator || !settings) {
            throw new Error('Both indicator and settings parameters required');
          }
          
          // インジケーター設定更新
          Object.entries(settings).forEach(([key, value]) => {
            indicatorStore.setIndicatorSetting(indicator, key, value);
            changes.push(`${indicator}.${key}: ${value}`);
          });
          
          message = `Settings updated for ${indicator}`;
          break;

        case 'get_indicators':
          message = 'Indicator states retrieved';
          return {
            success: true,
            action,
            currentState: {
              symbol: baseStore.symbol,
              timeframe: baseStore.timeframe,
              indicators: indicatorStore.indicators,
              settings: indicatorStore.settings,
            },
            message,
          };

        case 'reset_indicators':
          // 全インジケーターリセット
          const indicatorKeys = Object.keys(indicatorStore.indicators) as Array<keyof typeof indicatorStore.indicators>;
          
          indicatorKeys.forEach(key => {
            const wasEnabled = indicatorStore.indicators[key];
            indicatorStore.setIndicatorEnabled(key, false);
            if (wasEnabled) {
              changes.push(`${key}: enabled → disabled`);
            }
          });
          
          message = 'All indicators reset to default (disabled)';
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      // 更新後の状態を取得
      const updatedBaseStore = useChartBaseStore.getState();
      const updatedIndicatorStore = useIndicatorStore.getState();

      return {
        success: true,
        action,
        currentState: {
          symbol: updatedBaseStore.symbol,
          timeframe: updatedBaseStore.timeframe,
          indicators: updatedIndicatorStore.indicators,
          settings: updatedIndicatorStore.settings,
        },
        changes,
        message,
      };

    } catch (error) {
      return {
        success: false,
        action,
        message: `UI state operation failed: ${action}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});