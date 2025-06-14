// lib/api/base-service.ts
// API呼び出しの共通基底クラス
// [2025-06-11] 初版 - APP_CONSTANTS + ApiClient を利用して統一的な HTTP 通信レイヤを提供

import { APP_CONSTANTS } from '@/config/app-constants';
import { ApiClient, type ApiResponse } from './client';

/**
 * APIサービス共通基底クラス
 * 各サービスはこのクラスを継承し、`this.client` 経由で HTTP 通信を行う。
 * 個別サービス側で `basePath` を指定することで、`/api/foo` といった名前空間を自動付与。
 */
export abstract class BaseService {
  protected readonly client: ApiClient;
  private readonly basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.client = new ApiClient({
      baseUrl: basePath,
      timeout: APP_CONSTANTS.api.timeoutMs,
      retries: 3,
      retryDelay: 1000,
      rateLimit: {
        requests: APP_CONSTANTS.api.rateLimit.maxRequests,
        window: APP_CONSTANTS.api.rateLimit.windowMs,
      },
    });
  }

  protected get<T>(url: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.client.get<T>(this.resolve(url), params);
  }

  protected post<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.client.post<T>(this.resolve(url), data);
  }

  protected put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.client.put<T>(this.resolve(url), data);
  }

  protected delete<T>(url: string): Promise<ApiResponse<T>> {
    return this.client.delete<T>(this.resolve(url));
  }

  // パス解決（basePath がフル URL の場合は重複しないよう調整）
  private resolve(endpoint: string): string {
    if (endpoint.startsWith('http')) return endpoint;
    if (endpoint.startsWith('/')) return endpoint; // 既に絶対パス
    return `${this.basePath}/${endpoint}`;
  }
} 