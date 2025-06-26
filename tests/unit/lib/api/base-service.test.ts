// tests/unit/lib/api/base-service.test.ts
// BaseServiceクラスの単体テスト
// API通信基底クラスの動作確認

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

  async testPost<T>(url: string, data?: unknown, signal?: AbortSignal) {
    return this.post<T>(url, data, signal);
  }

  async testPut<T>(url: string, data?: unknown, signal?: AbortSignal) {
    return this.put<T>(url, data, signal);
  }

  async testDelete<T>(url: string, signal?: AbortSignal) {
    return this.delete<T>(url, signal);
  }
}

describe('BaseService', () => {
  let service: TestService;
  let mockGet: jest.Mock;
  let mockPost: jest.Mock;
  let mockPut: jest.Mock;
  let mockDelete: jest.Mock;

  beforeEach(() => {
    // モック関数を作成
    mockGet = jest.fn();
    mockPost = jest.fn();
    mockPut = jest.fn();
    mockDelete = jest.fn();

    // サービスインスタンスを作成
    service = new TestService('/api/test');
    
    // BaseServiceのclientプロパティを直接モック
    (service as any).client = {
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
    };

    // デフォルトのモック実装
    mockGet.mockResolvedValue({ data: { success: true } });
    mockPost.mockResolvedValue({ data: { created: true } });
    mockPut.mockResolvedValue({ data: { updated: true } });
    mockDelete.mockResolvedValue({ data: { deleted: true } });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET requests', () => {
    it('should make GET request with relative path', async () => {
      const result = await service.testGet('items');
      
      // BaseServiceがresolveメソッドで解決済みのURLを渡す
      expect(mockGet).toHaveBeenCalledWith('/api/test/items', undefined, undefined);
      expect(result.data).toEqual({ success: true });
    });

    it('should make GET request with params', async () => {
      const params = { limit: '10', offset: '0' };
      await service.testGet('items', params);
      
      expect(mockGet).toHaveBeenCalledWith('/api/test/items', params, undefined);
    });

    it('should handle absolute paths', async () => {
      await service.testGet('/absolute/path');
      
      expect(mockGet).toHaveBeenCalledWith('/absolute/path', undefined, undefined);
    });

    it('should handle full URLs', async () => {
      await service.testGet('https://external.api/endpoint');
      
      expect(mockGet).toHaveBeenCalledWith('https://external.api/endpoint', undefined, undefined);
    });
  });

  describe('POST requests', () => {
    it('should make POST request with data', async () => {
      const data = { name: 'Test Item' };
      const result = await service.testPost('items', data);
      
      expect(mockPost).toHaveBeenCalledWith('/api/test/items', data, undefined);
      expect(result.data).toEqual({ created: true });
    });

    it('should make POST request without data', async () => {
      await service.testPost('trigger');
      
      expect(mockPost).toHaveBeenCalledWith('/api/test/trigger', undefined, undefined);
    });

    it('should pass abort signal', async () => {
      const controller = new AbortController();
      const signal = controller.signal;
      const data = { test: true };
      
      await service.testPost('items', data, signal);
      
      expect(mockPost).toHaveBeenCalledWith('/api/test/items', data, signal);
    });
  });

  describe('PUT requests', () => {
    it('should make PUT request with data', async () => {
      const data = { name: 'Updated Item' };
      const result = await service.testPut('items/123', data);
      
      expect(mockPut).toHaveBeenCalledWith('/api/test/items/123', data, undefined);
      expect(result.data).toEqual({ updated: true });
    });

    it('should handle nested paths', async () => {
      const data = { status: 'active' };
      await service.testPut('items/123/status', data);
      
      expect(mockPut).toHaveBeenCalledWith('/api/test/items/123/status', data, undefined);
    });
  });

  describe('DELETE requests', () => {
    it('should make DELETE request', async () => {
      const result = await service.testDelete('items/123');
      
      expect(mockDelete).toHaveBeenCalledWith('/api/test/items/123', undefined);
      expect(result.data).toEqual({ deleted: true });
    });

    it('should pass abort signal', async () => {
      const controller = new AbortController();
      const signal = controller.signal;
      
      await service.testDelete('items/456', signal);
      
      expect(mockDelete).toHaveBeenCalledWith('/api/test/items/456', signal);
    });
  });

  describe('path resolution', () => {
    it('should resolve relative paths correctly', async () => {
      // Test multiple relative paths
      await service.testGet('items');
      expect(mockGet).toHaveBeenCalledWith('/api/test/items', undefined, undefined);
      
      await service.testGet('users/123');
      expect(mockGet).toHaveBeenCalledWith('/api/test/users/123', undefined, undefined);
      
      await service.testGet('deep/nested/path');
      expect(mockGet).toHaveBeenCalledWith('/api/test/deep/nested/path', undefined, undefined);
    });

    it('should not modify absolute paths', async () => {
      await service.testGet('/api/other/endpoint');
      
      expect(mockGet).toHaveBeenCalledWith('/api/other/endpoint', undefined, undefined);
    });

    it('should not modify full URLs', async () => {
      await service.testGet('http://example.com/api');
      expect(mockGet).toHaveBeenCalledWith('http://example.com/api', undefined, undefined);
      
      await service.testGet('https://secure.example.com/data');
      expect(mockGet).toHaveBeenCalledWith('https://secure.example.com/data', undefined, undefined);
    });
  });

  describe('error handling', () => {
    it('should propagate GET errors', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'));
      
      await expect(service.testGet('items')).rejects.toThrow('Network error');
    });

    it('should propagate POST errors', async () => {
      mockPost.mockRejectedValueOnce(new Error('Bad request'));
      
      await expect(service.testPost('items', {})).rejects.toThrow('Bad request');
    });

    it('should propagate PUT errors', async () => {
      mockPut.mockRejectedValueOnce(new Error('Unauthorized'));
      
      await expect(service.testPut('items/123', {})).rejects.toThrow('Unauthorized');
    });

    it('should propagate DELETE errors', async () => {
      mockDelete.mockRejectedValueOnce(new Error('Not found'));
      
      await expect(service.testDelete('items/999')).rejects.toThrow('Not found');
    });
  });

  describe('different base paths', () => {
    it('should work with different base paths', async () => {
      const service1 = new TestService('/api/v1');
      const service2 = new TestService('/api/v2');
      
      // Mock the clients
      (service1 as any).client = { get: mockGet };
      (service2 as any).client = { get: mockGet };
      
      await service1.testGet('users');
      expect(mockGet).toHaveBeenCalledWith('/api/v1/users', undefined, undefined);
      
      mockGet.mockClear();
      
      await service2.testGet('users');
      expect(mockGet).toHaveBeenCalledWith('/api/v2/users', undefined, undefined);
    });

    it('should handle base path without leading slash', async () => {
      const service = new TestService('api/custom');
      (service as any).client = { get: mockGet };
      
      await service.testGet('endpoint');
      
      expect(mockGet).toHaveBeenCalledWith('api/custom/endpoint', undefined, undefined);
    });
  });
});