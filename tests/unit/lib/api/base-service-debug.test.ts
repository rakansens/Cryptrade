// tests/unit/lib/api/base-service-debug.test.ts
// BaseServiceのモック問題をデバッグするための最小限のテスト

// グローバルモックを先に定義
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();

// jest.mockをファイルのトップレベルで実行
jest.mock('@/lib/api/client', () => {
  return {
    ApiClient: jest.fn().mockImplementation(() => ({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
    })),
  };
});

describe('BaseService Mock Debug', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should test basic mock functionality', () => {
    // 基本的なモック機能をテスト
    mockGet.mockResolvedValue({ data: 'test' });
    
    expect(mockGet).not.toHaveBeenCalled();
    mockGet();
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('should test ApiClient instantiation', () => {
    const { ApiClient } = require('@/lib/api/client');
    
    expect(ApiClient).toBeDefined();
    expect(typeof ApiClient).toBe('function');
    
    const client = new ApiClient();
    expect(client).toBeDefined();
    expect(client.get).toBe(mockGet);
    expect(client.post).toBe(mockPost);
  });

  it('should test BaseService with mocked ApiClient', async () => {
    // BaseServiceをインポート
    const { BaseService } = require('@/lib/api/base-service');
    const { ApiClient } = require('@/lib/api/client');
    
    // モックのセットアップ（beforeEachでクリアされる前に記録）
    mockGet.mockResolvedValue({ data: { success: true } });
    
    // ApiClientの呼び出し回数をクリア（beforeEachの後から測定）
    (ApiClient as jest.Mock).mockClear();
    
    // テスト用のサービスクラス
    class TestService extends BaseService {
      constructor() {
        super('/api/test');
      }
      
      async testGet(url) {
        // BaseServiceのprotectedメソッドを呼び出すため、
        // client.getを直接呼び出す
        return this.client.get(url);
      }
    }
    
    // サービスインスタンスを作成
    const service = new TestService();
    
    // ApiClientが呼ばれたことを確認
    expect(ApiClient).toHaveBeenCalledTimes(1);
    expect(ApiClient).toHaveBeenCalledWith({
      baseUrl: '/api/test',
      timeout: expect.any(Number),
      retries: 3,
      retryDelay: 1000,
      rateLimit: expect.any(Object),
    });
    
    // テストメソッドを呼び出す
    const result = await service.testGet('/items');
    
    // モックが呼ばれたことを確認
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/api/test/items');
    expect(result).toEqual({ data: { success: true } });
  });
});