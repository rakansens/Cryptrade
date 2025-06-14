import { useEffect } from 'react';
import { useChartStoreBase } from '@/store/chart.store';
import { validateUIEvent } from '@/types/events/chart-ui-events';
import { handleAgentError, showAgentSuccess, handleValidationError } from '@/lib/chart/agent-utils';
import { useCursor } from './useCursor';
import { logger } from '@/lib/utils/logger';
import type { ChartEventHandlers } from '../../components/chart/hooks/useAgentEventHandlers';

/**
 * Chart UI Event Handlers Hook
 * 
 * UI系のカスタムイベント（インジケーター、シンボル、時間軸変更等）を処理
 */

export function useChartUIEventHandlers(handlers: ChartEventHandlers) {
  const setSymbol = useChartStoreBase(state => state.setSymbol);
  const setTimeframe = useChartStoreBase(state => state.setTimeframe);
  const setIndicatorEnabled = useChartStoreBase(state => state.setIndicatorEnabled);
  const setIndicatorSetting = useChartStoreBase(state => state.setIndicatorSetting);
  
  const { setCursor, resetCursor, setDrawingCursor } = useCursor();

  useEffect(() => {
    // Indicator Toggle Handler
    const handleIndicatorToggle = (event: CustomEvent) => {
      const validation = validateUIEvent('ui:toggleIndicator', event.detail);
      if (!validation.success) {
        handleValidationError(validation, {
          eventType: 'ui:toggleIndicator',
          operation: 'Toggle indicator',
          payload: event.detail,
        });
        return;
      }

      const { indicator, enabled } = validation.data.data;
      logger.info('[UI Event] Handling indicator toggle', { indicator, enabled });
      
      try {
        setIndicatorEnabled(indicator, enabled);
        showAgentSuccess({
          eventType: 'ui:toggleIndicator',
          operation: 'Toggle indicator',
        }, `Indicator ${indicator} ${enabled ? 'enabled' : 'disabled'}`);
      } catch (error) {
        handleAgentError(error, {
          eventType: 'ui:toggleIndicator',
          operation: 'Toggle indicator',
          payload: { indicator, enabled },
        });
      }
    };

    // Indicator Setting Update Handler
    const handleIndicatorSettingUpdate = (event: CustomEvent) => {
      const validation = validateUIEvent('ui:updateIndicatorSetting', event.detail);
      if (!validation.success) {
        handleValidationError(validation, {
          eventType: 'ui:updateIndicatorSetting',
          operation: 'Update indicator setting',
          payload: event.detail,
        });
        return;
      }

      const { indicator, key, value } = validation.data.data;
      logger.info('[UI Event] Handling indicator setting update', { indicator, key, value });
      
      try {
        setIndicatorSetting(indicator, key, value);
        showAgentSuccess({
          eventType: 'ui:updateIndicatorSetting',
          operation: 'Update indicator setting',
        }, `Updated ${indicator} setting: ${key}`);
      } catch (error) {
        handleAgentError(error, {
          eventType: 'ui:updateIndicatorSetting',
          operation: 'Update indicator setting',
          payload: { indicator, key, value },
        });
      }
    };

    // Symbol Change Handler
    const handleSymbolChange = (event: CustomEvent) => {
      const validation = validateUIEvent('ui:changeSymbol', event.detail);
      if (!validation.success) {
        handleValidationError(validation, {
          eventType: 'ui:changeSymbol',
          operation: 'Change symbol',
          payload: event.detail,
        });
        return;
      }

      const { symbol } = validation.data.data;
      logger.info('[UI Event] Handling symbol change', { symbol });
      
      try {
        setSymbol(symbol);
        showAgentSuccess({
          eventType: 'ui:changeSymbol',
          operation: 'Change symbol',
        }, `Symbol changed to ${symbol}`);
      } catch (error) {
        handleAgentError(error, {
          eventType: 'ui:changeSymbol',
          operation: 'Change symbol',
          payload: { symbol },
        });
      }
    };

    // Timeframe Change Handler
    const handleTimeframeChange = (event: CustomEvent) => {
      const validation = validateUIEvent('ui:changeTimeframe', event.detail);
      if (!validation.success) {
        handleValidationError(validation, {
          eventType: 'ui:changeTimeframe',
          operation: 'Change timeframe',
          payload: event.detail,
        });
        return;
      }

      const { timeframe } = validation.data.data;
      logger.info('[UI Event] Handling timeframe change', { timeframe });
      
      try {
        setTimeframe(timeframe);
        showAgentSuccess({
          eventType: 'ui:changeTimeframe',
          operation: 'Change timeframe',
        }, `Timeframe changed to ${timeframe}`);
      } catch (error) {
        handleAgentError(error, {
          eventType: 'ui:changeTimeframe',
          operation: 'Change timeframe',
          payload: { timeframe },
        });
      }
    };

    // Drawing Mode Handler
    const handleSetDrawingMode = (event: CustomEvent) => {
      const validation = validateUIEvent('chart:setDrawingMode', event.detail);
      if (!validation.success) {
        handleValidationError(validation, {
          eventType: 'chart:setDrawingMode',
          operation: 'Set drawing mode',
          payload: event.detail,
        });
        return;
      }

      const { mode } = validation.data.data;
      logger.info('[UI Event] Handling set drawing mode', { mode });
      
      try {
        // This would normally use drawing actions, but we'll handle cursor here
        if (mode === 'none') {
          resetCursor();
        } else {
          setDrawingCursor();
        }
        
        showAgentSuccess({
          eventType: 'chart:setDrawingMode',
          operation: 'Set drawing mode',
        }, `Drawing mode set to ${mode}`);
      } catch (error) {
        handleAgentError(error, {
          eventType: 'chart:setDrawingMode',
          operation: 'Set drawing mode',
          payload: { mode },
        });
      }
    };

    // Auto Analysis Handler
    const handleAutoAnalysis = async (event: CustomEvent) => {
      const validation = validateUIEvent('chart:autoAnalysis', event.detail);
      if (!validation.success) {
        handleValidationError(validation, {
          eventType: 'chart:autoAnalysis',
          operation: 'Auto analysis',
          payload: event.detail,
        });
        return;
      }

      const { type, config } = validation.data.data;
      logger.info('[UI Event] Handling auto analysis', { type, config });
      
      if (!handlers.chartData || handlers.chartData.length === 0) {
        logger.warn('[UI Event] No chart data available for analysis');
        handleAgentError(new Error('No chart data available'), {
          eventType: 'chart:autoAnalysis',
          operation: 'Auto analysis',
          payload: { type, config },
        }, 'チャートデータがありません');
        return;
      }

      try {
        const { ChartAnalyzer } = await import('@/lib/chart/drawing-primitives');
        const analyzer = new ChartAnalyzer(handlers.chartData);
        
        // Analysis logic would go here - simplified for now
        showAgentSuccess({
          eventType: 'chart:autoAnalysis',
          operation: 'Auto analysis',
        }, `Auto ${type} analysis completed`);
      } catch (error) {
        handleAgentError(error, {
          eventType: 'chart:autoAnalysis',
          operation: 'Auto analysis',
          payload: { type, config },
        });
      }
    };

    // Event listeners array
    const eventListeners = [
      ['ui:toggleIndicator', handleIndicatorToggle],
      ['ui:updateIndicatorSetting', handleIndicatorSettingUpdate],
      ['ui:changeSymbol', handleSymbolChange],
      ['ui:changeTimeframe', handleTimeframeChange],
      ['chart:setDrawingMode', handleSetDrawingMode],
      ['chart:autoAnalysis', handleAutoAnalysis],
    ] as const;

    // Register event listeners
    eventListeners.forEach(([eventType, handler]) => {
      window.addEventListener(eventType, handler as EventListener);
    });

    logger.info('[UI Event Handlers] Registered UI event listeners', {
      eventCount: eventListeners.length,
      events: eventListeners.map(([type]) => type),
    });

    // Cleanup function
    return () => {
      eventListeners.forEach(([eventType, handler]) => {
        window.removeEventListener(eventType, handler as EventListener);
      });
      logger.info('[UI Event Handlers] Cleaned up UI event listeners');
    };
  }, [
    setSymbol,
    setTimeframe,
    setIndicatorEnabled,
    setIndicatorSetting,
    setCursor,
    resetCursor,
    setDrawingCursor,
    handlers.chartData,
  ]);
}