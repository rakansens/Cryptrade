import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// Import route handlers
import { GET as getKlines } from '@/app/api/binance/klines/route';
import { GET as getTicker } from '@/app/api/binance/ticker/route';
import { GET as getMemorySearch } from '@/app/api/memory/search/route';
import { GET as getHealthDb } from '@/app/api/health/db/route';
import { GET as getWsMetrics } from '@/app/api/ws/metrics/route';
import { POST as postEvents } from '@/app/api/events/route';
import { GET as getLogsStream } from '@/app/api/logs/stream/route';
import { POST as postAlerts } from '@/app/api/alerts/route';

// Mock dependencies
jest.mock('../../../lib/services/database');
jest.mock('../../../lib/services/binance.service');
jest.mock('../../../lib/services/websocket.service');
jest.mock('../../../lib/utils/logger');

describe('API Routes Regression Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Binance Klines Route', () => {
    it('should fetch klines data successfully', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/binance/klines?symbol=BTCUSDT&interval=1h&limit=100'
      );

      const response = await getKlines(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('klines');
      expect(Array.isArray(data.klines)).toBe(true);
      expect(data.klines.length).toBeLessThanOrEqual(100);
    });

    it('should validate required parameters', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/binance/klines?interval=1h'
      );

      const response = await getKlines(request);
      expect(response.status).toBe(400);
      
      const error = await response.json();
      expect(error).toHaveProperty('error');
      expect(error.error).toContain('symbol');
    });

    it('should handle invalid intervals', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/binance/klines?symbol=BTCUSDT&interval=invalid'
      );

      const response = await getKlines(request);
      expect(response.status).toBe(400);
    });

    it('should respect limit parameter', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/binance/klines?symbol=BTCUSDT&interval=1h&limit=10'
      );

      const response = await getKlines(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.klines.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Ticker Route', () => {
    it('should fetch ticker data for single symbol', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/binance/ticker?symbol=BTCUSDT'
      );

      const response = await getTicker(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('symbol', 'BTCUSDT');
      expect(data).toHaveProperty('price');
      expect(data).toHaveProperty('volume');
      expect(data).toHaveProperty('change24h');
    });

    it('should fetch multiple tickers', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/binance/ticker?symbols=BTCUSDT,ETHUSDT'
      );

      const response = await getTicker(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(2);
      expect(data.map(t => t.symbol)).toContain('BTCUSDT');
      expect(data.map(t => t.symbol)).toContain('ETHUSDT');
    });

    it('should fetch all tickers when no symbol specified', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/binance/ticker'
      );

      const response = await getTicker(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Search Route', () => {
    it('should search memories with query', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/memory/search?q=bitcoin+analysis&limit=10'
      );

      const response = await getMemorySearch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('results');
      expect(data).toHaveProperty('total');
      expect(Array.isArray(data.results)).toBe(true);
      expect(data.results.length).toBeLessThanOrEqual(10);
    });

    it('should filter by date range', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/memory/search?q=analysis&startDate=2025-06-01&endDate=2025-06-17'
      );

      const response = await getMemorySearch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      data.results.forEach((result) => {
        const date = new Date(result.timestamp);
        expect(date.getTime()).toBeGreaterThanOrEqual(new Date('2025-06-01').getTime());
        expect(date.getTime()).toBeLessThanOrEqual(new Date('2025-06-17').getTime());
      });
    });

    it('should handle empty search results', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/memory/search?q=nonexistentquery123456'
      );

      const response = await getMemorySearch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results).toEqual([]);
      expect(data.total).toBe(0);
    });
  });

  describe('Health DB Route', () => {
    it('should return healthy database status', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/db');

      const response = await getHealthDb(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('status', 'healthy');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('database');
      expect(data.database).toHaveProperty('connected', true);
    });

    it('should include database metrics', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/db');

      const response = await getHealthDb(request);
      const data = await response.json();

      expect(data.database).toHaveProperty('latency');
      expect(data.database).toHaveProperty('version');
      expect(data.database).toHaveProperty('activeConnections');
      expect(typeof data.database.latency).toBe('number');
    });

    it('should handle database connection errors', async () => {
      // Mock database error
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Connection failed'));

      const request = new NextRequest('http://localhost:3000/api/health/db');

      const response = await getHealthDb(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data).toHaveProperty('status', 'unhealthy');
      expect(data).toHaveProperty('error');
    });
  });

  describe('WebSocket Metrics Route', () => {
    it('should return WebSocket metrics', async () => {
      const request = new NextRequest('http://localhost:3000/api/ws/metrics');

      const response = await getWsMetrics(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('connections');
      expect(data).toHaveProperty('messagesReceived');
      expect(data).toHaveProperty('messagesSent');
      expect(data).toHaveProperty('errors');
      expect(data).toHaveProperty('uptime');
    });

    it('should include connection details', async () => {
      const request = new NextRequest('http://localhost:3000/api/ws/metrics?detailed=true');

      const response = await getWsMetrics(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('connectionDetails');
      expect(Array.isArray(data.connectionDetails)).toBe(true);
    });
  });

  describe('Events Route', () => {
    it('should post new event', async () => {
      const eventData = {
        type: 'user_action',
        action: 'chart_zoom',
        data: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          zoomLevel: 2,
        },
      };

      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify(eventData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await postEvents(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('type', eventData.type);
      expect(data).toHaveProperty('action', eventData.action);
    });

    it('should validate event structure', async () => {
      const invalidEvent = {
        // Missing required fields
        data: { test: true },
      };

      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify(invalidEvent),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await postEvents(request);
      expect(response.status).toBe(400);
      
      const error = await response.json();
      expect(error).toHaveProperty('error');
    });
  });

  describe('Logs Stream Route', () => {
    it('should stream logs with SSE', async () => {
      const request = new NextRequest('http://localhost:3000/api/logs/stream');

      const response = await getLogsStream(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');
    });

    it('should filter logs by level', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/logs/stream?level=error'
      );

      const response = await getLogsStream(request);
      expect(response.status).toBe(200);

      // Verify stream includes filter parameter
      const reader = response.body?.getReader();
      expect(reader).toBeDefined();
    });
  });

  describe('Alerts Route', () => {
    it('should create new alert', async () => {
      const alertData = {
        symbol: 'BTCUSDT',
        price: 50000,
        condition: 'above',
        message: 'BTC above 50k',
      };

      const request = new NextRequest('http://localhost:3000/api/alerts', {
        method: 'POST',
        body: JSON.stringify(alertData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await postAlerts(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('symbol', alertData.symbol);
      expect(data).toHaveProperty('price', alertData.price);
      expect(data).toHaveProperty('condition', alertData.condition);
      expect(data).toHaveProperty('enabled', true);
      expect(data).toHaveProperty('createdAt');
    });

    it('should validate alert parameters', async () => {
      const invalidAlert = {
        symbol: 'BTCUSDT',
        // Missing required fields
        condition: 'above',
      };

      const request = new NextRequest('http://localhost:3000/api/alerts', {
        method: 'POST',
        body: JSON.stringify(invalidAlert),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await postAlerts(request);
      expect(response.status).toBe(400);
    });

    it('should validate condition values', async () => {
      const alertData = {
        symbol: 'BTCUSDT',
        price: 50000,
        condition: 'invalid_condition', // Should be 'above' or 'below'
      };

      const request = new NextRequest('http://localhost:3000/api/alerts', {
        method: 'POST',
        body: JSON.stringify(alertData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await postAlerts(request);
      expect(response.status).toBe(400);
      
      const error = await response.json();
      expect(error.error).toContain('condition');
    });
  });

  // Snapshot tests for API responses
  describe('API Response Snapshots', () => {
    it('should match klines response snapshot', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/binance/klines?symbol=BTCUSDT&interval=1h&limit=5'
      );

      const response = await getKlines(request);
      const data = await response.json();

      expect(data).toMatchSnapshot();
    });

    it('should match ticker response snapshot', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/binance/ticker?symbol=BTCUSDT'
      );

      const response = await getTicker(request);
      const data = await response.json();

      expect(data).toMatchSnapshot();
    });

    it('should match health check snapshot', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/db');

      const response = await getHealthDb(request);
      const data = await response.json();

      // Remove dynamic fields for snapshot
      const snapshot = {
        ...data,
        timestamp: '[TIMESTAMP]',
        database: {
          ...data.database,
          latency: '[LATENCY]',
        },
      };

      expect(snapshot).toMatchSnapshot();
    });
  });
});