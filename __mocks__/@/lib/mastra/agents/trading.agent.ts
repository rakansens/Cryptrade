// Mock for trading agent
export const tradingAgent = {
  name: 'tradingAgent',
  description: 'Mock trading agent',
  generate: jest.fn().mockResolvedValue({
    text: 'Mock response',
    toolCalls: [],
  }),
  stream: jest.fn().mockResolvedValue({
    textStream: (async function* () {
      yield 'Mock';
      yield ' response';
    })(),
  }),
  model: jest.fn(() => ({
    name: 'mock-model',
  })),
  tools: jest.fn(() => []),
  run: jest.fn().mockResolvedValue({
    result: 'Mock result',
  }),
};