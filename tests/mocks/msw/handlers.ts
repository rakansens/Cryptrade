import { http, HttpResponse, ws } from 'msw';

// Helper function to create handlers for both relative and absolute URLs
function createDualHandlers(method: 'get' | 'post' | 'put' | 'delete', path: string, handler: any) {
  const relativePath = path;
  const absolutePath = `http://localhost:3000${path}`;
  
  if (method === 'get') {
    return [http.get(relativePath, handler), http.get(absolutePath, handler)];
  } else if (method === 'post') {
    return [http.post(relativePath, handler), http.post(absolutePath, handler)];
  } else if (method === 'put') {
    return [http.put(relativePath, handler), http.put(absolutePath, handler)];
  } else if (method === 'delete') {
    return [http.delete(relativePath, handler), http.delete(absolutePath, handler)];
  }
  return [];
}

// MSW handlers for API mocking in tests
export const handlers = [
  // Binance WebSocket handlers - comprehensive URL pattern coverage
  ws.link('wss://stream.binance.com:9443/ws/*', {
    onConnection(connection) {
      console.log('[MSW WebSocket] Binance connection opened (port 9443)');
      // Send mock trade data periodically
      const interval = setInterval(() => {
        if (connection.readyState === WebSocket.OPEN) {
          connection.send(JSON.stringify({
            e: 'trade',
            E: Date.now(),
            s: 'BTCUSDT',
            t: Date.now(),
            p: '45000.00',
            q: '0.001',
            b: Date.now() - 1,
            a: Date.now() - 2,
            T: Date.now(),
            m: false,
            M: true
          }));
        }
      }, 100);
      
      connection.addEventListener('close', () => {
        clearInterval(interval);
        console.log('[MSW WebSocket] Binance connection closed (port 9443)');
      });
    }
  }),
  
  ws.link('wss://stream.binance.com/ws/*', {
    onConnection(connection) {
      console.log('[MSW WebSocket] Binance connection opened (standard port)');
      // Send mock trade data
      const interval = setInterval(() => {
        if (connection.readyState === WebSocket.OPEN) {
          connection.send(JSON.stringify({
            e: 'trade',
            E: Date.now(),
            s: 'BTCUSDT',
            t: Date.now(),
            p: '45000.00',
            q: '0.001'
          }));
        }
      }, 100);
      
      connection.addEventListener('close', () => {
        clearInterval(interval);
        console.log('[MSW WebSocket] Binance connection closed (standard port)');
      });
    }
  }),

  // Additional specific Binance WebSocket patterns for trade endpoints
  // Note: Removing problematic patterns that cause TypeScript errors
  // The existing wildcard patterns should handle these cases
  
  // Binance API handlers
  http.get('https://api.binance.com/api/v3/klines', ({ request }) => {
    const url = new URL(request.url);
    const symbol = url.searchParams.get('symbol') || 'BTCUSDT';
    const interval = url.searchParams.get('interval') || '1h';
    const limit = parseInt(url.searchParams.get('limit') || '1');
    
    // Generate mock klines data
    const klines = Array.from({ length: Math.min(limit, 1000) }, (_, i) => {
      const baseTime = 1640995200000 + (i * 3600000); // 1 hour intervals
      const basePrice = 46000 + (Math.random() - 0.5) * 2000;
      return [
        baseTime,
        basePrice.toFixed(2),
        (basePrice + Math.random() * 1000).toFixed(2),
        (basePrice - Math.random() * 1000).toFixed(2),
        (basePrice + (Math.random() - 0.5) * 500).toFixed(2),
        (Math.random() * 1000).toFixed(2),
        baseTime + 3599999,
        (Math.random() * 46250000).toFixed(2),
        Math.floor(Math.random() * 10000),
        (Math.random() * 500).toFixed(2),
        (Math.random() * 23125000).toFixed(2),
        "0"
      ];
    });
    
    return HttpResponse.json(klines);
  }),

  http.get('https://api.binance.com/api/v3/ticker/24hr', ({ request }) => {
    const url = new URL(request.url);
    const symbol = url.searchParams.get('symbol') || 'BTCUSDT';
    
    // Handle invalid symbol
    if (symbol === 'INVALID') {
      return HttpResponse.json(
        { code: -1121, msg: 'Invalid symbol.' },
        { status: 400 }
      );
    }
    
    return HttpResponse.json({
      symbol: symbol,
      priceChange: "500.00",
      priceChangePercent: "1.08",
      weightedAvgPrice: "46250.00",
      prevClosePrice: "46000.00",
      lastPrice: "46500.00",
      lastQty: "0.01",
      bidPrice: "46499.00",
      bidQty: "0.05",
      askPrice: "46501.00",
      askQty: "0.05",
      openPrice: "46000.00",
      highPrice: "47000.00",
      lowPrice: "45000.00",
      volume: "1000.00",
      quoteVolume: "46250000.00",
      openTime: 1640908800000,
      closeTime: 1640995200000,
      count: 10000
    });
  }),

  // Binance WebSocket stream (for connection testing)
  http.get('https://stream.binance.com/ws/:symbol', () => {
    return new Response('WebSocket connection', { status: 101 });
  }),

  // Health check handlers
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  }),

  http.get('http://localhost:3000/api/health', () => {
    return HttpResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  }),

  http.get('/api/health/db', () => {
    return HttpResponse.json({ status: 'ok', database: 'connected' });
  }),

  http.get('http://localhost:3000/api/health/db', () => {
    return HttpResponse.json({ status: 'ok', database: 'connected' });
  }),

  // Chat API handlers
  http.get('/api/chat/sessions', () => {
    return HttpResponse.json([]);
  }),

  http.post('/api/chat/sessions', () => {
    return HttpResponse.json({
      session: {
        id: 'test-session-id',
        title: 'Test Session',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    });
  }),

  // Analysis API handlers
  http.get('/api/analysis/sessions', () => {
    return HttpResponse.json([]);
  }),

  http.post('/api/analysis/sessions', () => {
    return HttpResponse.json({
      id: 'test-analysis-session',
      title: 'Test Analysis',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }),

  // Supabase API handlers
  http.post('http://localhost:54321/auth/v1/token', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'test-user-id',
        email: body?.email || 'test@example.com',
        confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    });
  }),

  http.get('http://localhost:54321/rest/v1/:table', ({ params, request }) => {
    const url = new URL(request.url);
    const select = url.searchParams.get('select');
    
    // Mock data based on table
    const mockData = {
      sessions: [
        {
          id: 'test-session-1',
          title: 'Test Session',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ],
      messages: [
        {
          id: 'test-message-1',
          content: 'Test message',
          role: 'user',
          session_id: 'test-session-1',
          created_at: new Date().toISOString()
        }
      ]
    };
    
    return HttpResponse.json(mockData[params.table as keyof typeof mockData] || []);
  }),

  http.post('http://localhost:54321/rest/v1/:table', async ({ params, request }) => {
    const body = await request.json() as any;
    const newItem = {
      id: `test-${params.table}-${Date.now()}`,
      ...(typeof body === 'object' && body !== null ? body : {}),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    return HttpResponse.json(newItem, { status: 201 });
  }),

  // OpenAI API handlers
  http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    const body = await request.json() as any;
    const isStreaming = body?.stream === true;
    
    if (isStreaming) {
      // Mock streaming response
      const streamData = [
        'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n',
        'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"This is a mock"},"finish_reason":null}]}\n\n',
        'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{"content":" streaming response."},"finish_reason":null}]}\n\n',
        'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n'
      ].join('');
      
      return new Response(streamData, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }
    
    // Non-streaming response
    return HttpResponse.json({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: body?.model || 'gpt-4',
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
  }),

  http.post('https://api.openai.com/v1/embeddings', async ({ request }) => {
    const body = await request.json() as any;
    const input = Array.isArray(body?.input) ? body.input : [body?.input || 'default text'];
    
    return HttpResponse.json({
      object: 'list',
      data: input.map((text, index) => ({
        object: 'embedding',
        index: index,
        embedding: Array.from({ length: 1536 }, () => Math.random() - 0.5)
      })),
      model: body?.model || 'text-embedding-ada-002',
      usage: {
        prompt_tokens: input.join(' ').split(' ').length,
        total_tokens: input.join(' ').split(' ').length
      }
    });
  }),

  // Alerts API handlers
  http.get('/api/alerts', () => {
    return HttpResponse.json([
      {
        id: 'alert-1',
        symbol: 'BTCUSDT',
        type: 'price',
        condition: 'above',
        value: 50000,
        active: true,
        created_at: new Date().toISOString()
      }
    ]);
  }),

  http.post('/api/alerts', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      id: `alert-${Date.now()}`,
      ...(typeof body === 'object' && body !== null ? body : {}),
      active: true,
      created_at: new Date().toISOString()
    }, { status: 201 });
  }),

  // Metrics API handlers
  http.get('/api/metrics', () => {
    return HttpResponse.json({
      uptime: 3600,
      memory: {
        used: 100 + Math.floor(Math.random() * 900),
        total: 1000,
        usage_percent: Math.floor(Math.random() * 100)
      },
      cpu: {
        usage: Math.random() * 1.0,
        cores: 4,
        load_avg: [0.5, 0.6, 0.7]
      },
      requests: {
        total: Math.floor(Math.random() * 10000),
        success: Math.floor(Math.random() * 9000),
        errors: Math.floor(Math.random() * 100)
      },
      cache: {
        hits: Math.floor(Math.random() * 1000),
        misses: Math.floor(Math.random() * 100),
        hit_rate: Math.random()
      }
    });
  }),

  // WebSocket monitoring endpoint
  http.get('/api/ws/metrics', () => {
    return HttpResponse.json({
      connections: Math.floor(Math.random() * 100),
      messages_sent: Math.floor(Math.random() * 10000),
      messages_received: Math.floor(Math.random() * 8000),
      latency_avg: Math.random() * 100
    });
  }),

  // Analysis API handlers
  http.post('/api/analysis/sessions/:sessionId/records', async ({ params, request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      id: `record-${Date.now()}`,
      session_id: params.sessionId,
      ...(typeof body === 'object' && body !== null ? body : {}),
      created_at: new Date().toISOString()
    }, { status: 201 });
  }),

  // Memory API handlers
  http.get('/api/memory/sessions', () => {
    return HttpResponse.json([
      {
        id: 'memory-session-1',
        title: 'Memory Session',
        created_at: new Date().toISOString()
      }
    ]);
  }),

  http.get('/api/memory/search', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    
    return HttpResponse.json({
      results: [
        {
          id: 'result-1',
          content: `Search result for: ${query}`,
          relevance: 0.95,
          metadata: {
            timestamp: new Date().toISOString(),
            source: 'test'
          }
        }
      ],
      total: 1
    });
  }),

  // UI Events API handlers - Basic success response for first handler
  http.post('/api/ui-events', async ({ request }) => {
    const body = await request.json() as any;
    // Always return success for UIEventBus tests
    return HttpResponse.json({
      success: true,
      id: `event-${Date.now()}`,
      ...(typeof body === 'object' && body !== null ? body : {}),
      processed_at: new Date().toISOString()
    }, { status: 200 });
  }),

  http.post('http://localhost:3000/api/ui-events', async ({ request }) => {
    const body = await request.json() as any;
    // Always return success for UIEventBus tests
    return HttpResponse.json({
      success: true,
      id: `event-${Date.now()}`,
      ...(typeof body === 'object' && body !== null ? body : {}),
      processed_at: new Date().toISOString()
    }, { status: 200 });
  }),

  // Test example handlers for MSW example tests
  http.get('https://api.example.com/test', () => {
    return HttpResponse.json({ message: 'Hello World' });
  }),

  http.get('https://api.example.com/error', () => {
    return HttpResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }),

  http.get('https://api.example.com/slow', async () => {
    // Simulate slow response
    await new Promise(resolve => setTimeout(resolve, 100));
    return HttpResponse.json({ message: 'Slow response' });
  }),

  http.get('https://api.example.com/xml', () => {
    return new Response(
      '<xml><message>Hello XML</message></xml>',
      {
        headers: {
          'Content-Type': 'application/xml'
        }
      }
    );
  }),

  http.get('https://api.example.com/auth', ({ request }) => {
    const authorization = request.headers.get('Authorization');
    if (!authorization || authorization !== 'Bearer valid-token') {
      return HttpResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    return HttpResponse.json({ message: 'Authorized' });
  }),

  http.post('https://api.example.com/data', async ({ request }) => {
    const contentType = request.headers.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      return HttpResponse.json(
        { error: 'Invalid Content-Type' },
        { status: 400 }
      );
    }

    try {
      const body = await request.json();
      if (!body || typeof body !== 'object') {
        return HttpResponse.json(
          { error: 'Invalid JSON body' },
          { status: 400 }
        );
      }
      return HttpResponse.json({ message: 'Data received', data: body });
    } catch (error) {
      return HttpResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }
  }),

  http.get('https://api.example.com/dynamic', () => {
    return HttpResponse.json({ dynamic: true });
  }),

  // Chat API handlers - using dual handler pattern
  ...createDualHandlers('post', '/api/chat', async ({ request }) => {
    let body: any;
    
    try {
      body = await request.json();
    } catch (error) {
      // Handle malformed JSON
      return HttpResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }
    
    const message = body?.message || '';
    
    if (!message) {
      return HttpResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    
    return HttpResponse.json({
      response: 'Hello! How can I help you?',
      sessionId: `session-${Date.now()}`,
      timestamp: new Date().toISOString()
    });
  }),

  ...createDualHandlers('post', '/api/chat/proposal', async ({ request }) => {
    const body = await request.json() as any;
    
    return HttpResponse.json({
      proposal: {
        id: `prop-${Date.now()}`,
        type: 'entry',
        symbol: 'BTCUSDT',
        direction: 'long',
        entryPrice: 45000,
        confidence: 0.85,
        reasoning: 'Mock proposal based on technical analysis',
        timestamp: new Date().toISOString()
      }
    });
  }),

  // Memory API handlers - using dual handler pattern
  ...createDualHandlers('post', '/api/memory/save', async ({ request }) => {
    const body = await request.json() as any;
    
    return HttpResponse.json({
      success: true,
      id: `memory-${Date.now()}`,
      timestamp: new Date().toISOString()
    });
  }),

  ...createDualHandlers('get', '/api/memory/recall', ({ request }) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    
    return HttpResponse.json({
      conversations: [
        {
          id: 'conv-1',
          sessionId: sessionId || 'default-session',
          message: 'Test recall',
          response: 'Test response',
          timestamp: new Date().toISOString()
        }
      ]
    });
  }),

  ...createDualHandlers('post', '/api/memory/search', async ({ request }) => {
    const body = await request.json() as any;
    const query = body?.query || '';
    
    return HttpResponse.json({
      results: [
        {
          id: 'search-result-1',
          relevance: 0.95,
          content: `Search result for: ${query}`,
          timestamp: new Date().toISOString()
        }
      ],
      total: 1
    });
  }),

  // UI Events API handlers - using dual handler pattern (removed duplicate)
  // Note: Removed duplicate handler to avoid conflicts with main UI Events handler above

  ...createDualHandlers('get', '/api/ui-events', () => {
    // SSE endpoint for UI events
    return new Response('data: {"type":"connected"}\n\n', {
      status: 200,
      headers: { 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  }),

  // AI Analysis Stream API - using dual handler pattern
  ...createDualHandlers('post', '/api/ai/analysis-stream', async ({ request }) => {
    const body = await request.json() as any;
    
    // Return streaming response
    return new Response('data: {"type":"analysis","content":"Starting analysis..."}\n\n', {
      status: 200,
      headers: { 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  }),

  // Binance API proxies - using dual handler pattern
  ...createDualHandlers('get', '/api/binance/ticker', ({ request }) => {
    const url = new URL(request.url);
    const symbol = url.searchParams.get('symbol');  // Don't provide default value
    
    if (!symbol || symbol === 'INVALID') {
      return HttpResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }
    
    return HttpResponse.json({
      symbol: symbol,
      price: '45000.00',
      priceChange: '500.00',  // Fixed field name
      priceChangePercent: '1.13',
      volume: '1234.56',
      timestamp: Date.now()
    });
  }),

  ...createDualHandlers('get', '/api/binance/klines', ({ request }) => {
    const url = new URL(request.url);
    const symbol = url.searchParams.get('symbol') || 'BTCUSDT';
    const interval = url.searchParams.get('interval') || '1h';
    const limit = parseInt(url.searchParams.get('limit') || '100');
    
    if (!symbol) {
      return HttpResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }
    
    // Generate mock kline data in object format as expected by tests
    const klines = Array.from({ length: Math.min(limit, 100) }, (_, i) => {
      const baseTime = Date.now() - (i * 60000); // 1 minute intervals
      const basePrice = 45000 + (Math.random() - 0.5) * 1000;
      return {
        time: baseTime,
        open: basePrice.toFixed(2),
        high: (basePrice + Math.random() * 500).toFixed(2),
        low: (basePrice - Math.random() * 500).toFixed(2),
        close: (basePrice + (Math.random() - 0.5) * 250).toFixed(2),
        volume: (Math.random() * 100).toFixed(2)
      };
    }).reverse(); // Most recent first
    
    return HttpResponse.json(klines);
  }),

  // WebSocket API - using dual handler pattern
  ...createDualHandlers('get', '/api/ws/status', () => {
    return HttpResponse.json({
      status: 'connected',
      connections: Math.floor(Math.random() * 50),
      uptime: Math.floor(Math.random() * 86400),
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  }),

  // Fallback handler for unhandled requests
  http.all('*', ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`);
    return HttpResponse.json(
      { error: 'Not Found', message: `No handler for ${request.method} ${request.url}` },
      { status: 404 }
    );
  })
];