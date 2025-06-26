// __mocks__/@/lib/api/client.ts
// ApiClientのモック実装

// Named exports for spying on methods
export const mockGet = jest.fn();
export const mockPost = jest.fn();
export const mockPut = jest.fn();
export const mockDelete = jest.fn();

// Mock constructor
const mockApiClient = jest.fn().mockImplementation(() => ({
  get: mockGet,
  post: mockPost,
  put: mockPut,
  delete: mockDelete,
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