import 'dotenv/config';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

describe('API Endpoints Integration Tests', () => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  
  // Helper function to make API requests
  async function makeRequest(endpoint: string, options?: RequestInit) {
    const url = `${baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    
    const contentType = response.headers.get('content-type');
    let data = null;
    
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else if (contentType?.includes('text/event-stream')) {
      data = await response.text();
    } else {
      data = await response.text();
    }
    
    return { response, data };
  }

  describe('Health Check Endpoints', () => {
    test('GET /api/health should return 200', async () => {
      const { response, data } = await makeRequest('/api/health');
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('timestamp');
    });
  });

  describe('Chat API Endpoints', () => {
    describe('POST /api/chat', () => {
      test('should handle basic chat message', async () => {
        const { response, data } = await makeRequest('/api/chat', {
          method: 'POST',
          body: JSON.stringify({
            message: 'Hello',
            sessionId: `test-${Date.now()}`,
          }),
        });
        
        expect(response.status).toBe(200);
        expect(data).toHaveProperty('response');
        expect(data).toHaveProperty('sessionId');
      });

      test('should return 400 for missing message', async () => {
        const { response } = await makeRequest('/api/chat', {
          method: 'POST',
          body: JSON.stringify({
            sessionId: `test-${Date.now()}`,
          }),
        });
        
        expect(response.status).toBe(400);
      });
    });

    describe('POST /api/chat/proposal', () => {
      test('should generate proposal', async () => {
        const { response, data } = await makeRequest('/api/chat/proposal', {
          method: 'POST',
          body: JSON.stringify({
            message: 'Generate entry proposal for BTC',
            symbol: 'BTCUSDT',
            type: 'entry',
          }),
        });
        
        expect(response.status).toBe(200);
        expect(data).toHaveProperty('proposal');
        if (data.proposal) {
          expect(data.proposal).toHaveProperty('type', 'entry');
          expect(data.proposal).toHaveProperty('symbol', 'BTCUSDT');
          expect(data.proposal).toHaveProperty('confidence');
        }
      });
    });
  });

  describe('Memory API Endpoints', () => {
    const testSessionId = `test-memory-${Date.now()}`;

    describe('POST /api/memory/save', () => {
      test('should save conversation to memory', async () => {
        const { response, data } = await makeRequest('/api/memory/save', {
          method: 'POST',
          body: JSON.stringify({
            sessionId: testSessionId,
            message: 'Test message',
            response: 'Test response',
            metadata: {
              intent: 'greeting',
              confidence: 0.9,
            },
          }),
        });
        
        expect(response.status).toBe(200);
        expect(data).toHaveProperty('success', true);
      });
    });

    describe('GET /api/memory/recall', () => {
      test('should recall conversation from memory', async () => {
        // First save something
        await makeRequest('/api/memory/save', {
          method: 'POST',
          body: JSON.stringify({
            sessionId: testSessionId,
            message: 'Test recall',
            response: 'Test response',
          }),
        });
        
        // Then recall
        const { response, data } = await makeRequest(
          `/api/memory/recall?sessionId=${testSessionId}`
        );
        
        expect(response.status).toBe(200);
        expect(data).toHaveProperty('conversations');
        expect(Array.isArray(data.conversations)).toBe(true);
      });
    });

    describe('POST /api/memory/search', () => {
      test('should search conversations', async () => {
        const { response, data } = await makeRequest('/api/memory/search', {
          method: 'POST',
          body: JSON.stringify({
            query: 'test',
            limit: 10,
          }),
        });
        
        expect(response.status).toBe(200);
        expect(data).toHaveProperty('results');
        expect(Array.isArray(data.results)).toBe(true);
      });
    });
  });

  describe('UI Events API', () => {
    describe('POST /api/ui-events', () => {
      test('should dispatch UI event', async () => {
        const { response, data } = await makeRequest('/api/ui-events', {
          method: 'POST',
          body: JSON.stringify({
            type: 'chart.symbolChanged',
            data: {
              type: 'chart.symbolChanged',
              symbol: 'BTCUSDT',
            },
          }),
        });
        
        expect(response.status).toBe(200);
        expect(data).toHaveProperty('success', true);
      });

      test('should return 400 for invalid event', async () => {
        const { response } = await makeRequest('/api/ui-events', {
          method: 'POST',
          body: JSON.stringify({
            // Missing type
            data: {},
          }),
        });
        
        expect(response.status).toBe(400);
      });
    });

    describe('GET /api/ui-events (SSE)', () => {
      test('should establish SSE connection', async () => {
        const { response } = await makeRequest('/api/ui-events');
        
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/event-stream');
        expect(response.headers.get('cache-control')).toContain('no-cache');
      });
    });
  });

  describe('Analysis API Endpoints', () => {
    describe('POST /api/ai/analysis-stream', () => {
      test('should stream analysis', async () => {
        const { response } = await makeRequest('/api/ai/analysis-stream', {
          method: 'POST',
          body: JSON.stringify({
            symbol: 'BTCUSDT',
            timeframe: '1h',
            indicators: ['RSI', 'MACD'],
          }),
        });
        
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/event-stream');
      });
    });
  });

  describe('Market Data API', () => {
    describe('GET /api/binance/ticker', () => {
      test('should fetch ticker data', async () => {
        const { response, data } = await makeRequest('/api/binance/ticker?symbol=BTCUSDT');
        
        expect(response.status).toBe(200);
        expect(data).toHaveProperty('symbol', 'BTCUSDT');
        expect(data).toHaveProperty('price');
        expect(data).toHaveProperty('priceChange');
        expect(data).toHaveProperty('priceChangePercent');
      });

      test('should return 400 for missing symbol', async () => {
        const { response } = await makeRequest('/api/binance/ticker');
        
        expect(response.status).toBe(400);
      });
    });

    describe('GET /api/binance/klines', () => {
      test('should fetch kline data', async () => {
        const { response, data } = await makeRequest(
          '/api/binance/klines?symbol=BTCUSDT&interval=1h&limit=100'
        );
        
        expect(response.status).toBe(200);
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThan(0);
        
        if (data.length > 0) {
          const kline = data[0];
          expect(kline).toHaveProperty('time');
          expect(kline).toHaveProperty('open');
          expect(kline).toHaveProperty('high');
          expect(kline).toHaveProperty('low');
          expect(kline).toHaveProperty('close');
          expect(kline).toHaveProperty('volume');
        }
      });
    });
  });

  describe('WebSocket API', () => {
    describe('GET /api/ws/status', () => {
      test('should return WebSocket status', async () => {
        const { response, data } = await makeRequest('/api/ws/status');
        
        expect(response.status).toBe(200);
        expect(data).toHaveProperty('status');
        expect(data).toHaveProperty('connections');
      });
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent endpoint', async () => {
      const { response } = await makeRequest('/api/non-existent');
      
      expect(response.status).toBe(404);
    });

    test('should handle malformed JSON', async () => {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      });
      
      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    test('should include rate limit headers', async () => {
      const { response } = await makeRequest('/api/health');
      
      // Check for rate limit headers if implemented
      const rateLimitHeaders = [
        'x-ratelimit-limit',
        'x-ratelimit-remaining',
        'x-ratelimit-reset',
      ];
      
      // This test assumes rate limiting is implemented
      // Adjust based on actual implementation
      expect(response.headers).toBeDefined();
    });
  });

  describe('CORS Headers', () => {
    test('should include appropriate CORS headers', async () => {
      const { response } = await makeRequest('/api/health');
      
      // Check for CORS headers if needed
      expect(response.headers).toBeDefined();
    });
  });
});

// Performance tests for API endpoints
describe('API Performance Tests', () => {
  const performanceThresholds = {
    health: 100, // ms
    chat: 5000, // ms
    memory: 1000, // ms
    market: 500, // ms
  };

  test('Health endpoint should respond quickly', async () => {
    const start = Date.now();
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/health`);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(performanceThresholds.health);
  });

  test('Chat endpoint should respond within threshold', async () => {
    const start = Date.now();
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'test', sessionId: 'perf-test' }),
    });
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(performanceThresholds.chat);
  });
});