import { BaseService } from '@/lib/api/base-service';
import { ApiClient } from '@/lib/api/client';
import { APP_CONSTANTS } from '@/config/app-constants';

// Mock dependencies
jest.mock('@/lib/api/client');
jest.mock('@/config/app-constants', () => ({
  APP_CONSTANTS: {
    api: {
      timeoutMs: 30000,
      rateLimit: {
        maxRequests: 10,
        windowMs: 60000,
      },
    },
  },
}));

// Create a concrete test implementation
class TestService extends BaseService {
  constructor(basePath: string) {
    super(basePath);
  }

  // Expose protected methods for testing
  testGet<T>(url: string, params?: Record<string, string>, signal?: AbortSignal) {
    return this.get<T>(url, params, signal);
  }

  testPost<T>(url: string, data?: unknown, signal?: AbortSignal) {
    return this.post<T>(url, data, signal);
  }

  testPut<T>(url: string, data?: unknown, signal?: AbortSignal) {
    return this.put<T>(url, data, signal);
  }

  testDelete<T>(url: string, signal?: AbortSignal) {
    return this.delete<T>(url, signal);
  }
}

describe('BaseService', () => {
  let service: TestService;
  let mockApiClient: jest.Mocked<ApiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock ApiClient constructor
    mockApiClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as any;

    (ApiClient as jest.MockedClass<typeof ApiClient>).mockImplementation(() => mockApiClient);
    
    service = new TestService('/api/test');
  });

  describe('constructor', () => {
    it('should initialize ApiClient with correct config', () => {
      expect(ApiClient).toHaveBeenCalledWith({
        baseUrl: '/api/test',
        timeout: 30000,
        retries: 3,
        retryDelay: 1000,
        rateLimit: {
          requests: 10,
          window: 60000,
        },
      });
    });
  });

  describe('GET requests', () => {
    it('should make GET request with relative path', async () => {
      const mockResponse = { data: { result: 'success' } };
      mockApiClient.get.mockResolvedValue(mockResponse as any);

      const result = await service.testGet('items');

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/test/items', undefined, undefined);
      expect(result).toBe(mockResponse);
    });

    it('should make GET request with params', async () => {
      const params = { limit: '10', offset: '0' };
      const signal = new AbortController().signal;
      mockApiClient.get.mockResolvedValue({ data: [] } as any);

      await service.testGet('items', params, signal);

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/test/items', params, signal);
    });

    it('should handle absolute paths', async () => {
      mockApiClient.get.mockResolvedValue({ data: {} } as any);

      await service.testGet('/absolute/path');

      expect(mockApiClient.get).toHaveBeenCalledWith('/absolute/path', undefined, undefined);
    });

    it('should handle full URLs', async () => {
      mockApiClient.get.mockResolvedValue({ data: {} } as any);

      await service.testGet('https://external.api/endpoint');

      expect(mockApiClient.get).toHaveBeenCalledWith('https://external.api/endpoint', undefined, undefined);
    });
  });

  describe('POST requests', () => {
    it('should make POST request with data', async () => {
      const data = { name: 'Test Item', value: 123 };
      const mockResponse = { data: { id: '123', ...data } };
      mockApiClient.post.mockResolvedValue(mockResponse as any);

      const result = await service.testPost('items', data);

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/test/items', data, undefined);
      expect(result).toBe(mockResponse);
    });

    it('should make POST request without data', async () => {
      mockApiClient.post.mockResolvedValue({ data: { created: true } } as any);

      await service.testPost('trigger');

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/test/trigger', undefined, undefined);
    });

    it('should pass abort signal', async () => {
      const signal = new AbortController().signal;
      const data = { test: true };
      mockApiClient.post.mockResolvedValue({ data: {} } as any);

      await service.testPost('items', data, signal);

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/test/items', data, signal);
    });
  });

  describe('PUT requests', () => {
    it('should make PUT request with data', async () => {
      const data = { name: 'Updated Item' };
      const mockResponse = { data: { updated: true } };
      mockApiClient.put.mockResolvedValue(mockResponse as any);

      const result = await service.testPut('items/123', data);

      expect(mockApiClient.put).toHaveBeenCalledWith('/api/test/items/123', data, undefined);
      expect(result).toBe(mockResponse);
    });

    it('should handle nested paths', async () => {
      const data = { status: 'active' };
      mockApiClient.put.mockResolvedValue({ data: {} } as any);

      await service.testPut('items/123/status', data);

      expect(mockApiClient.put).toHaveBeenCalledWith('/api/test/items/123/status', data, undefined);
    });
  });

  describe('DELETE requests', () => {
    it('should make DELETE request', async () => {
      const mockResponse = { data: { deleted: true } };
      mockApiClient.delete.mockResolvedValue(mockResponse as any);

      const result = await service.testDelete('items/123');

      expect(mockApiClient.delete).toHaveBeenCalledWith('/api/test/items/123', undefined);
      expect(result).toBe(mockResponse);
    });

    it('should pass abort signal', async () => {
      const signal = new AbortController().signal;
      mockApiClient.delete.mockResolvedValue({ data: {} } as any);

      await service.testDelete('items/456', signal);

      expect(mockApiClient.delete).toHaveBeenCalledWith('/api/test/items/456', signal);
    });
  });

  describe('path resolution', () => {
    it('should resolve relative paths correctly', async () => {
      mockApiClient.get.mockResolvedValue({ data: {} } as any);

      // Test various relative paths
      await service.testGet('items');
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/test/items', undefined, undefined);

      await service.testGet('items/123');
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/test/items/123', undefined, undefined);

      await service.testGet('deeply/nested/path');
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/test/deeply/nested/path', undefined, undefined);
    });

    it('should not modify absolute paths', async () => {
      mockApiClient.get.mockResolvedValue({ data: {} } as any);

      await service.testGet('/api/other/endpoint');
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/other/endpoint', undefined, undefined);
    });

    it('should not modify full URLs', async () => {
      mockApiClient.get.mockResolvedValue({ data: {} } as any);

      await service.testGet('http://example.com/api');
      expect(mockApiClient.get).toHaveBeenCalledWith('http://example.com/api', undefined, undefined);

      await service.testGet('https://secure.example.com/api');
      expect(mockApiClient.get).toHaveBeenCalledWith('https://secure.example.com/api', undefined, undefined);
    });
  });

  describe('error handling', () => {
    it('should propagate GET errors', async () => {
      const error = new Error('Network error');
      mockApiClient.get.mockRejectedValue(error);

      await expect(service.testGet('items')).rejects.toThrow('Network error');
    });

    it('should propagate POST errors', async () => {
      const error = new Error('Bad request');
      mockApiClient.post.mockRejectedValue(error);

      await expect(service.testPost('items', {})).rejects.toThrow('Bad request');
    });

    it('should propagate PUT errors', async () => {
      const error = new Error('Unauthorized');
      mockApiClient.put.mockRejectedValue(error);

      await expect(service.testPut('items/123', {})).rejects.toThrow('Unauthorized');
    });

    it('should propagate DELETE errors', async () => {
      const error = new Error('Not found');
      mockApiClient.delete.mockRejectedValue(error);

      await expect(service.testDelete('items/999')).rejects.toThrow('Not found');
    });
  });

  describe('different base paths', () => {
    it('should work with different base paths', async () => {
      const service1 = new TestService('/api/v1');
      const service2 = new TestService('/api/v2');
      
      // Clear mock calls from constructor
      mockApiClient.get.mockClear();
      mockApiClient.get.mockResolvedValue({ data: {} } as any);

      await service1.testGet('users');
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/users', undefined, undefined);

      mockApiClient.get.mockClear();
      
      await service2.testGet('users');
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v2/users', undefined, undefined);
    });

    it('should handle base path without leading slash', async () => {
      const service = new TestService('api/custom');
      mockApiClient.get.mockResolvedValue({ data: {} } as any);

      await service.testGet('endpoint');
      expect(mockApiClient.get).toHaveBeenCalledWith('api/custom/endpoint', undefined, undefined);
    });
  });
});