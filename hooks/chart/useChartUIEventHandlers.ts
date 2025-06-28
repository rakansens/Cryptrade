import { useChartBaseStore, useIndicatorStore } from '@/store/chart';
import { 
  validateUIEvent,
  type ToggleIndicatorEvent,
  type UpdateIndicatorSettingEvent,
  type ChangeSymbolEvent,
  type ChangeTimeframeEvent,
  type SetDrawingModeEvent,
  type AutoAnalysisEvent
} from '@/types/events/chart-ui-events';
import { useCursor } from './useCursor';
import type { ChartEventHandlers } from '../../components/chart/hooks/useAgentEventHandlers';
import type { IndicatorOptions } from '@/types/market';
import type { Timeframe, SymbolValue } from '@/constants/chart';
import type { IndicatorValue } from '@/types/store.types';
import { 
  useEventHandlerBase, 
  createEventHandlerConfig, 
  createEventListeners,
  type EventProcessor 
} from '../shared';

/**
 * Chart UI Event Handlers Hook
 * 
 * UI系のカスタムイベント（インジケーター、シンボル、時間軸変更等）を処理
 * 基盤フック useEventHandlerBase を使用してコードの重複を削減
 */

// Event type union for better type safety
type UIEventData = 
  | ToggleIndicatorEvent
  | UpdateIndicatorSettingEvent
  | ChangeSymbolEvent
  | ChangeTimeframeEvent
  | SetDrawingModeEvent
  | AutoAnalysisEvent;

export function useChartUIEventHandlers(handlers: ChartEventHandlers) {
  const setSymbol = useChartBaseStore(state => state.setSymbol);
  const setTimeframe = useChartBaseStore(state => state.setTimeframe);
  const setIndicatorEnabled = useIndicatorStore(state => state.setIndicatorEnabled);
  const setIndicatorSetting = useIndicatorStore(state => state.setIndicatorSetting);
  
  const { setCursor, resetCursor, setDrawingCursor } = useCursor();

  // Event operation mappings
  const operations = {
    'ui:toggleIndicator': 'Toggle indicator',
    'ui:updateIndicatorSetting': 'Update indicator setting',
    'ui:changeSymbol': 'Change symbol',
    'ui:changeTimeframe': 'Change timeframe',
    'chart:setDrawingMode': 'Set drawing mode',
    'chart:autoAnalysis': 'Auto analysis',
  };

  // Success message generators (generic to avoid type conflicts)
  const successMessages = {
    'ui:toggleIndicator': (data: any) => 
      `Indicator ${data.indicator} ${data.enabled ? 'enabled' : 'disabled'}`,
    'ui:updateIndicatorSetting': (data: any) => 
      `Updated ${data.indicator} setting: ${data.key}`,
    'ui:changeSymbol': (data: any) => 
      `Symbol changed to ${data.symbol}`,
    'ui:changeTimeframe': (data: any) => 
      `Timeframe changed to ${data.timeframe}`,
    'chart:setDrawingMode': (data: any) => 
      `Drawing mode set to ${data.mode}`,
    'chart:autoAnalysis': (data: any) => 
      `Auto ${data.type} analysis completed`,
  };

  // Event handler configuration
  const config = createEventHandlerConfig<any>(
    operations,
    successMessages,
    validateUIEvent
  );

  // Event processors (using any type to avoid type conflicts)
  const indicatorToggleProcessor: EventProcessor<any> = (data) => {
    setIndicatorEnabled(data.indicator as keyof IndicatorOptions, data.enabled);
  };

  const indicatorSettingProcessor: EventProcessor<any> = (data) => {
    setIndicatorSetting(data.indicator, data.key, data.value as IndicatorValue);
  };

  const symbolChangeProcessor: EventProcessor<any> = (data) => {
    setSymbol(data.symbol as SymbolValue);
  };

  const timeframeChangeProcessor: EventProcessor<any> = (data) => {
    setTimeframe(data.timeframe as Timeframe);
  };

  const drawingModeProcessor: EventProcessor<any> = (data) => {
    // This would normally use drawing actions, but we'll handle cursor here
    if (data.mode === 'none') {
      resetCursor();
    } else {
      setDrawingCursor();
    }
  };

  const autoAnalysisProcessor: EventProcessor<any> = async (data) => {
    if (!handlers.chartData || handlers.chartData.length === 0) {
      throw new Error('No chart data available');
    }

    // ChartAnalyzer import would be used here for actual analysis
    await import('@/lib/chart/drawing-primitives');
    
    // Analysis logic would go here - simplified for now
  };

  // Event listener configurations
  const eventListeners = createEventListeners([
    { eventType: 'ui:toggleIndicator', processor: indicatorToggleProcessor },
    { eventType: 'ui:updateIndicatorSetting', processor: indicatorSettingProcessor },
    { eventType: 'ui:changeSymbol', processor: symbolChangeProcessor },
    { eventType: 'ui:changeTimeframe', processor: timeframeChangeProcessor },
    { eventType: 'chart:setDrawingMode', processor: drawingModeProcessor },
    { eventType: 'chart:autoAnalysis', processor: autoAnalysisProcessor },
  ]);

  // Use the base event handler hook
  useEventHandlerBase(
    config,
    eventListeners,
    [
      setSymbol,
      setTimeframe,
      setIndicatorEnabled,
      setIndicatorSetting,
      setCursor,
      resetCursor,
      setDrawingCursor,
      handlers.chartData,
    ]
  );
}