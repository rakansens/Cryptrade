// Mock BaseService for testing
export const mockGet = jest.fn();
export const mockPost = jest.fn();
export const mockPut = jest.fn();
export const mockDelete = jest.fn();

// Mock ApiResponse type - matches the real interface
export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

// Mock ApiClient to match real implementation
export class ApiClient {
  async get<T>(url: string, params?: Record<string, string>, signal?: AbortSignal): Promise<ApiResponse<T>> {
    return mockGet(url, params, signal);
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
}

export class BaseService {
  protected basePath: string;
  protected client: ApiClient;
  
  constructor(basePath: string) {
    this.basePath = basePath;
    this.client = new ApiClient();
    console.log('[MOCK BaseService] constructed with basePath:', basePath);
  }
  
  protected async get<T>(url: string, params?: Record<string, string>, signal?: AbortSignal): Promise<ApiResponse<T>> {
    console.log('[MOCK BaseService] get called with:', { url, params });
    const resolvedUrl = this.resolve(url);
    console.log('[MOCK BaseService] resolved URL:', resolvedUrl);
    return this.client.get<T>(resolvedUrl, params, signal);
  }
  
  private resolve(endpoint: string): string {
    if (endpoint.startsWith('http')) return endpoint;
    if (endpoint.startsWith('/')) return endpoint;
    return `${this.basePath}/${endpoint}`;
  }
  
  protected async post<T>(url: string, data?: unknown, signal?: AbortSignal): Promise<ApiResponse<T>> {
    return this.client.post<T>(url, data, signal);
  }
  
  protected async put<T>(url: string, data?: unknown, signal?: AbortSignal): Promise<ApiResponse<T>> {
    return this.client.put<T>(url, data, signal);
  }
  
  protected async delete<T>(url: string, signal?: AbortSignal): Promise<ApiResponse<T>> {
    return this.client.delete<T>(url, signal);
  }
}