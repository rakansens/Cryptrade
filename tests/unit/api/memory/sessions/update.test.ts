import { PATCH } from '@/app/api/memory/sessions/[sessionId]/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    conversationSession: {
      upsert: jest.fn(),
    },
  },
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('PATCH /api/memory/sessions/[sessionId]', () => {
  const sessionId = 'test-session-123';
  const mockRouteContext = {
    params: Promise.resolve({ sessionId }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update existing session summary', async () => {
    const newSummary = 'Updated session summary about BTC trading';
    const mockSession = {
      id: sessionId,
      summary: newSummary,
      lastActiveAt: new Date('2024-01-01T12:00:00Z'),
      createdAt: new Date('2024-01-01T10:00:00Z'),
      metadata: {},
    };

    (prisma.conversationSession.upsert as jest.Mock).mockResolvedValue(mockSession);

    const request = new NextRequest('http://localhost:3000/api/memory/sessions/test-session-123', {
      method: 'PATCH',
      body: JSON.stringify({ summary: newSummary }),
    });

    const response = await PATCH(request, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });

    expect(prisma.conversationSession.upsert).toHaveBeenCalledWith({
      where: { id: sessionId },
      update: {
        summary: newSummary,
        lastActiveAt: expect.any(Date),
      },
      create: {
        id: sessionId,
        summary: newSummary,
        lastActiveAt: expect.any(Date),
      },
    });

    expect(logger.info).toHaveBeenCalledWith(
      '[API] Updated conversation session summary',
      { sessionId }
    );
  });

  it('should create new session if it does not exist', async () => {
    const summary = 'New session about ETH analysis';
    const mockSession = {
      id: sessionId,
      summary: summary,
      lastActiveAt: new Date('2024-01-01T12:00:00Z'),
      createdAt: new Date('2024-01-01T12:00:00Z'),
      metadata: {},
    };

    (prisma.conversationSession.upsert as jest.Mock).mockResolvedValue(mockSession);

    const request = new NextRequest('http://localhost:3000/api/memory/sessions/test-session-123', {
      method: 'PATCH',
      body: JSON.stringify({ summary }),
    });

    const response = await PATCH(request, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });

    // Verify upsert was called with create option
    expect(prisma.conversationSession.upsert).toHaveBeenCalledWith({
      where: { id: sessionId },
      update: expect.any(Object),
      create: {
        id: sessionId,
        summary: summary,
        lastActiveAt: expect.any(Date),
      },
    });
  });

  it('should accept empty summary', async () => {
    const mockSession = {
      id: sessionId,
      summary: '',
      lastActiveAt: new Date(),
      createdAt: new Date(),
      metadata: {},
    };

    (prisma.conversationSession.upsert as jest.Mock).mockResolvedValue(mockSession);

    const request = new NextRequest('http://localhost:3000/api/memory/sessions/test-session-123', {
      method: 'PATCH',
      body: JSON.stringify({ summary: '' }),
    });

    const response = await PATCH(request, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });

    expect(prisma.conversationSession.upsert).toHaveBeenCalledWith({
      where: { id: sessionId },
      update: {
        summary: '',
        lastActiveAt: expect.any(Date),
      },
      create: {
        id: sessionId,
        summary: '',
        lastActiveAt: expect.any(Date),
      },
    });
  });

  it('should handle missing summary field', async () => {
    const request = new NextRequest('http://localhost:3000/api/memory/sessions/test-session-123', {
      method: 'PATCH',
      body: JSON.stringify({}),
    });

    const response = await PATCH(request, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      error: 'Invalid request data',
      details: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('Required'),
        }),
      ]),
    });
  });

  it('should handle invalid JSON in request body', async () => {
    const request = new NextRequest('http://localhost:3000/api/memory/sessions/test-session-123', {
      method: 'PATCH',
      body: 'invalid json',
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(request, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to update session' });
    expect(logger.error).toHaveBeenCalled();
  });

  it('should handle database errors', async () => {
    const mockError = new Error('Database connection failed');
    (prisma.conversationSession.upsert as jest.Mock).mockRejectedValue(mockError);

    const request = new NextRequest('http://localhost:3000/api/memory/sessions/test-session-123', {
      method: 'PATCH',
      body: JSON.stringify({ summary: 'Test summary' }),
    });

    const response = await PATCH(request, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to update session' });
    expect(logger.error).toHaveBeenCalledWith(
      '[API] Failed to update session summary',
      { error: mockError }
    );
  });

  it('should update lastActiveAt to current time', async () => {
    const fixedDate = new Date('2024-01-01T15:00:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => fixedDate);

    const summary = 'Test summary';
    const mockSession = {
      id: sessionId,
      summary: summary,
      lastActiveAt: fixedDate,
      createdAt: new Date('2024-01-01T10:00:00Z'),
      metadata: {},
    };

    (prisma.conversationSession.upsert as jest.Mock).mockResolvedValue(mockSession);

    const request = new NextRequest('http://localhost:3000/api/memory/sessions/test-session-123', {
      method: 'PATCH',
      body: JSON.stringify({ summary }),
    });

    const response = await PATCH(request, mockRouteContext);

    expect(prisma.conversationSession.upsert).toHaveBeenCalledWith({
      where: { id: sessionId },
      update: {
        summary: summary,
        lastActiveAt: fixedDate,
      },
      create: {
        id: sessionId,
        summary: summary,
        lastActiveAt: fixedDate,
      },
    });

    (global.Date as any).mockRestore();
  });

  it('should handle extra fields in request body', async () => {
    const request = new NextRequest('http://localhost:3000/api/memory/sessions/test-session-123', {
      method: 'PATCH',
      body: JSON.stringify({
        summary: 'Valid summary',
        extraField: 'should be ignored',
        anotherField: 123,
      }),
    });

    const mockSession = {
      id: sessionId,
      summary: 'Valid summary',
      lastActiveAt: new Date(),
      createdAt: new Date(),
      metadata: {},
    };

    (prisma.conversationSession.upsert as jest.Mock).mockResolvedValue(mockSession);

    const response = await PATCH(request, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });

    // Verify only summary is passed to upsert
    expect(prisma.conversationSession.upsert).toHaveBeenCalledWith({
      where: { id: sessionId },
      update: {
        summary: 'Valid summary',
        lastActiveAt: expect.any(Date),
      },
      create: {
        id: sessionId,
        summary: 'Valid summary',
        lastActiveAt: expect.any(Date),
      },
    });
  });
});