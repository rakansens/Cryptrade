import { server, http, HttpResponse } from '../../../setup/msw-setup';

describe('MSW Basic Tests', () => {
  beforeEach(() => {
    // Reset all handlers before each test to ensure clean state
    server.resetHandlers();
  });

  it('should mock local API endpoint', async () => {
    // Add temporary handler for this test
    server.use(
      http.get('/api/test', () => {
        return HttpResponse.json({ message: 'Hello from MSW' });
      })
    );
    
    const response = await fetch('/api/test');
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(data).toEqual({ message: 'Hello from MSW' });
  });

  it('should mock Binance API', async () => {
    const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h');
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
  });

  it('should handle custom handlers added at runtime', async () => {
    server.use(
      http.get('/api/dynamic', () => {
        return HttpResponse.json({ dynamic: true });
      })
    );

    const response = await fetch('/api/dynamic');
    const data = await response.json();
    expect(data).toEqual({ dynamic: true });
  });
});