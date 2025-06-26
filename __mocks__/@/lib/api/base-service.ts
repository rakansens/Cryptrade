// __mocks__/@/lib/api/base-service.ts
// BaseServiceのモック実装

import { mockGet, mockPost, mockPut, mockDelete, ApiClient } from './client';

// BaseServiceモッククラス
export class BaseService {
  protected client: any;
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.client = new ApiClient({
      baseUrl: basePath,
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      rateLimit: {
        requests: 100,
        window: 60000,
      },
    });
  }

  protected async get<T>(url: string, params?: Record<string, string>, signal?: AbortSignal) {
    const resolvedUrl = this.resolve(url);
    return this.client.get<T>(resolvedUrl, params, signal);
  }

  protected async post<T>(url: string, data?: unknown, signal?: AbortSignal) {
    const resolvedUrl = this.resolve(url);
    return this.client.post<T>(resolvedUrl, data, signal);
  }

  protected async put<T>(url: string, data?: unknown, signal?: AbortSignal) {
    const resolvedUrl = this.resolve(url);
    return this.client.put<T>(resolvedUrl, data, signal);
  }

  protected async delete<T>(url: string, signal?: AbortSignal) {
    const resolvedUrl = this.resolve(url);
    return this.client.delete<T>(resolvedUrl, signal);
  }

  private resolve(endpoint: string): string {
    if (endpoint.startsWith('http')) return endpoint;
    if (endpoint.startsWith('/')) return endpoint;
    return `${this.basePath}/${endpoint}`;
  }
}