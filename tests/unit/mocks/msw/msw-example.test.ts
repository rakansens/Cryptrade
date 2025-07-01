import { server, http, HttpResponse } from '../../../setup/msw-setup';

describe('MSW Mock Service Worker Tests', () => {
  beforeEach(() => {
    // Reset all handlers before each test to ensure clean state
    server.resetHandlers();
  });

  describe('Binance API Mocks', () => {
    it('should mock Binance klines API correctly', async () => {
      const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h');
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1);
      
      // Verify kline data structure: [openTime, open, high, low, close, volume, closeTime, quoteVolume, count, takerBuyVolume, takerBuyQuoteVolume, ignore]
      const kline = data[0];
      expect(kline).toHaveLength(12);
      expect(typeof kline[0]).toBe('number'); // openTime
      expect(typeof kline[1]).toBe('string'); // open price
      expect(typeof kline[2]).toBe('string'); // high price
      expect(typeof kline[3]).toBe('string'); // low price
      expect(typeof kline[4]).toBe('string'); // close price
      expect(typeof kline[5]).toBe('string'); // volume
    });

    it('should mock Binance 24hr ticker API correctly', async () => {
      const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('symbol', 'BTCUSDT');
      expect(data).toHaveProperty('lastPrice');
      expect(data).toHaveProperty('priceChange');
      expect(data).toHaveProperty('priceChangePercent');
      expect(data).toHaveProperty('volume');
      expect(data).toHaveProperty('openTime');
      expect(data).toHaveProperty('closeTime');
    });

    it('should handle Binance API errors gracefully', async () => {
      // Add a custom error handler for this test
      server.use(
        http.get('https://api.binance.com/api/v3/klines', () => {
          return HttpResponse.json(
            { code: -1121, msg: 'Invalid symbol.' },
            { status: 400 }
          );
        })
      );

      const response = await fetch('https://api.binance.com/api/v3/klines?symbol=INVALID');
      expect(response.status).toBe(400);
      
      const errorData = await response.json();
      expect(errorData).toHaveProperty('code', -1121);
      expect(errorData).toHaveProperty('msg', 'Invalid symbol.');
    });
  });

  describe('Supabase API Mocks', () => {
    it('should mock Supabase auth endpoints', async () => {
      // Add Supabase auth handler
      server.use(
        http.post('http://localhost:54321/auth/v1/token', () => {
          return HttpResponse.json({
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expires_in: 3600,
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
              confirmed_at: new Date().toISOString()
            }
          });
        })
      );

      const response = await fetch('http://localhost:54321/auth/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password'
        })
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('access_token');
      expect(data).toHaveProperty('user');
      expect(data.user).toHaveProperty('email', 'test@example.com');
    });

    it('should mock Supabase database operations', async () => {
      // Add Supabase REST API handler
      server.use(
        http.get('http://localhost:54321/rest/v1/sessions', ({ request }) => {
          const url = new URL(request.url);
          const select = url.searchParams.get('select');
          
          return HttpResponse.json([
            {
              id: 'test-session-1',
              title: 'Test Session',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ]);
        })
      );

      const response = await fetch('http://localhost:54321/rest/v1/sessions?select=*', {
        headers: {
          'Authorization': 'Bearer mock-token',
          'apikey': 'test-anon-key'
        }
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('title');
    });
  });

  describe('OpenAI API Mocks', () => {
    it('should mock OpenAI chat completions', async () => {
      server.use(
        http.post('https://api.openai.com/v1/chat/completions', () => {
          return HttpResponse.json({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: 'gpt-4',
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: 'This is a mock response from OpenAI API.'
              },
              finish_reason: 'stop'
            }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30
            }
          });
        })
      );

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-test-key-12345'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }]
        })
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('choices');
      expect(data.choices[0].message).toHaveProperty('content');
      expect(data).toHaveProperty('usage');
    });

    it('should mock OpenAI streaming responses', async () => {
      server.use(
        http.post('https://api.openai.com/v1/chat/completions', () => {
          // Mock Server-Sent Events response
          const mockStream = 'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\ndata: [DONE]\n\n';
          
          return new Response(mockStream, {
            status: 200,
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive'
            }
          });
        })
      );

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-test-key-12345'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
          stream: true
        })
      });

      expect(response.ok).toBe(true);
      expect(response.headers.get('content-type')).toBe('text/event-stream');
      
      const text = await response.text();
      expect(text).toContain('data:');
      expect(text).toContain('[DONE]');
    });
  });

  describe('Local API Mocks', () => {
    it('should mock health check endpoints', async () => {
      const healthResponse = await fetch('/api/health');
      expect(healthResponse.ok).toBe(true);
      
      const healthData = await healthResponse.json();
      expect(healthData).toHaveProperty('status', 'ok');
      expect(healthData).toHaveProperty('timestamp');

      const dbHealthResponse = await fetch('/api/health/db');
      expect(dbHealthResponse.ok).toBe(true);
      
      const dbHealthData = await dbHealthResponse.json();
      expect(dbHealthData).toHaveProperty('status', 'ok');
      expect(dbHealthData).toHaveProperty('database', 'connected');
    });

    it('should mock chat session endpoints', async () => {
      // Test GET sessions
      const getResponse = await fetch('/api/chat/sessions');
      expect(getResponse.ok).toBe(true);
      
      const sessions = await getResponse.json();
      expect(Array.isArray(sessions)).toBe(true);

      // Test POST session creation
      const postResponse = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Session' })
      });
      expect(postResponse.ok).toBe(true);
      
      const newSession = await postResponse.json();
      expect(newSession).toHaveProperty('id');
      expect(newSession).toHaveProperty('title');
      expect(newSession).toHaveProperty('createdAt');
    });

    it('should mock analysis endpoints', async () => {
      const response = await fetch('/api/analysis/sessions');
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should mock alerts endpoint', async () => {
      const response = await fetch('/api/alerts');
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should mock metrics endpoint', async () => {
      const response = await fetch('/api/metrics');
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('uptime');
      expect(data).toHaveProperty('memory');
      expect(data).toHaveProperty('cpu');
      expect(typeof data.uptime).toBe('number');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network errors', async () => {
      server.use(
        http.get('https://api.example.com/error', () => {
          return HttpResponse.error();
        })
      );

      try {
        await fetch('https://api.example.com/error');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle timeout scenarios', async () => {
      server.use(
        http.get('https://api.example.com/slow', async () => {
          // Simulate slow response
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({ message: 'Slow response' });
        })
      );

      const response = await fetch('https://api.example.com/slow');
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('message', 'Slow response');
    });

    it('should handle different content types', async () => {
      server.use(
        http.get('https://api.example.com/xml', () => {
          return new Response('<xml><message>Hello</message></xml>', {
            headers: { 'Content-Type': 'application/xml' }
          });
        }),
        http.get('https://api.example.com/text', () => {
          return new Response('Plain text response', {
            headers: { 'Content-Type': 'text/plain' }
          });
        })
      );

      const xmlResponse = await fetch('https://api.example.com/xml');
      expect(xmlResponse.headers.get('content-type')).toBe('application/xml');
      expect(await xmlResponse.text()).toContain('<xml>');

      const textResponse = await fetch('https://api.example.com/text');
      expect(textResponse.headers.get('content-type')).toBe('text/plain');
      expect(await textResponse.text()).toBe('Plain text response');
    });
  });

  describe('Dynamic Handler Management', () => {
    it('should allow adding runtime handlers', async () => {
      const dynamicHandler = http.get('https://api.example.com/dynamic', () => {
        return HttpResponse.json({ dynamic: true });
      });

      server.use(dynamicHandler);
      
      // Verify the handler was added by making a request
      const response = await fetch('https://api.example.com/dynamic');
      const data = await response.json();
      expect(data).toHaveProperty('dynamic', true);
    });

    it('should handle handler reset properly', async () => {
      // Add a temporary handler
      server.use(
        http.get('https://api.example.com/temp', () => {
          return HttpResponse.json({ temp: true });
        })
      );

      // Make request with temporary handler
      const tempResponse = await fetch('https://api.example.com/temp');
      expect(tempResponse.ok).toBe(true);

      // Reset handlers (this happens in beforeEach)
      server.resetHandlers();

      // The temporary handler should be gone, fallback handler should catch it
      const fallbackResponse = await fetch('https://api.example.com/temp');
      expect(fallbackResponse.status).toBe(404);
    });
  });

  describe('Request Validation', () => {
    it('should validate request headers', async () => {
      server.use(
        http.post('https://api.example.com/auth-required', ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return HttpResponse.json(
              { error: 'Unauthorized' },
              { status: 401 }
            );
          }
          
          return HttpResponse.json({ success: true });
        })
      );

      // Test without auth header
      const unauthorizedResponse = await fetch('https://api.example.com/auth-required', {
        method: 'POST'
      });
      expect(unauthorizedResponse.status).toBe(401);

      // Test with auth header
      const authorizedResponse = await fetch('https://api.example.com/auth-required', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer valid-token' }
      });
      expect(authorizedResponse.ok).toBe(true);
    });

    it('should validate request body', async () => {
      server.use(
        http.post('https://api.example.com/validate-body', async ({ request }) => {
          try {
            const body = await request.json();
            
            if (!body.required_field) {
              return HttpResponse.json(
                { error: 'Missing required_field' },
                { status: 400 }
              );
            }
            
            return HttpResponse.json({ valid: true });
          } catch {
            return HttpResponse.json(
              { error: 'Invalid JSON' },
              { status: 400 }
            );
          }
        })
      );

      // Test with invalid JSON
      const invalidResponse = await fetch('https://api.example.com/validate-body', {
        method: 'POST',
        body: 'invalid json'
      });
      expect(invalidResponse.status).toBe(400);

      // Test with missing field
      const missingFieldResponse = await fetch('https://api.example.com/validate-body', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ other_field: 'value' })
      });
      expect(missingFieldResponse.status).toBe(400);

      // Test with valid body
      const validResponse = await fetch('https://api.example.com/validate-body', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ required_field: 'value' })
      });
      expect(validResponse.ok).toBe(true);
    });
  });

  describe('Unhandled Requests', () => {
    it('should handle unhandled requests with fallback', async () => {
      const response = await fetch('https://unhandled.example.com/unknown');
      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data).toHaveProperty('error', 'Not Found');
      expect(data.message).toContain('No handler for GET');
    });

    it('should log unhandled requests for debugging', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await fetch('https://debug.example.com/unhandled');
      
      // Check if console.warn was called with unhandled request message
      const warnCalls = consoleSpy.mock.calls;
      const hasUnhandledMessage = warnCalls.some(call =>
        call.some(arg =>
          typeof arg === 'string' &&
          arg.includes('Unhandled') &&
          arg.includes('https://debug.example.com/unhandled')
        )
      );
      
      expect(hasUnhandledMessage).toBe(true);
      
      consoleSpy.mockRestore();
    });
  });
});