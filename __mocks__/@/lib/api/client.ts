// __mocks__/@/lib/api/client.ts
// ApiClientのモック実装

// Named exports for spying on methods
export const mockGet = jest.fn();
export const mockPost = jest.fn();
export const mockPut = jest.fn();
export const mockDelete = jest.fn();

// Mock constructor
const mockApiClient = jest.fn().mockImplementation((config) => ({
  get: mockGet,
  post: mockPost,
  put: mockPut,
  delete: mockDelete,
  config: config,
}));

export const ApiClient = mockApiClient;

// Type exports
export type ApiResponse<T> = {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
};

export type ApiClientConfig = {
  baseUrl: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  rateLimit: {
    requests: number;
    window: number;
  };
};

// Export default client creation functions (for compatibility)
export const createBinanceClient = jest.fn(() => new ApiClient({
  baseUrl: '/api/binance',
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  rateLimit: {
    requests: 10,
    window: 1000,
  },
}));

export const createExternalBinanceClient = jest.fn(() => new ApiClient({
  baseUrl: 'https://api.binance.com/api/v3',
  timeout: 5000,
  retries: 2,
  retryDelay: 500,
  rateLimit: {
    requests: 5,
    window: 1000,
  },
}));