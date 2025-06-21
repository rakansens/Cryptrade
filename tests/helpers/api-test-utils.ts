/**
 * Shared test utilities and mock data for API integration tests
 */

import { jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { DrawingProposalGroup, DrawingProposal } from '../../types/proposals';
import { ProposalStatus, ProposalType } from '../../types/enums';
import { BinanceKline, BinanceTicker24hr } from '../../types/market';

// Mock data generators
export const mockData = {
  // Chat/Orchestrator mocks
  createOrchestratorResult(overrides?: {
    analysis?: {
      intent?: string;
      confidence?: number;
      symbol?: string;
      isProposalMode?: boolean;
    };
    executionResult?: {
      success?: boolean;
      message?: string;
    };
    executionTime?: number;
    success?: boolean;
  }) {
    return {
      analysis: {
        intent: 'market_query',
        confidence: 0.9,
        symbol: 'BTCUSDT',
        isProposalMode: false,
        ...overrides?.analysis
      },
      executionResult: {
        success: true,
        message: 'Analysis completed',
        ...overrides?.executionResult
      },
      executionTime: 1500,
      success: true,
      ...overrides
    };
  },

  // Proposal mocks
  createProposal(overrides?: Partial<DrawingProposal>): DrawingProposal {
    return {
      id: `prop_${Date.now()}`,
      type: ProposalType.TRENDLINE,
      analysisType: 'trendline',
      coordinates: {
        start: { x: 1640995200000, y: 46432.01 },
        end: { x: 1641081600000, y: 47890.12 }
      },
      reasoning: 'Strong uptrend detected',
      confidence: 0.85,
      priority: 'medium',
      status: ProposalStatus.PENDING,
      createdAt: Date.now(),
      ...overrides
    };
  },

  createProposalGroup(overrides?: Partial<DrawingProposalGroup>): DrawingProposalGroup {
    return {
      id: `pg_${Date.now()}`,
      title: 'Test Proposal Group',
      description: 'Test proposal group for unit tests',
      proposals: [mockData.createProposal()],
      groupType: 'analysis',
      createdAt: Date.now(),
      ...overrides
    };
  },

  createChartDrawing(overrides?: Partial<any>): any {
    return {
      id: `drawing_${Date.now()}`,
      type: 'trendline',
      data: {
        points: [
          { time: 1640995200, price: 46432.01 },
          { time: 1641081600, price: 47890.12 }
        ]
      },
      options: {
        color: '#FF0000',
        lineWidth: 2,
        lineStyle: 0
      },
      proposalId: `prop_${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...overrides
    };
  },

  // Market data mocks
  createKline(_overrides?: Partial<BinanceKline>): BinanceKline {
    const kline: BinanceKline = [
      1640995200000,  // openTime
      "46432.01",     // open
      "46505.00",     // high
      "46247.01",     // low
      "46306.01",     // close
      "1458.50600000", // volume
      1640998799999,  // closeTime
      "67591014.88",  // quoteAssetVolume
      7890,           // numberOfTrades
      "729.25300000", // takerBuyBaseAssetVolume
      "33784638.26",  // takerBuyQuoteAssetVolume
      "0"             // unused
    ];
    return kline;
  },

  createTicker(overrides?: Partial<BinanceTicker24hr>): BinanceTicker24hr {
    return {
      symbol: "BTCUSDT",
      priceChange: "-1234.56",
      priceChangePercent: "-1.23",
      weightedAvgPrice: "108234.56",
      prevClosePrice: "109876.54",
      lastPrice: "108641.98",
      lastQty: "0.00123",
      bidPrice: "108640.00",
      bidQty: "1.23456",
      askPrice: "108642.00",
      askQty: "2.34567",
      openPrice: "109876.54",
      highPrice: "110234.56",
      lowPrice: "107890.12",
      volume: "12345.67890",
      quoteVolume: "1338456789.12",
      openTime: 1640995200000,
      closeTime: 1641081599999,
      firstId: 100000000,
      lastId: 100100000,
      count: 100000,
      ...overrides
    };
  },

  // Analysis progress mocks
  createAnalysisProgressEvent(type: string, data: unknown): {
    type: string;
    sessionId: string;
    timestamp: number;
    data: unknown;
  } {
    return {
      type,
      sessionId: `session_${Date.now()}`,
      timestamp: Date.now(),
      data
    };
  }
};

// Request builders
export const requestBuilders = {
  createGetRequest(url: string, headers?: Record<string, string>): NextRequest {
    return new NextRequest(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    });
  },

  createPostRequest(url: string, body: unknown, headers?: Record<string, string>): NextRequest {
    return new NextRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(body)
    });
  }
};

// Response helpers
export const responseHelpers = {
  async parseJsonResponse(response: Response): Promise<any> {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${text}`);
    }
  },

  async collectSSEEvents(response: Response, timeoutMs = 5000): Promise<unknown[]> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const events: unknown[] = [];

    const timeout = setTimeout(() => {
      reader.cancel();
    }, timeoutMs);

    let currentEvent: { event: string | undefined; data: string[] } = { event: undefined, data: [] };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Ensure value is an ArrayBuffer or compatible type
        const chunk = decoder.decode(value as ArrayBuffer);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent.event = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            currentEvent.data.push(line.slice(5));
          } else if (line.trim() === '') {
            if (currentEvent.data.length) {
              const dataStr = currentEvent.data.join('\n');
              let parsed: unknown = dataStr;
              if (dataStr.trim() && dataStr !== '[DONE]') {
                try {
                  parsed = JSON.parse(dataStr);
                } catch (e) {
                  // keep raw string
                }
              }
              if (currentEvent.event) {
                events.push({ event: currentEvent.event, data: parsed });
              } else {
                events.push(parsed);
              }
            }
            currentEvent = { event: undefined, data: [] };
          }
        }
      }
    } finally {
      clearTimeout(timeout);
    }

    return events;
  }
};

// Mock fetch helper
export function createMockFetch(): {
  mockFetch: jest.Mock<any>;
  mockSuccessResponse: (data: unknown, options?: { status?: number; headers?: Record<string, string> }) => void;
  mockErrorResponse: (status: number, statusText: string, data?: unknown) => void;
  mockNetworkError: (error: Error) => void;
} {
  const mockFetch = jest.fn<any>();
  
  return {
    mockFetch,
    mockSuccessResponse(data: unknown, options?: { status?: number; headers?: Record<string, string> }) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: options?.status || 200,
        statusText: 'OK',
        headers: new Headers(options?.headers || {}),
        json: async () => data,
        text: async () => JSON.stringify(data)
      } as Response);
    },
    mockErrorResponse(status: number, statusText: string, data?: unknown) {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status,
        statusText,
        json: async () => data || { error: statusText },
        text: async () => JSON.stringify(data || { error: statusText })
      } as Response);
    },
    mockNetworkError(error: Error) {
      mockFetch.mockRejectedValueOnce(error);
    }
  };
}

// Test environment helpers
export const testHelpers = {
  waitForCondition(condition: () => boolean, timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        if (condition()) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - startTime > timeoutMs) {
          clearInterval(interval);
          reject(new Error('Condition not met within timeout'));
        }
      }, 100);
    });
  },

  async measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    const result = await fn();
    const duration = Date.now() - startTime;
    return { result, duration };
  }
};