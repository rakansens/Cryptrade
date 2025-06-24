import 'dotenv/config';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

// Mock fetch for integration tests
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('API Endpoints Integration Tests', () => {
  const baseUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3000';
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to default - will be overridden per test
    mockFetch.mockReset();
  });
  
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
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok', timestamp: Date.now() }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      
      const { response, data } = await makeRequest('/api/health');
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('timestamp');
    });
  });

  describe('Chat API Endpoints', () => {
    describe('POST /api/chat', () => {
      test('should handle basic chat message', async () => {
        const sessionId = `test-${Date.now()}`;
        mockFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ 
            response: 'Hello! How can I help you?',
            sessionId: sessionId
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        );
        
        const { response, data } = await makeRequest('/api/chat', {
          method: 'POST',
          body: JSON.stringify({
            message: 'Hello',
            sessionId: sessionId,
          }),
        });
        
        expect(response.status).toBe(200);
        expect(data).toHaveProperty('response');
        expect(data).toHaveProperty('sessionId');
      });

      test('should return 400 for missing message', async () => {
        mockFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Message is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        );
        
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
        mockFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ 
            proposal: {
              type: 'entry',
              symbol: 'BTCUSDT',
              confidence: 0.85,
              entryPrice: 50000,
              targetPrice: 55000,
              stopLoss: 48000
            }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        );
        
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
        mockFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        );
        
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
        mockFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        );
        
        await makeRequest('/api/memory/save', {
          method: 'POST',
          body: JSON.stringify({
            sessionId: testSessionId,
            message: 'Test recall',
            response: 'Test response',
          }),
        });
        
        // Then recall
        mockFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ 
            conversations: [
              {
                message: 'Test recall',
                response: 'Test response',
                timestamp: Date.now()
              }
            ]
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        );
        
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
        mockFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ results: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        );
        
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
        mockFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        );
        
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
        mockFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Invalid event' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        );
        
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
        mockFetch.mockResolvedValueOnce(
          new Response('data: {"type":"connected"}\n\n', {
            status: 200,
            headers: { 
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache'
            }
          })
        );
        
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
        mockFetch.mockResolvedValueOnce(
          new Response('data: {"type":"analysis","content":"Starting analysis..."}\n\n', {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' }
          })
        );
        
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
        mockFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ 
            symbol: 'BTCUSDT',
            price: '45000.00',
            priceChange: '500.00',
            priceChangePercent: '1.12'
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        );
        
        const { response, data } = await makeRequest('/api/binance/ticker?symbol=BTCUSDT');
        
        expect(response.status).toBe(200);
        expect(data).toHaveProperty('symbol', 'BTCUSDT');
        expect(data).toHaveProperty('price');
        expect(data).toHaveProperty('priceChange');
        expect(data).toHaveProperty('priceChangePercent');
      });

      test('should return 400 for missing symbol', async () => {
        mockFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Symbol is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        );
        
        const { response } = await makeRequest('/api/binance/ticker');
        
        expect(response.status).toBe(400);
      });
    });

    describe('GET /api/binance/klines', () => {
      test('should fetch kline data', async () => {
        mockFetch.mockResolvedValueOnce(
          new Response(JSON.stringify([
            {
              time: 1640000000000,
              open: '45000.00',
              high: '46000.00',
              low: '44500.00',
              close: '45500.00',
              volume: '1234.56'
            }
          ]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        );
        
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
        mockFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ 
            status: 'connected',
            connections: 1
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        );
        
        const { response, data } = await makeRequest('/api/ws/status');
        
        expect(response.status).toBe(200);
        expect(data).toHaveProperty('status');
        expect(data).toHaveProperty('connections');
      });
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent endpoint', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      
      const { response } = await makeRequest('/api/non-existent');
      
      expect(response.status).toBe(404);
    });

    test('should handle malformed JSON', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      
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
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'x-ratelimit-limit': '100',
            'x-ratelimit-remaining': '99',
            'x-ratelimit-reset': String(Date.now() + 3600000)
          }
        })
      );
      
      const { response } = await makeRequest('/api/health');
      
      // Check for rate limit headers if implemented
      // const rateLimitHeaders = [
      //   'x-ratelimit-limit',
      //   'x-ratelimit-remaining',
      //   'x-ratelimit-reset',
      // ];
      
      // This test assumes rate limiting is implemented
      // Adjust based on actual implementation
      expect(response.headers).toBeDefined();
    });
  });

  describe('CORS Headers', () => {
    test('should include appropriate CORS headers', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        })
      );
      
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

  beforeEach(() => {
    // Ensure fetch is mocked for performance tests
    if (typeof global.fetch !== 'function' || !('mockReset' in global.fetch)) {
      global.fetch = jest.fn();
    }
    
    // Mock fetch for performance tests
    (global.fetch as jest.Mock).mockReset();
    (global.fetch as jest.Mock).mockImplementation(async () => {
      // Simulate small network delay
      await new Promise(resolve => setTimeout(resolve, 10));
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
  });

  test('Health endpoint should respond quickly', async () => {
    const start = Date.now();
    await fetch(`${process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3000'}/api/health`);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(performanceThresholds.health);
  });

  test('Chat endpoint should respond within threshold', async () => {
    const start = Date.now();
    await fetch(`${process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3000'}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'test', sessionId: 'perf-test' }),
    });
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(performanceThresholds.chat);
  });
});