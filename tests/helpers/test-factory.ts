/**
 * Test Factory Utilities
 * 
 * Factory functions for creating test data consistently across tests
 */

import type { EventPayload } from '../../types/events/all-event-types';
import type { ProcessedKline } from '../../types/market';
import { TestDataFactory, WaitUtility, MockResponseBuilder } from '../utils/common-test-utilities';

// Define custom types for test data
interface ProposalData {
  id: string;
  type: string;
  symbol: string;
  direction: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  reasoning: string;
  timeframe: string;
  timestamp: string;
}

interface ChartEventData {
  type: string;
  symbol?: string;
  interval?: string;
  data?: ProcessedKline[];
  previousSymbol?: string;
  timeframe?: string;
  previousTimeframe?: string;
  indicator?: any;
  timestamp?: string;
  [key: string]: any;
}

type DrawingEventData = EventPayload<'draw:trendline'>;
type PatternEventData = EventPayload<'chart:addPattern'>;

/**
 * Creates a mock proposal for testing
 */
export function createMockProposal(overrides?: Partial<ProposalData>): ProposalData {
  return {
    id: `test-proposal-${Date.now()}`,
    type: 'entry',
    symbol: 'BTCUSDT',
    direction: 'long',
    entryPrice: 45000,
    stopLoss: 44000,
    takeProfit: 46000,
    confidence: 0.85,
    reasoning: 'Test proposal reasoning',
    timeframe: '1h',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates mock candlestick data for testing
 * @deprecated Use TestDataFactory.createCandlestickData instead
 */
export function createMockCandlestickData(count: number = 100): ProcessedKline[] {
  return TestDataFactory.createCandlestickData({ count });
}

/**
 * Creates a mock chart event
 */
export function createMockChartEvent(
  type: ChartEventData['type'],
  data?: Partial<ChartEventData>
): ChartEventData {
  const baseEvent = {
    timestamp: new Date().toISOString(),
  };

  switch (type) {
    case 'chart.symbolChanged':
      return {
        type,
        symbol: 'BTCUSDT',
        previousSymbol: 'ETHUSDT',
        ...baseEvent,
        ...data,
      } as ChartEventData;
      
    case 'chart.timeframeChanged':
      return {
        type,
        timeframe: '1h',
        previousTimeframe: '15m',
        ...baseEvent,
        ...data,
      } as ChartEventData;
      
    case 'chart.indicatorAdded':
      return {
        type,
        indicator: {
          id: 'rsi-1',
          type: 'RSI',
          settings: { period: 14 },
        },
        ...baseEvent,
        ...data,
      } as ChartEventData;
      
    default:
      return {
        type,
        ...baseEvent,
        ...data,
      } as ChartEventData;
  }
}

/**
 * Creates a mock drawing event
 */
export function createMockDrawingEvent(
  overrides?: Partial<DrawingEventData>
): DrawingEventData {
  return {
    points: [
      { time: Date.now() / 1000 - 3600, value: 45000 },
      { time: Date.now() / 1000, value: 46000 },
    ],
    style: {
      color: '#2196F3',
      lineWidth: 2,
      lineStyle: 'solid',
    },
    ...overrides,
  };
}

/**
 * Creates a mock pattern event
 */
export function createMockPatternEvent(
  patternType: string = 'flag',
  overrides?: Partial<PatternEventData>
): PatternEventData {
  const patternId = `pattern-${Date.now()}`;
  
  return {
    id: patternId,
    pattern: {
      type: patternType,
      visualization: {
        lines: [
          { time: Date.now() / 1000 - 7200, value: 44000 },
          { time: Date.now() / 1000 - 3600, value: 45000 },
          { time: Date.now() / 1000, value: 44500 },
        ],
      },
      metrics: {
        target_level: 46000,
        stop_loss: 43000,
        breakout_level: 45500,
      },
    },
    ...overrides,
  };
}

/**
 * Creates a mock user context for testing
 */
export function createMockUserContext(overrides?: Record<string, any>) {
  return {
    userLevel: 'intermediate',
    marketStatus: 'open',
    preferredSymbol: 'BTCUSDT',
    riskTolerance: 'medium',
    tradingStyle: 'swing',
    ...overrides,
  };
}

/**
 * Creates a mock WebSocket message
 * @deprecated Use TestDataFactory.createWebSocketMessage instead
 */
export function createMockWebSocketMessage(
  type: string,
  data: any
): string {
  return TestDataFactory.createWebSocketMessage(type, data);
}

/**
 * Creates a mock SSE event
 * @deprecated Use TestDataFactory.createSSEEvent instead
 */
export function createMockSSEEvent(
  event: string,
  data: any,
  id?: string
): string {
  return TestDataFactory.createSSEEvent(event, data, id);
}

/**
 * Creates mock market stats
 */
export function createMockMarketStats(): {
  price: number;
  priceChange: number;
  priceChangePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  marketCap: number;
} {
  return {
    price: 45000,
    priceChange: 500,
    priceChangePercent: 1.12,
    high24h: 46000,
    low24h: 44000,
    volume24h: 1234567890,
    marketCap: 876543210000,
  };
}

/**
 * Creates mock indicator values
 */
export function createMockIndicatorValues(): {
  rsi: {
    value: number;
    signal: 'neutral' | 'bullish' | 'bearish';
    overbought: boolean;
    oversold: boolean;
  };
  macd: {
    macd: number;
    signal: number;
    histogram: number;
    trend: 'bullish' | 'bearish' | 'neutral';
  };
  sma: {
    sma20: number;
    sma50: number;
    sma200: number;
  };
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
  };
} {
  return {
    rsi: {
      value: 65,
      signal: 'neutral' as const,
      overbought: false,
      oversold: false,
    },
    macd: {
      macd: 150,
      signal: 140,
      histogram: 10,
      trend: 'bullish' as const,
    },
    sma: {
      sma20: 44800,
      sma50: 44500,
      sma200: 43000,
    },
    bollinger: {
      upper: 46000,
      middle: 45000,
      lower: 44000,
      bandwidth: 0.045,
    },
  };
}

/**
 * Creates a mock AI response
 */
export function createMockAIResponse(type: 'analysis' | 'chat' | 'proposal'): any {
  switch (type) {
    case 'analysis':
      return {
        analysis: 'Based on current market conditions, BTC shows bullish momentum...',
        indicators: {
          rsi: 'Neutral at 65',
          macd: 'Bullish crossover',
          volume: 'Above average',
        },
        recommendation: 'Consider long position with proper risk management',
        confidence: 0.75,
      };
      
    case 'chat':
      return {
        response: 'I understand you want to know about BTC. Let me analyze...',
        intent: 'price_inquiry',
        metadata: {
          processedBy: 'trading-agent',
          executionTime: 234,
        },
      };
      
    case 'proposal':
      return createMockProposal();
      
    default:
      return {};
  }
}

/**
 * Utility to wait for a condition to be true
 * @deprecated Use WaitUtility.forCondition instead
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  return WaitUtility.forCondition(condition, { timeout, interval });
}

/**
 * Creates a mock fetch response
 * @deprecated Use MockResponseBuilder.createResponse instead
 */
export function createMockFetchResponse(
  data: any,
  options?: {
    status?: number;
    headers?: Record<string, string>;
    ok?: boolean;
  }
): Promise<Response> {
  return Promise.resolve(MockResponseBuilder.createResponse(data, options));
}