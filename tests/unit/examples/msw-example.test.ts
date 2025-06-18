/**
 * MSW Example Test
 * 
 * Demonstrates how to use Mock Service Worker for API testing
 */

import { http, HttpResponse } from 'msw';
import { mswServer } from '../../setup/msw-setup';
import { 
  createBinanceWebSocketMock, 
  generateMockStreamData,
  mockSupabaseAuth,
  createMockSSEStream 
} from '../../mocks/msw/handlers';

describe('MSW Example Tests', () => {
  describe('Binance API Mocking', () => {
    it('should fetch market ticker data', async () => {
      const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data).toHaveProperty('symbol', 'BTCUSDT');
      expect(data).toHaveProperty('lastPrice');
      expect(data).toHaveProperty('volume');
    });

    it('should handle invalid symbol error', async () => {
      const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=INVALID');
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('code', -1121);
      expect(data).toHaveProperty('msg', 'Invalid symbol.');
    });

    it('should fetch kline data', async () => {
      const response = await fetch(
        'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=10'
      );
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveLength(12); // Kline data has 12 fields
    });

    it('should mock WebSocket connection', () => {
      const ws = createBinanceWebSocketMock();
      const messages: any[] = [];

      ws.addEventListener('message', (event: any) => {
        messages.push(JSON.parse(event.data));
      });

      // Simulate connection open
      ws.simulateOpen();

      // Simulate trade stream data
      ws.simulateMessage(generateMockStreamData.trade('btcusdt'));
      ws.simulateMessage(generateMockStreamData.kline('btcusdt', '1m'));

      expect(messages).toHaveLength(2);
      expect(messages[0]).toHaveProperty('e', 'trade');
      expect(messages[1]).toHaveProperty('e', 'kline');
    });
  });

  describe('Supabase API Mocking', () => {
    it('should authenticate user', async () => {
      const response = await fetch('http://localhost:54321/auth/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'password',
          email: 'test@example.com',
          password: 'password123'
        })
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data).toHaveProperty('access_token');
      expect(data).toHaveProperty('user');
      expect(data.user).toHaveProperty('email', 'test@example.com');
    });

    it('should handle invalid credentials', async () => {
      const response = await fetch('http://localhost:54321/auth/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'password',
          email: 'wrong@example.com',
          password: 'wrongpassword'
        })
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should fetch proposals', async () => {
      const response = await fetch('http://localhost:54321/rest/v1/proposals?user_id=123');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('symbol');
      expect(data[0]).toHaveProperty('action');
      expect(data[0]).toHaveProperty('confidence');
    });

    it('should use mock auth helper', async () => {
      const result = await mockSupabaseAuth.signIn('test@example.com', 'password123');
      
      expect(result.error).toBeNull();
      expect(result.data).toHaveProperty('access_token');
      expect(result.data).toHaveProperty('user');
    });
  });

  describe('OpenAI API Mocking', () => {
    it('should generate chat completion', async () => {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'user', content: 'Analyze Bitcoin market trends' }
          ]
        })
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data).toHaveProperty('choices');
      expect(data.choices[0]).toHaveProperty('message');
      expect(data.choices[0].message.content).toContain('Bitcoin');
    });

    it('should handle streaming responses', async () => {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'user', content: 'What is the market trend?' }
          ],
          stream: true
        })
      });

      expect(response.ok).toBe(true);
      expect(response.headers.get('content-type')).toBe('text/event-stream');

      // Read stream
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let chunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }

      const fullResponse = chunks.join('');
      expect(fullResponse).toContain('data: ');
      expect(fullResponse).toContain('[DONE]');
    });

    it('should handle function calling', async () => {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'user', content: 'Analyze BTCUSDT on 1h timeframe' }
          ],
          functions: [{
            name: 'analyze_market',
            description: 'Analyze market conditions',
            parameters: {}
          }]
        })
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.choices[0]).toHaveProperty('message');
      expect(data.choices[0].message).toHaveProperty('function_call');
      expect(data.choices[0].message.function_call).toHaveProperty('name', 'analyze_market');
    });

    it('should handle API errors', async () => {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-key'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test' }]
        })
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toHaveProperty('error');
      expect(data.error).toHaveProperty('code', 'invalid_api_key');
    });
  });

  describe('Custom Handler Override', () => {
    it('should allow custom handler for specific test', async () => {
      // Override default handler for this test
      mswServer.use(
        http.get('https://api.binance.com/api/v3/ticker/24hr', () => {
          return HttpResponse.json({
            symbol: 'CUSTOM_TEST',
            lastPrice: '99999.99'
          });
        })
      );

      const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
      const data = await response.json();

      expect(data).toHaveProperty('symbol', 'CUSTOM_TEST');
      expect(data).toHaveProperty('lastPrice', '99999.99');
    });
  });

  describe('Error Scenarios', () => {
    it('should simulate network error', async () => {
      mswServer.use(
        http.get('https://api.binance.com/api/v3/time', () => {
          return HttpResponse.error();
        })
      );

      await expect(
        fetch('https://api.binance.com/api/v3/time')
      ).rejects.toThrow();
    });

    it('should simulate timeout', async () => {
      mswServer.use(
        http.get('https://api.binance.com/api/v3/time', async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({ serverTime: Date.now() });
        })
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 50);

      try {
        await fetch('https://api.binance.com/api/v3/time', {
          signal: controller.signal
        });
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.name).toBe('AbortError');
      } finally {
        clearTimeout(timeoutId);
      }
    });
  });
});

// Example of testing a service that uses these APIs
class TradingService {
  async getMarketData(symbol: string) {
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    if (!response.ok) {
      throw new Error('Failed to fetch market data');
    }
    return response.json();
  }

  async createProposal(proposal: any, token: string) {
    const response = await fetch('http://localhost:54321/rest/v1/proposals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(proposal)
    });
    if (!response.ok) {
      throw new Error('Failed to create proposal');
    }
    return response.json();
  }

  async analyzeWithAI(prompt: string, apiKey: string) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!response.ok) {
      throw new Error('Failed to analyze with AI');
    }
    const data = await response.json();
    return data.choices[0].message.content;
  }
}

describe('TradingService with MSW', () => {
  const service = new TradingService();

  it('should fetch market data successfully', async () => {
    const data = await service.getMarketData('BTCUSDT');
    
    expect(data).toHaveProperty('symbol', 'BTCUSDT');
    expect(data).toHaveProperty('lastPrice');
    expect(data).toHaveProperty('volume');
  });

  it('should create proposal successfully', async () => {
    const proposal = {
      symbol: 'BTCUSDT',
      action: 'BUY',
      price: 48000,
      quantity: 0.1,
      reasoning: 'Test proposal',
      confidence: 0.8
    };

    const result = await service.createProposal(proposal, 'mock-access-token');
    
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('symbol', 'BTCUSDT');
    expect(result).toHaveProperty('status');
  });

  it('should analyze with AI successfully', async () => {
    const analysis = await service.analyzeWithAI(
      'What is the trend for Bitcoin?',
      'test-api-key'
    );
    
    expect(typeof analysis).toBe('string');
    expect(analysis).toContain('Bitcoin');
    expect(analysis.length).toBeGreaterThan(0);
  });
});