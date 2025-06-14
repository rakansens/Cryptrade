/**
 * Test Factory Utilities
 * 
 * Factory functions for creating test data consistently across tests
 */

import type { 
  ProposalData, 
  ChartEventData, 
  DrawingEventData,
  PatternEventData 
} from '@/types/events/all-event-types';
import type { CandlestickData } from '@/types/market';

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
 */
export function createMockCandlestickData(count: number = 100): CandlestickData[] {
  const baseTime = Date.now() - count * 60 * 60 * 1000; // Start from count hours ago
  const basePrice = 45000;
  
  return Array.from({ length: count }, (_, i) => {
    const time = baseTime + i * 60 * 60 * 1000; // 1 hour intervals
    const randomWalk = (Math.random() - 0.5) * 1000;
    const open = basePrice + randomWalk;
    const close = open + (Math.random() - 0.5) * 500;
    const high = Math.max(open, close) + Math.random() * 200;
    const low = Math.min(open, close) - Math.random() * 200;
    const volume = 1000 + Math.random() * 5000;
    
    return {
      time: time / 1000, // Convert to seconds
      open,
      high,
      low,
      close,
      volume,
    };
  });
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
  type: DrawingEventData['type'],
  drawingType: string = 'trendline'
): DrawingEventData {
  const drawingId = `drawing-${Date.now()}`;
  
  switch (type) {
    case 'drawing.created':
      return {
        type,
        drawing: {
          id: drawingId,
          type: drawingType,
          points: [
            { time: Date.now() / 1000 - 3600, price: 45000 },
            { time: Date.now() / 1000, price: 46000 },
          ],
          style: {
            color: '#2196F3',
            lineWidth: 2,
          },
        },
      };
      
    case 'drawing.updated':
      return {
        type,
        drawingId,
        updates: {
          points: [
            { time: Date.now() / 1000 - 3600, price: 45500 },
            { time: Date.now() / 1000, price: 46500 },
          ],
        },
      };
      
    case 'drawing.deleted':
      return {
        type,
        drawingId,
      };
      
    default:
      return { type } as DrawingEventData;
  }
}

/**
 * Creates a mock pattern event
 */
export function createMockPatternEvent(
  type: PatternEventData['type'],
  patternType: string = 'flag'
): PatternEventData {
  const patternId = `pattern-${Date.now()}`;
  
  switch (type) {
    case 'pattern.detected':
      return {
        type,
        pattern: {
          id: patternId,
          type: patternType,
          confidence: 0.85,
          points: [
            { time: Date.now() / 1000 - 7200, price: 44000 },
            { time: Date.now() / 1000 - 3600, price: 45000 },
            { time: Date.now() / 1000, price: 44500 },
          ],
          prediction: {
            targetPrice: 46000,
            timeframe: '4h',
            confidence: 0.75,
          },
        },
      };
      
    case 'pattern.confirmed':
      return {
        type,
        patternId,
        confirmationPrice: 45500,
        confirmationTime: Date.now() / 1000,
      };
      
    case 'pattern.invalidated':
      return {
        type,
        patternId,
        reason: 'Price broke below support',
        invalidationPrice: 43500,
      };
      
    default:
      return { type } as PatternEventData;
  }
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
 */
export function createMockWebSocketMessage(
  type: string,
  data: any
): string {
  return JSON.stringify({
    type,
    data,
    timestamp: Date.now(),
  });
}

/**
 * Creates a mock SSE event
 */
export function createMockSSEEvent(
  event: string,
  data: any,
  id?: string
): string {
  let message = '';
  if (id) message += `id: ${id}\n`;
  message += `event: ${event}\n`;
  message += `data: ${JSON.stringify(data)}\n\n`;
  return message;
}

/**
 * Creates mock market stats
 */
export function createMockMarketStats() {
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
export function createMockIndicatorValues() {
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
export function createMockAIResponse(type: 'analysis' | 'chat' | 'proposal') {
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
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Creates a mock fetch response
 */
export function createMockFetchResponse(
  data: any,
  options?: {
    status?: number;
    headers?: Record<string, string>;
    ok?: boolean;
  }
) {
  return Promise.resolve({
    ok: options?.ok ?? true,
    status: options?.status ?? 200,
    headers: new Headers(options?.headers ?? { 'content-type': 'application/json' }),
    json: async () => data,
    text: async () => JSON.stringify(data),
    blob: async () => new Blob([JSON.stringify(data)], { type: 'application/json' }),
    arrayBuffer: async () => new ArrayBuffer(0),
    formData: async () => new FormData(),
    clone: () => createMockFetchResponse(data, options),
  } as Response);
}