/**
 * E2E Test Server
 * Next.js development server with test-specific configuration
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { createProxyMiddleware } = require('http-proxy-middleware');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.TEST_PORT || 3001;

// Configure Next.js app
const app = next({ 
  dev,
  hostname,
  port,
  customServer: true
});

const handle = app.getRequestHandler();

// Mock external services
const mockBinanceData = {
  price: '50000.00',
  symbol: 'BTCUSDT',
  time: Date.now()
};

const mockOpenAIResponse = {
  choices: [{
    message: {
      content: 'This is a mock AI response for testing'
    }
  }]
};

async function startServer() {
  try {
    await app.prepare();
    
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        const { pathname } = parsedUrl;

        // Mock Binance API
        if (pathname.startsWith('/api/binance')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify(mockBinanceData));
          return;
        }

        // Mock OpenAI API
        if (pathname.startsWith('/api/ai') || pathname.startsWith('/api/chat')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          
          // Support streaming responses
          if (req.headers.accept?.includes('text/event-stream')) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            
            res.write('data: {"type":"start"}\n\n');
            setTimeout(() => {
              res.write('data: {"type":"content","content":"Mock streaming response"}\n\n');
              res.write('data: {"type":"done"}\n\n');
              res.end();
            }, 100);
            return;
          }
          
          res.end(JSON.stringify(mockOpenAIResponse));
          return;
        }

        // Mock WebSocket endpoints
        if (pathname === '/api/ws') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ url: `ws://localhost:${port}/ws` }));
          return;
        }

        // Handle all other requests with Next.js
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('internal server error');
      }
    });

    // Add WebSocket support for testing
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
      console.log('Test WebSocket connected');
      
      // Send mock market data
      const interval = setInterval(() => {
        const mockData = {
          e: 'trade',
          s: 'BTCUSDT',
          p: (50000 + Math.random() * 1000).toFixed(2),
          q: Math.random().toFixed(8),
          T: Date.now()
        };
        ws.send(JSON.stringify(mockData));
      }, 1000);

      ws.on('close', () => {
        clearInterval(interval);
        console.log('Test WebSocket disconnected');
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clearInterval(interval);
      });
    });

    await new Promise((resolve) => {
      server.listen(port, () => {
        console.log(`> Test server ready on http://${hostname}:${port}`);
        console.log('> Mock services enabled:');
        console.log('  - Binance API: /api/binance/*');
        console.log('  - OpenAI API: /api/ai/*, /api/chat/*');
        console.log('  - WebSocket: ws://localhost:' + port + '/ws');
        resolve();
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start test server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();