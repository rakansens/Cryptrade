// tests/unit/lib/api/base-service-simple.test.ts
// 最小限のテストで問題を調査

// Mock modules first
jest.mock('@/lib/utils/logger');
jest.mock('@/config/app-constants', () => ({
  APP_CONSTANTS: {
    api: {
      timeoutMs: 10000,
      rateLimit: {
        maxRequests: 10,
        windowMs: 1000,
      },
    },
  },
}));

// Import after mocking
import { BaseService } from '@/lib/api/base-service';

// Test service implementation
class TestService extends BaseService {
  constructor(basePath: string) {
    super(basePath);
  }

  async testGet<T>(url: string, params?: Record<string, string>, signal?: AbortSignal) {
    return this.get<T>(url, params, signal);
  }
}

describe('BaseService Simple Test', () => {
  it('should understand how BaseService works', async () => {
    const mockGet = jest.fn().mockResolvedValue({ data: 'ok' });
    
    const service = new TestService('/api/test');
    
    // clientをモック
    (service as any).client = { get: mockGet };
    
    // 呼び出してみる
    await service.testGet('items');
    
    // 何が渡されたか確認
    console.log('mockGet called with:', mockGet.mock.calls[0]);
    
    // BaseServiceは内部でthis.resolve()を使っているが、
    // this.client.getには何が渡されるか？
    expect(mockGet).toHaveBeenCalled();
    const [url, params, signal] = mockGet.mock.calls[0];
    console.log('URL passed to client.get:', url);
    
    // BaseService.tsのコードを見ると：
    // protected get<T>(url: string, params?: Record<string, string>, signal?: AbortSignal) {
    //   return this.client.get<T>(this.resolve(url), params, signal);
    // }
    // つまり、client.getにはthis.resolve(url)の結果が渡される
  });
  
  it('should test what resolve does', async () => {
    const mockGet = jest.fn().mockResolvedValue({ data: 'ok' });
    
    const service = new TestService('/api/test');
    (service as any).client = { get: mockGet };
    
    // resolveメソッドの動作を確認
    // 相対パス
    await service.testGet('items');
    console.log('Relative path call:', mockGet.mock.calls[0]);
    expect(mockGet).toHaveBeenCalledWith('/api/test/items', undefined, undefined);
    
    mockGet.mockClear();
    
    // 絶対パス
    await service.testGet('/absolute/path');
    console.log('Absolute path call:', mockGet.mock.calls[0]);
    expect(mockGet).toHaveBeenCalledWith('/absolute/path', undefined, undefined);
    
    mockGet.mockClear();
    
    // フルURL
    await service.testGet('https://example.com');
    console.log('Full URL call:', mockGet.mock.calls[0]);
    expect(mockGet).toHaveBeenCalledWith('https://example.com', undefined, undefined);
  });
  
  it('should understand the actual client.get calls', async () => {
    const mockGet = jest.fn().mockResolvedValue({ data: 'ok' });
    const mockPost = jest.fn().mockResolvedValue({ data: 'created' });
    
    const service = new TestService('/api/test');
    (service as any).client = { get: mockGet, post: mockPost };
    
    console.log('=== Testing actual calls ===');
    
    // GETリクエスト
    await service.testGet('items');
    console.log('GET items:', mockGet.mock.calls[0][0]);
    
    mockPost.mockClear();
    
    // POSTリクエスト
    await (service as any).post('items', { name: 'Test' });
    console.log('POST items:', mockPost.mock.calls[0][0]);
  });
});