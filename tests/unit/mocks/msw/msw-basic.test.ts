import { server, http, HttpResponse } from '../../../setup/msw-setup';

describe('MSW Basic Tests', () => {
  beforeEach(() => {
    // Reset all handlers before each test to ensure clean state
    server.resetHandlers();
  });

  it('should mock local API endpoint', async () => {
    console.log('[MSW Test] Starting local API endpoint test');
    
    // Add temporary handler for this test
    server.use(
      http.get('/api/test', () => {
        console.log('[MSW Test] Handler for /api/test called');
        return HttpResponse.json({ message: 'Hello from MSW' });
      })
    );
    
    console.log('[MSW Test] Handler added, making request to /api/test');
    const response = await fetch('/api/test');
    console.log('[MSW Test] Response status:', response.status, 'ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('[MSW Test] Error response:', errorText);
    }
    
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    console.log('[MSW Test] Response data:', data);
    expect(data).toEqual({ message: 'Hello from MSW' });
  });

  it('should mock Binance API', async () => {
    console.log('[MSW Test] Starting Binance API test');
    const url = 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h';
    console.log('[MSW Test] Making request to:', url);
    
    const response = await fetch(url);
    console.log('[MSW Test] Binance response status:', response.status, 'ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('[MSW Test] Binance error response:', errorText);
    }
    
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    console.log('[MSW Test] Binance response data type:', typeof data, 'isArray:', Array.isArray(data));
    console.log('[MSW Test] Binance response data:', data);
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
  });

  it('should handle custom handlers added at runtime', async () => {
    console.log('[MSW Test] Starting dynamic handler test');
    
    server.use(
      http.get('/api/dynamic', () => {
        console.log('[MSW Test] Dynamic handler for /api/dynamic called');
        return HttpResponse.json({ dynamic: true });
      })
    );

    console.log('[MSW Test] Dynamic handler added, making request to /api/dynamic');
    const response = await fetch('/api/dynamic');
    console.log('[MSW Test] Dynamic response status:', response.status, 'ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('[MSW Test] Dynamic error response:', errorText);
    }
    
    const data = await response.json();
    console.log('[MSW Test] Dynamic response data:', data);
    expect(data).toEqual({ dynamic: true });
  });
});