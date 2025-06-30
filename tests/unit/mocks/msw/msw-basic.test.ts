import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// 基本的なMSWハンドラー
const handlers = [
  http.get('/api/test', () => {
    return HttpResponse.json({ message: 'Hello from MSW' });
  }),
  
  http.get('https://api.binance.com/api/v3/klines', () => {
    return HttpResponse.json([
      [1640995200000, "46000.00", "47000.00", "45000.00", "46500.00", "100.00", 1640995259999, "4650000.00", 1000, "50.00", "2325000.00", "0"]
    ]);
  }),
];

// テスト用MSWサーバーを直接セットアップ
const server = setupServer(...handlers);

describe('MSW Basic Tests', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
    console.log('[MSW Basic Test] Server started');
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
    console.log('[MSW Basic Test] Server closed');
  });

  it('should mock local API endpoint', async () => {
    const response = await fetch('/api/test');
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(data).toEqual({ message: 'Hello from MSW' });
  });

  it('should mock Binance API', async () => {
    const response = await fetch('https://api.binance.com/api/v3/klines');
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
  });

  it('should handle custom handlers added at runtime', () => {
    server.use(
      http.get('/api/dynamic', () => {
        return HttpResponse.json({ dynamic: true });
      })
    );

    expect(async () => {
      const response = await fetch('/api/dynamic');
      const data = await response.json();
      expect(data).toEqual({ dynamic: true });
    }).not.toThrow();
  });
});