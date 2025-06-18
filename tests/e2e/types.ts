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