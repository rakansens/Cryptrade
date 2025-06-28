/**
 * 統合テストユーティリティ
 * 
 * test-factory.tsとtest-utils.tsxから重複を排除し、
 * 共通のテストユーティリティを提供
 * 
 * Created: 2025-06-28 - テストユーティリティの重複削減
 */

import type { ProcessedKline } from '@/types/market';

/**
 * 共通の待機ユーティリティ
 * waitForとwaitForElementを統合
 */
export class WaitUtility {
  static async forCondition(
    condition: () => boolean | Promise<boolean>,
    options: {
      timeout?: number;
      interval?: number;
      errorMessage?: string;
    } = {}
  ): Promise<void> {
    const { timeout = 5000, interval = 100, errorMessage = 'Timeout waiting for condition' } = options;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`${errorMessage} after ${timeout}ms`);
  }

  static async forElement(
    selector: string,
    options: {
      timeout?: number;
      interval?: number;
    } = {}
  ): Promise<Element> {
    const { timeout = 5000, interval = 100 } = options;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);
      if (element) return element;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Element ${selector} not found after ${timeout}ms`);
  }
}

/**
 * モックレスポンス作成ユーティリティ
 * createMockFetchResponseとmockFetchを統合
 */
export class MockResponseBuilder {
  static createResponse(
    data: any,
    options?: {
      status?: number;
      headers?: Record<string, string>;
      ok?: boolean;
    }
  ): Response {
    const { status = 200, headers = {}, ok = true } = options || {};
    
    const response = {
      ok,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: new Headers({ 'content-type': 'application/json', ...headers }),
      json: async () => data,
      text: async () => JSON.stringify(data),
      blob: async () => new Blob([JSON.stringify(data)], { type: 'application/json' }),
      arrayBuffer: async () => new ArrayBuffer(0),
      formData: async () => new FormData(),
      clone: function(): Response {
        return { ...response } as Response;
      },
      body: null,
      bodyUsed: false,
      redirected: false,
      type: 'basic' as ResponseType,
      url: '',
    } as Response;
    
    return response;
  }

  static createFetchMock(responses: Array<{ 
    url: string | RegExp; 
    response: any;
    status?: number;
    headers?: Record<string, string>;
  }>): jest.Mock {
    const fetchMock = jest.fn();
    
    fetchMock.mockImplementation(async (url: string, _options?: RequestInit) => {
      const match = responses.find(r => {
        if (typeof r.url === 'string') {
          return url.includes(r.url);
        }
        return r.url.test(url);
      });
      
      if (!match) {
        return Promise.reject(new Error(`No mock found for ${url}`));
      }
      
      if (match.response instanceof Error) {
        return Promise.reject(match.response);
      }
      
      return this.createResponse(match.response, {
        status: match.status,
        headers: match.headers,
        ok: match.status ? match.status >= 200 && match.status < 300 : true
      });
    });
    
    global.fetch = fetchMock;
    
    return fetchMock;
  }
}

/**
 * テストデータファクトリー
 * 共通のデータ生成パターンを提供
 */
export class TestDataFactory {
  /**
   * ローソク足データを生成
   */
  static createCandlestickData(options: {
    count?: number;
    basePrice?: number;
    startTime?: number;
    interval?: number;
    volatility?: number;
  } = {}): ProcessedKline[] {
    const {
      count = 100,
      basePrice = 45000,
      startTime = Date.now() - count * 60 * 60 * 1000,
      interval = 60 * 60 * 1000, // 1時間
      volatility = 0.02
    } = options;
    
    return Array.from({ length: count }, (_, i) => {
      const time = startTime + i * interval;
      const randomWalk = (Math.random() - 0.5) * basePrice * volatility;
      const open = basePrice + randomWalk;
      const close = open + (Math.random() - 0.5) * basePrice * volatility * 0.5;
      const high = Math.max(open, close) + Math.random() * basePrice * volatility * 0.2;
      const low = Math.min(open, close) - Math.random() * basePrice * volatility * 0.2;
      const volume = 1000 + Math.random() * 5000;
      
      return {
        time: time / 1000, // 秒に変換
        open,
        high,
        low,
        close,
        volume,
      };
    });
  }

  /**
   * WebSocketメッセージを生成
   */
  static createWebSocketMessage(type: string, data: any): string {
    return JSON.stringify({
      type,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * SSEイベントを生成
   */
  static createSSEEvent(event: string, data: any, id?: string): string {
    let message = '';
    if (id) message += `id: ${id}\n`;
    message += `event: ${event}\n`;
    message += `data: ${JSON.stringify(data)}\n\n`;
    return message;
  }
}

/**
 * 非同期操作ユーティリティ
 */
export class AsyncTestUtility {
  /**
   * Promiseをフラッシュ
   */
  static async flushPromises(): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, 0);
    });
  }

  /**
   * 遅延Promiseを作成
   */
  static createDeferredPromise<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error: any) => void;
  } {
    let resolve: (value: T) => void;
    let reject: (error: any) => void;
    
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    
    return {
      promise,
      resolve: resolve!,
      reject: reject!,
    };
  }

  /**
   * 実行時間を計測
   */
  static async measureExecutionTime<T>(
    fn: () => Promise<T> | T,
    label?: string
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    
    if (label) {
      console.log(`${label}: ${duration.toFixed(2)}ms`);
    }
    
    return { result, duration };
  }

  /**
   * アサーションをリトライ
   */
  static async retryAssertion(
    assertion: () => void | Promise<void>,
    options: {
      timeout?: number;
      interval?: number;
      onRetry?: (attempt: number) => void;
    } = {}
  ): Promise<void> {
    const { timeout = 5000, interval = 100, onRetry } = options;
    const startTime = Date.now();
    let attempt = 0;
    let lastError: Error | undefined;
    
    while (Date.now() - startTime < timeout) {
      try {
        await assertion();
        return;
      } catch (error) {
        lastError = error as Error;
        attempt++;
        if (onRetry) onRetry(attempt);
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    
    throw new Error(
      `Assertion failed after ${attempt} attempts: ${lastError?.message}`
    );
  }
}

/**
 * モックObserverユーティリティ
 */
export class MockObserverUtility {
  static createIntersectionObserver(): jest.Mock {
    const mockIntersectionObserver = jest.fn();
    mockIntersectionObserver.mockReturnValue({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    });
    
    window.IntersectionObserver = mockIntersectionObserver as any;
    
    return mockIntersectionObserver;
  }

  static createResizeObserver(): jest.Mock {
    const mockResizeObserver = jest.fn();
    mockResizeObserver.mockReturnValue({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    });
    
    window.ResizeObserver = mockResizeObserver as any;
    
    return mockResizeObserver;
  }
}

/**
 * テストセッション管理
 */
export class TestSessionManager {
  private cleanupFns: Array<() => Promise<void> | void> = [];
  
  createSessionId(prefix: string = 'test'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  addCleanup(cleanupFn: () => Promise<void> | void): void {
    this.cleanupFns.push(cleanupFn);
  }
  
  async cleanup(): Promise<void> {
    for (const fn of this.cleanupFns.reverse()) {
      await fn();
    }
    this.cleanupFns = [];
  }
}

/**
 * タイマーモック管理
 */
export class MockTimerManager {
  private currentTime: number;
  
  constructor(initialTime: number = Date.now()) {
    this.currentTime = initialTime;
  }
  
  advance(milliseconds: number): void {
    this.currentTime += milliseconds;
    jest.advanceTimersByTime(milliseconds);
  }
  
  getCurrentTime(): number {
    return this.currentTime;
  }
  
  install(): void {
    jest.useFakeTimers();
    jest.setSystemTime(this.currentTime);
  }
  
  uninstall(): void {
    jest.useRealTimers();
  }
}

/**
 * バリデーションユーティリティ
 */
export class ValidationUtility {
  static validateSchema(object: any, schema: Record<string, any>): string[] {
    const errors: string[] = [];
    
    for (const [key, validator] of Object.entries(schema)) {
      if (typeof validator === 'function') {
        if (!validator(object[key])) {
          errors.push(`Property ${key} failed validation`);
        }
      } else if (typeof validator === 'object' && validator !== null) {
        if (typeof object[key] !== 'object') {
          errors.push(`Property ${key} should be an object`);
        } else {
          const nestedErrors = this.validateSchema(object[key], validator);
          if (nestedErrors.length > 0) {
            errors.push(`Property ${key}: ${nestedErrors.join(', ')}`);
          }
        }
      } else if (object[key] !== validator) {
        errors.push(`Property ${key} should be ${validator} but was ${object[key]}`);
      }
    }
    
    return errors;
  }

  static async expectToReject(
    promise: Promise<any>,
    errorMessage?: string | RegExp
  ): Promise<void> {
    try {
      await promise;
      throw new Error('Expected promise to reject but it resolved');
    } catch (error) {
      if (errorMessage) {
        if (typeof errorMessage === 'string') {
          expect((error as Error).message).toContain(errorMessage);
        } else {
          expect((error as Error).message).toMatch(errorMessage);
        }
      }
    }
  }
}