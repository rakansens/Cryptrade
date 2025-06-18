// Mock Mastra instance
export const mastra = {
  getAgent: jest.fn().mockReturnValue({
    runThread: jest.fn().mockResolvedValue({
      messages: [{ content: 'Mock response' }],
    }),
    runWorkflow: jest.fn().mockResolvedValue({
      result: 'Mock workflow result',
    }),
  }),
  getWorkflow: jest.fn().mockReturnValue({
    execute: jest.fn().mockResolvedValue({
      result: 'Mock workflow result',
    }),
  }),
  getTool: jest.fn().mockReturnValue({
    execute: jest.fn().mockResolvedValue({
      result: 'Mock tool result',
    }),
  }),
};

export const getTradingAgent = jest.fn().mockReturnValue(mastra.getAgent());
export const getOrchestrator = jest.fn().mockReturnValue(mastra.getAgent());
export const getPriceInquiryAgent = jest.fn().mockReturnValue(mastra.getAgent());
export const getUIControlAgent = jest.fn().mockReturnValue(mastra.getAgent());

export const getTelemetryStatus = jest.fn().mockReturnValue({
  isEnabled: false,
  samplingRate: 0,
});

export const executeTradingAnalysisWorkflow = jest.fn().mockResolvedValue({
  symbol: 'BTCUSDT',
  analysis: 'Mock analysis',
});