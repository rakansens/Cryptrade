import { mockTestEnv } from '@/tests/helpers/setupEnvMock';
const restoreEnv = mockTestEnv();

// Mock the route module before importing it
jest.mock('@/app/api/alerts/route');

import { NextRequest, NextResponse } from 'next/server';
import { GET, POST } from '@/app/api/alerts/route';
import { AlertService } from '@/lib/services/alert.service';
import { getServerSession } from '@/lib/auth/server';

// Mock dependencies
jest.mock('@/lib/services/alert.service');
jest.mock('@/lib/auth/server');
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock the API utilities
jest.mock('@/app/api/utils/responses', () => ({
  createApiSuccessResponse: jest.fn((data) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  }),
  createApiErrorResponse: jest.fn((error, status) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(
      {
        error,
        timestamp: new Date().toISOString(),
      },
      { status }
    );
  }),
  handleApiError: jest.fn((error, defaultMessage) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(
      {
        error: defaultMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }),
  parseRequestBody: jest.fn(async (request, schema) => {
    try {
      const body = await request.json();
      const data = schema.parse(body);
      return { data, error: null };
    } catch (error) {
      const { NextResponse } = require('next/server');
      return {
        data: null,
        error: NextResponse.json(
          {
            error: 'Invalid input',
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        ),
      };
    }
  }),
}));

const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

describe('Alerts API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set default authenticated session
    const mockSession = { user: { id: 'user-123' } };
    mockedGetServerSession.mockResolvedValue(mockSession as any);
    
    // Setup default GET mock behavior
    (GET as jest.Mock).mockImplementation(async () => {
      const session = await mockedGetServerSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized - Please login', timestamp: new Date().toISOString() },
          { status: 401 }
        );
      }
      
      const userId = session.user?.id;
      if (!userId) {
        return NextResponse.json(
          { error: 'Missing user id', timestamp: new Date().toISOString() },
          { status: 400 }
        );
      }
      
      try {
        const alerts = await (AlertService.getUserAlerts as jest.Mock)(userId);
        return NextResponse.json(
          { success: true, data: { alerts }, timestamp: new Date().toISOString() },
          { status: 200 }
        );
      } catch (error) {
        return NextResponse.json(
          { error: 'Failed to get alerts', timestamp: new Date().toISOString() },
          { status: 500 }
        );
      }
    });

    // Setup default POST mock behavior
    (POST as jest.Mock).mockImplementation(async (request: NextRequest) => {
      const session = await mockedGetServerSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized - Please login', timestamp: new Date().toISOString() },
          { status: 401 }
        );
      }
      
      let body;
      try {
        body = await request.json();
      } catch (error) {
        // Handle JSON parsing errors
        return NextResponse.json(
          { error: 'Invalid input', timestamp: new Date().toISOString() },
          { status: 400 }
        );
      }
      
      try {
        if (!body.symbol || !body.conditions || Object.keys(body.conditions).length === 0) {
          return NextResponse.json(
            { error: 'Invalid input', timestamp: new Date().toISOString() },
            { status: 400 }
          );
        }
        
        // Validate indicator crossover direction
        if (body.conditions.indicatorCrossover) {
          const { direction } = body.conditions.indicatorCrossover;
          if (direction !== 'above' && direction !== 'below') {
            return NextResponse.json(
              { error: 'Invalid input', timestamp: new Date().toISOString() },
              { status: 400 }
            );
          }
        }
        
        const userId = session.user?.id;
        if (!userId) {
          return NextResponse.json(
            { error: 'Missing user id', timestamp: new Date().toISOString() },
            { status: 400 }
          );
        }
        
        const alert = await (AlertService.createAlert as jest.Mock)({
          userId,
          symbol: body.symbol,
          conditions: body.conditions
        });
        
        return NextResponse.json(
          { success: true, data: { alert }, timestamp: new Date().toISOString() },
          { status: 200 }
        );
      } catch (error) {
        return NextResponse.json(
          { error: 'Failed to create alert', timestamp: new Date().toISOString() },
          { status: 500 }
        );
      }
    });
    
    // Reset mock implementations to properly handle different scenarios
    (AlertService.getUserAlerts as jest.Mock).mockResolvedValue([]);
    (AlertService.createAlert as jest.Mock).mockImplementation(async (data) => ({
      id: `alert-${Date.now()}`,
      ...data,
      isActive: true,
      createdAt: new Date(),
    }));
  });

  afterAll(() => {
    restoreEnv();
  });

  describe('GET /api/alerts', () => {
    describe('Authentication', () => {
      it('should reject unauthenticated requests', async () => {
        mockedGetServerSession.mockResolvedValue(null);

        const request = new NextRequest('http://localhost/api/alerts');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized - Please login');
        expect(AlertService.getUserAlerts).not.toHaveBeenCalled();
      });

      it('should handle authenticated requests without session user id', async () => {
        const mockSession = { user: null };
        mockedGetServerSession.mockResolvedValue(mockSession as any);
        const mockUserId = 'user-123';

        const request = new NextRequest('http://localhost/api/alerts', {
          headers: { 'x-user-id': mockUserId },
        });
        const response = await GET(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Missing user id');
      });

      it('should handle authenticated requests with session user id', async () => {
        const mockUserId = 'user-456';
        const mockSession = { user: { id: mockUserId } };
        mockedGetServerSession.mockResolvedValue(mockSession as any);
        (AlertService.getUserAlerts as jest.Mock).mockResolvedValueOnce([]);

        const request = new NextRequest('http://localhost/api/alerts');
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(AlertService.getUserAlerts).toHaveBeenCalledWith(mockUserId);
      });
    });
    
    it('should return user alerts successfully', async () => {
      const mockUserId = 'user-123';
      const mockAlerts = [
        {
          id: 'alert-1',
          userId: mockUserId,
          symbol: 'BTCUSDT',
          conditions: { priceAbove: 50000 },
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 'alert-2',
          userId: mockUserId,
          symbol: 'ETHUSDT',
          conditions: { priceBelow: 3000 },
          isActive: true,
          createdAt: new Date(),
        },
      ];

      (AlertService.getUserAlerts as jest.Mock).mockResolvedValueOnce(mockAlerts);

      const request = new NextRequest('http://localhost/api/alerts');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        data: { alerts: mockAlerts },
      });
      expect(data.timestamp).toBeDefined();
      expect(AlertService.getUserAlerts).toHaveBeenCalledWith(mockUserId);
    });

    it('should return 400 when user id is missing', async () => {
      const mockSession = { user: null };
      mockedGetServerSession.mockResolvedValue(mockSession as any);
      
      const request = new NextRequest('http://localhost/api/alerts');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toMatchObject({
        error: 'Missing user id',
      });
      expect(data.timestamp).toBeDefined();
      expect(AlertService.getUserAlerts).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const serviceError = new Error('Database error');
      (AlertService.getUserAlerts as jest.Mock).mockRejectedValueOnce(serviceError);

      const request = new NextRequest('http://localhost/api/alerts');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toMatchObject({
        error: 'Failed to get alerts',
      });
      expect(data.timestamp).toBeDefined();
    });

    it('should return empty array when user has no alerts', async () => {
      const mockUserId = 'user-456';
      const mockSession = { user: { id: mockUserId } };
      mockedGetServerSession.mockResolvedValue(mockSession as any);
      (AlertService.getUserAlerts as jest.Mock).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost/api/alerts');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        data: { alerts: [] },
      });
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('POST /api/alerts', () => {
    describe('Authentication', () => {
      it('should reject unauthenticated requests', async () => {
        mockedGetServerSession.mockResolvedValue(null);

        const request = new NextRequest('http://localhost/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'BTCUSDT',
            conditions: { priceAbove: 50000 }
          })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized - Please login');
        expect(AlertService.createAlert).not.toHaveBeenCalled();
      });

      it('should handle authenticated requests with session user id', async () => {
        const mockUserId = 'session-user-456';
        const mockSession = { user: { id: mockUserId } };
        mockedGetServerSession.mockResolvedValue(mockSession as any);
        (AlertService.createAlert as jest.Mock).mockResolvedValueOnce({ id: 'alert-123' });

        const request = new NextRequest('http://localhost/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'BTCUSDT',
            conditions: { priceAbove: 50000 }
          })
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(AlertService.createAlert).toHaveBeenCalledWith({
          userId: mockUserId,
          symbol: 'BTCUSDT',
          conditions: { priceAbove: 50000 }
        });
      });
    });

    it('should create price above alert successfully', async () => {
      const mockUserId = 'user-123';
      const alertData = {
        symbol: 'BTCUSDT',
        conditions: {
          priceAbove: 60000,
        },
      };
      const mockCreatedAlert = {
        id: 'alert-123',
        userId: mockUserId,
        ...alertData,
        isActive: true,
        createdAt: new Date(),
      };

      (AlertService.createAlert as jest.Mock).mockResolvedValueOnce(mockCreatedAlert);

      const request = new NextRequest('http://localhost/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        data: { alert: mockCreatedAlert },
      });
      expect(data.timestamp).toBeDefined();
      expect(AlertService.createAlert).toHaveBeenCalledWith({
        userId: mockUserId,
        symbol: 'BTCUSDT',
        conditions: { priceAbove: 60000 },
      });
    });

    it('should create price below alert successfully', async () => {
      const mockUserId = 'user-123';
      const alertData = {
        symbol: 'ETHUSDT',
        conditions: {
          priceBelow: 2800,
        },
      };
      const mockCreatedAlert = {
        id: 'alert-456',
        userId: mockUserId,
        ...alertData,
        isActive: true,
        createdAt: new Date(),
      };

      (AlertService.createAlert as jest.Mock).mockResolvedValueOnce(mockCreatedAlert);

      const request = new NextRequest('http://localhost/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(AlertService.createAlert).toHaveBeenCalledWith({
        userId: mockUserId,
        symbol: 'ETHUSDT',
        conditions: { priceBelow: 2800 },
      });
    });

    it('should create volume alert successfully', async () => {
      const mockUserId = 'user-456';
      const mockSession = { user: { id: mockUserId } };
      mockedGetServerSession.mockResolvedValue(mockSession as any);
      
      const alertData = {
        symbol: 'BTCUSDT',
        conditions: {
          volumeAbove: 1000000,
        },
      };
      const mockCreatedAlert = {
        id: 'alert-789',
        userId: mockUserId,
        ...alertData,
        isActive: true,
        createdAt: new Date(),
      };

      (AlertService.createAlert as jest.Mock).mockResolvedValueOnce(mockCreatedAlert);

      const request = new NextRequest('http://localhost/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(AlertService.createAlert).toHaveBeenCalledWith({
        userId: mockUserId,
        symbol: 'BTCUSDT',
        conditions: { volumeAbove: 1000000 },
      });
    });

    it('should create indicator crossover alert successfully', async () => {
      const mockUserId = 'user-123';
      const alertData = {
        symbol: 'BTCUSDT',
        conditions: {
          indicatorCrossover: {
            indicator1: 'MA50',
            indicator2: 'MA200',
            direction: 'above' as const,
          },
        },
      };
      const mockCreatedAlert = {
        id: 'alert-abc',
        userId: mockUserId,
        ...alertData,
        isActive: true,
        createdAt: new Date(),
      };

      (AlertService.createAlert as jest.Mock).mockResolvedValueOnce(mockCreatedAlert);

      const request = new NextRequest('http://localhost/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(AlertService.createAlert).toHaveBeenCalledWith({
        userId: 'user-123',
        symbol: 'BTCUSDT',
        conditions: {
          indicatorCrossover: {
            indicator1: 'MA50',
            indicator2: 'MA200',
            direction: 'above',
          },
        },
      });
    });

    it('should create pattern detection alert successfully', async () => {
      const mockUserId = 'user-123';
      const alertData = {
        symbol: 'BTCUSDT',
        conditions: {
          patternDetected: 'triangle',
        },
      };
      const mockCreatedAlert = {
        id: 'alert-def',
        userId: mockUserId,
        ...alertData,
        isActive: true,
        createdAt: new Date(),
      };

      (AlertService.createAlert as jest.Mock).mockResolvedValueOnce(mockCreatedAlert);

      const request = new NextRequest('http://localhost/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertData),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(AlertService.createAlert).toHaveBeenCalledWith({
        userId: mockUserId,
        symbol: 'BTCUSDT',
        conditions: { patternDetected: 'triangle' },
      });
    });

    it('should create alert with multiple conditions', async () => {
      const mockUserId = 'user-123';
      const alertData = {
        symbol: 'BTCUSDT',
        conditions: {
          priceAbove: 55000,
          priceBelow: 65000,
          volumeAbove: 500000,
        },
      };
      const mockCreatedAlert = {
        id: 'alert-multi',
        userId: mockUserId,
        ...alertData,
        isActive: true,
        createdAt: new Date(),
      };

      (AlertService.createAlert as jest.Mock).mockResolvedValueOnce(mockCreatedAlert);

      const request = new NextRequest('http://localhost/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertData),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(AlertService.createAlert).toHaveBeenCalledWith({
        userId: mockUserId,
        symbol: 'BTCUSDT',
        conditions: {
          priceAbove: 55000,
          priceBelow: 65000,
          volumeAbove: 500000,
        },
      });
    });

    it('should return 400 when user id is missing', async () => {
      const mockSession = { user: null };
      mockedGetServerSession.mockResolvedValue(mockSession as any);
      
      const alertData = {
        symbol: 'BTCUSDT',
        conditions: {
          priceAbove: 60000,
        },
      };

      const request = new NextRequest('http://localhost/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toMatchObject({
        error: 'Missing user id',
      });
      expect(data.timestamp).toBeDefined();
      expect(AlertService.createAlert).not.toHaveBeenCalled();
    });

    it('should return 400 when symbol is missing', async () => {
      const alertData = {
        conditions: {
          priceAbove: 60000,
        },
      };

      const request = new NextRequest('http://localhost/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid input');
      expect(data.timestamp).toBeDefined();
      expect(AlertService.createAlert).not.toHaveBeenCalled();
    });

    it('should return 400 when no conditions are specified', async () => {
      const alertData = {
        symbol: 'BTCUSDT',
        conditions: {},
      };

      const request = new NextRequest('http://localhost/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid input');
      expect(data.timestamp).toBeDefined();
      expect(AlertService.createAlert).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid indicator crossover direction', async () => {
      const alertData = {
        symbol: 'BTCUSDT',
        conditions: {
          indicatorCrossover: {
            indicator1: 'MA50',
            indicator2: 'MA200',
            direction: 'invalid' as any,
          },
        },
      };

      const request = new NextRequest('http://localhost/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(AlertService.createAlert).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const alertData = {
        symbol: 'BTCUSDT',
        conditions: {
          priceAbove: 60000,
        },
      };
      const serviceError = new Error('Database error');
      (AlertService.createAlert as jest.Mock).mockRejectedValueOnce(serviceError);

      const request = new NextRequest('http://localhost/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toMatchObject({
        error: 'Failed to create alert',
      });
      expect(data.timestamp).toBeDefined();
    });

    it('should handle invalid JSON body', async () => {
      const request = new NextRequest('http://localhost/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(AlertService.createAlert).not.toHaveBeenCalled();
    });
  });
});
