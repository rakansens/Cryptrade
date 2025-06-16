/// <reference types="@playwright/test" />

/**
 * E2E Test Type Definitions
 */

// Page object interfaces
export interface ChartPage {
  container: string;
  toolbar: {
    symbolSelector: string;
    timeframeSelector: string;
    indicatorButton: string;
    drawingButton: string;
  };
  canvas: string;
}

export interface ChatPanel {
  container: string;
  input: string;
  sendButton: string;
  messages: string;
  proposalCard: string;
}

export interface DrawingTools {
  trendline: string;
  horizontalLine: string;
  verticalLine: string;
  rectangle: string;
  fibonacci: string;
  text: string;
}

// Test data structures
export interface TestSymbol {
  symbol: string;
  displayName: string;
  expectedPrice?: number;
}

export interface TestDrawing {
  type: 'trendline' | 'horizontal' | 'vertical' | 'rectangle' | 'fibonacci' | 'text';
  points: Array<{ x: number; y: number }>;
  style?: {
    color?: string;
    lineWidth?: number;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
  };
}

export interface TestMessage {
  text: string;
  expectedResponse?: string;
  expectedAction?: 'symbol_change' | 'timeframe_change' | 'indicator_add' | 'drawing_add';
}

// Helper function types
export type WaitForChartLoad = (page: import('@playwright/test').Page) => Promise<void>;
export type SendChatMessage = (page: import('@playwright/test').Page, message: string) => Promise<void>;
export type DrawOnChart = (page: import('@playwright/test').Page, drawing: TestDrawing) => Promise<void>;

// Test data constants
export const TEST_SYMBOLS: TestSymbol[] = [
  { symbol: 'BTCUSDT', displayName: 'BTC' },
  { symbol: 'ETHUSDT', displayName: 'ETH' },
  { symbol: 'BNBUSDT', displayName: 'BNB' }
];

export const TEST_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;

export const TEST_SELECTORS = {
  chart: {
    container: '[data-testid="chart-container"]',
    toolbar: {
      symbolSelector: '[data-testid="symbol-selector"]',
      timeframeSelector: '[data-testid="timeframe-selector"]',
      indicatorButton: '[data-testid="indicator-button"]',
      drawingButton: '[data-testid="drawing-button"]'
    },
    canvas: 'canvas'
  },
  chat: {
    container: '[data-testid="chat-panel"]',
    input: '[data-testid="chat-input"]',
    sendButton: '[data-testid="send-button"]',
    messages: '[data-testid="message-list"]',
    proposalCard: '[data-testid="proposal-card"]'
  },
  drawing: {
    trendline: '[data-testid="tool-trendline"]',
    horizontalLine: '[data-testid="tool-horizontal"]',
    verticalLine: '[data-testid="tool-vertical"]',
    rectangle: '[data-testid="tool-rectangle"]',
    fibonacci: '[data-testid="tool-fibonacci"]',
    text: '[data-testid="tool-text"]'
  }
} as const;

// Extend Playwright's test object with custom fixtures
declare global {
  namespace PlaywrightTest {
    interface Matchers<R> {
      toHaveChartData(): R;
      toHaveDrawing(type: TestDrawing['type']): R;
    }
  }
}