// Mock all dependencies before imports
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();

const MockApiClient = jest.fn().mockImplementation(() => ({
  get: mockGet,
  post: mockPost,
  put: mockPut,
  delete: mockDelete,
}));

jest.mock('@/lib/api/client', () => ({
  ApiClient: MockApiClient,
}));

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

// Import after mocking
import { BaseService } from '@/lib/api/base-service';

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

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockClear();
    mockPost.mockClear();
    mockPut.mockClear();
    mockDelete.mockClear();
    MockApiClient.mockClear();
    
    service = new TestService('/api/test');
  });

  describe('constructor', () => {
    it('should initialize ApiClient with correct config', () => {
      expect(MockApiClient).toHaveBeenCalledWith({
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
      mockGet.mockResolvedValue(mockResponse);

      const result = await service.testGet('items');

      expect(mockGet).toHaveBeenCalledWith('/api/test/items', undefined, undefined);
      expect(result).toBe(mockResponse);
    });

    it('should make GET request with params', async () => {
      const params = { limit: '10', offset: '0' };
      const signal = new AbortController().signal;
      mockGet.mockResolvedValue({ data: [] });

      await service.testGet('items', params, signal);

      expect(mockGet).toHaveBeenCalledWith('/api/test/items', params, signal);
    });

    it('should handle absolute paths', async () => {
      mockGet.mockResolvedValue({ data: {} });

      await service.testGet('/absolute/path');

      expect(mockGet).toHaveBeenCalledWith('/absolute/path', undefined, undefined);
    });

    it('should handle full URLs', async () => {
      mockGet.mockResolvedValue({ data: {} });

      await service.testGet('https://external.api/endpoint');

      expect(mockGet).toHaveBeenCalledWith('https://external.api/endpoint', undefined, undefined);
    });
  });

  describe('POST requests', () => {
    it('should make POST request with data', async () => {
      const data = { name: 'Test Item', value: 123 };
      const mockResponse = { data: { id: '123', ...data } };
      mockPost.mockResolvedValue(mockResponse);

      const result = await service.testPost('items', data);

      expect(mockPost).toHaveBeenCalledWith('/api/test/items', data, undefined);
      expect(result).toBe(mockResponse);
    });

    it('should make POST request without data', async () => {
      mockPost.mockResolvedValue({ data: { created: true } });

      await service.testPost('trigger');

      expect(mockPost).toHaveBeenCalledWith('/api/test/trigger', undefined, undefined);
    });

    it('should pass abort signal', async () => {
      const signal = new AbortController().signal;
      const data = { test: true };
      mockPost.mockResolvedValue({ data: {} });

      await service.testPost('items', data, signal);

      expect(mockPost).toHaveBeenCalledWith('/api/test/items', data, signal);
    });
  });

  describe('PUT requests', () => {
    it('should make PUT request with data', async () => {
      const data = { name: 'Updated Item' };
      const mockResponse = { data: { updated: true } };
      mockPut.mockResolvedValue(mockResponse);

      const result = await service.testPut('items/123', data);

      expect(mockPut).toHaveBeenCalledWith('/api/test/items/123', data, undefined);
      expect(result).toBe(mockResponse);
    });

    it('should handle nested paths', async () => {
      const data = { status: 'active' };
      mockPut.mockResolvedValue({ data: {} });

      await service.testPut('items/123/status', data);

      expect(mockPut).toHaveBeenCalledWith('/api/test/items/123/status', data, undefined);
    });
  });

  describe('DELETE requests', () => {
    it('should make DELETE request', async () => {
      const mockResponse = { data: { deleted: true } };
      mockDelete.mockResolvedValue(mockResponse);

      const result = await service.testDelete('items/123');

      expect(mockDelete).toHaveBeenCalledWith('/api/test/items/123', undefined);
      expect(result).toBe(mockResponse);
    });

    it('should pass abort signal', async () => {
      const signal = new AbortController().signal;
      mockDelete.mockResolvedValue({ data: {} });

      await service.testDelete('items/456', signal);

      expect(mockDelete).toHaveBeenCalledWith('/api/test/items/456', signal);
    });
  });

  describe('path resolution', () => {
    it('should resolve relative paths correctly', async () => {
      mockGet.mockResolvedValue({ data: {} });

      // Test various relative paths
      await service.testGet('items');
      expect(mockGet).toHaveBeenCalledWith('/api/test/items', undefined, undefined);

      await service.testGet('items/123');
      expect(mockGet).toHaveBeenCalledWith('/api/test/items/123', undefined, undefined);

      await service.testGet('deeply/nested/path');
      expect(mockGet).toHaveBeenCalledWith('/api/test/deeply/nested/path', undefined, undefined);
    });

    it('should not modify absolute paths', async () => {
      mockGet.mockResolvedValue({ data: {} });

      await service.testGet('/api/other/endpoint');
      expect(mockGet).toHaveBeenCalledWith('/api/other/endpoint', undefined, undefined);
    });

    it('should not modify full URLs', async () => {
      mockGet.mockResolvedValue({ data: {} });

      await service.testGet('http://example.com/api');
      expect(mockGet).toHaveBeenCalledWith('http://example.com/api', undefined, undefined);

      await service.testGet('https://secure.example.com/api');
      expect(mockGet).toHaveBeenCalledWith('https://secure.example.com/api', undefined, undefined);
    });
  });

  describe('error handling', () => {
    it('should propagate GET errors', async () => {
      const error = new Error('Network error');
      mockGet.mockRejectedValue(error);

      await expect(service.testGet('items')).rejects.toThrow('Network error');
    });

    it('should propagate POST errors', async () => {
      const error = new Error('Bad request');
      mockPost.mockRejectedValue(error);

      await expect(service.testPost('items', {})).rejects.toThrow('Bad request');
    });

    it('should propagate PUT errors', async () => {
      const error = new Error('Unauthorized');
      mockPut.mockRejectedValue(error);

      await expect(service.testPut('items/123', {})).rejects.toThrow('Unauthorized');
    });

    it('should propagate DELETE errors', async () => {
      const error = new Error('Not found');
      mockDelete.mockRejectedValue(error);

      await expect(service.testDelete('items/999')).rejects.toThrow('Not found');
    });
  });

  describe('different base paths', () => {
    it('should work with different base paths', async () => {
      const service1 = new TestService('/api/v1');
      const service2 = new TestService('/api/v2');
      
      // Clear mock calls from constructor
      mockGet.mockClear();
      mockGet.mockResolvedValue({ data: {} });

      await service1.testGet('users');
      expect(mockGet).toHaveBeenCalledWith('/api/v1/users', undefined, undefined);

      mockGet.mockClear();
      
      await service2.testGet('users');
      expect(mockGet).toHaveBeenCalledWith('/api/v2/users', undefined, undefined);
    });

    it('should handle base path without leading slash', async () => {
      const service = new TestService('api/custom');
      mockGet.mockResolvedValue({ data: {} });

      await service.testGet('endpoint');
      expect(mockGet).toHaveBeenCalledWith('api/custom/endpoint', undefined, undefined);
    });
  });
});