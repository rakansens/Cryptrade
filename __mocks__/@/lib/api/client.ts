// Mock ApiClient for testing
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();

// Export mocks for tests to use
export { mockGet, mockPost, mockPut, mockDelete };

// Mock ApiResponse type - matches the real interface
export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  rateLimit?: {
    requests: number;
    window: number;
  };
}

export class ApiClient {
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;
  }

  async get<T>(url: string, params?: Record<string, string>, signal?: AbortSignal): Promise<ApiResponse<T>> {
    console.log('[MOCK ApiClient] get called with:', { url, params });
    const result = await mockGet(url, params, signal);
    console.log('[MOCK ApiClient] mockGet result:', result);
    return result;
  }
  
  async post<T>(url: string, data?: unknown, signal?: AbortSignal): Promise<ApiResponse<T>> {
    return mockPost(url, data, signal);
  }
  
  async put<T>(url: string, data?: unknown, signal?: AbortSignal): Promise<ApiResponse<T>> {
    return mockPut(url, data, signal);
  }
  
  async delete<T>(url: string, signal?: AbortSignal): Promise<ApiResponse<T>> {
    return mockDelete(url, signal);
  }
  
  async execute<T>(url: string, init: RequestInit = {}, signal?: AbortSignal): Promise<ApiResponse<T>> {
    const method = init.method || 'GET';
    if (method === 'GET') return this.get<T>(url, undefined, signal);
    if (method === 'POST') return this.post<T>(url, init.body, signal);
    if (method === 'PUT') return this.put<T>(url, init.body, signal);
    if (method === 'DELETE') return this.delete<T>(url, signal);
    throw new Error(`Unsupported method: ${method}`);
  }
}