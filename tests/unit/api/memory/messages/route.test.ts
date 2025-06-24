import { mockTestEnv } from '@/tests/helpers/setupEnvMock';
const restoreEnv = mockTestEnv();

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/memory/messages/route';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    conversationMessage: {
      create: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';

describe('POST /api/memory/messages', () => {
  const mockCreate = prisma.conversationMessage.create as jest.MockedFunction<any>;
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    restoreEnv();
  });

  it('should create a message successfully', async () => {
    const mockMessage = {
      id: 'msg-123',
      sessionId: 'session-123',
      role: 'user',
      content: 'Hello, world!',
      agentId: null,
      metadata: {},
      timestamp: new Date(Date.now() - 86400000) // 2024-01-01T00:00:00Z'),
    };

    mockCreate.mockResolvedValueOnce(mockMessage);

    const requestBody = {
      sessionId: 'session-123',
      role: 'user',
      content: 'Hello, world!',
    };

    const request = new NextRequest('http://localhost/api/memory/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      message: {
        id: 'msg-123',
        sessionId: 'session-123',
        role: 'user',
        content: 'Hello, world!',
        timestamp: expect.any(String),
      },
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        sessionId: 'session-123',
        role: 'user',
        content: 'Hello, world!',
        agentId: null,
        metadata: undefined,
      },
    });

    expect(logger.info).toHaveBeenCalledWith(
      '[API] Conversation message created',
      {
        messageId: 'msg-123',
        sessionId: 'session-123',
      }
    );
  });

  it('should create a message with optional fields', async () => {
    const mockMessage = {
      id: 'msg-456',
      sessionId: 'session-456',
      role: 'assistant',
      content: 'Here is my response',
      agentId: 'agent-123',
      metadata: { context: 'trading', confidence: 0.95 },
      timestamp: new Date(Date.now() - 86400000) // 2024-01-01T00:00:00Z'),
    };

    mockCreate.mockResolvedValueOnce(mockMessage);

    const requestBody = {
      sessionId: 'session-456',
      role: 'assistant',
      content: 'Here is my response',
      agentId: 'agent-123',
      metadata: { context: 'trading', confidence: 0.95 },
    };

    const request = new NextRequest('http://localhost/api/memory/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      message: {
        id: 'msg-456',
        sessionId: 'session-456',
        role: 'assistant',
        content: 'Here is my response',
        agentId: 'agent-123',
        metadata: { context: 'trading', confidence: 0.95 },
      },
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        sessionId: 'session-456',
        role: 'assistant',
        content: 'Here is my response',
        agentId: 'agent-123',
        metadata: { context: 'trading', confidence: 0.95 },
      },
    });
  });

  it('should return 400 for invalid role', async () => {
    const requestBody = {
      sessionId: 'session-123',
      role: 'invalid', // Invalid role
      content: 'Test message',
    };

    const request = new NextRequest('http://localhost/api/memory/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toMatchObject({
      error: 'Invalid request data',
      details: expect.arrayContaining([
        expect.objectContaining({
          path: ['role'],
        }),
      ]),
    });

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should return 400 for missing required fields', async () => {
    const requestBody = {
      sessionId: 'session-123',
      // Missing role and content
    };

    const request = new NextRequest('http://localhost/api/memory/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toMatchObject({
      error: 'Invalid request data',
      details: expect.arrayContaining([
        expect.objectContaining({
          path: ['role'],
        }),
        expect.objectContaining({
          path: ['content'],
        }),
      ]),
    });
  });

  it('should return 400 for empty content', async () => {
    const requestBody = {
      sessionId: 'session-123',
      role: 'user',
      content: '', // Empty content
    };

    const request = new NextRequest('http://localhost/api/memory/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toMatchObject({
      error: 'Invalid request data',
      details: expect.arrayContaining([
        expect.objectContaining({
          path: ['content'],
          message: 'String must contain at least 1 character(s)',
          code: 'too_small',
        }),
      ]),
    });
  });

  it('should handle database errors', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Database connection failed'));

    const requestBody = {
      sessionId: 'session-123',
      role: 'user',
      content: 'Test message',
    };

    const request = new NextRequest('http://localhost/api/memory/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toMatchObject({
      error: 'Failed to create message',
    });

    expect(logger.error).toHaveBeenCalledWith(
      '[API] Failed to create conversation message',
      expect.objectContaining({
        error: expect.any(Error),
      })
    );
  });

  it('should handle invalid JSON in request body', async () => {
    const request = new NextRequest('http://localhost/api/memory/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: 'invalid json',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toMatchObject({
      error: 'Failed to create message',
    });

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should handle system role messages', async () => {
    const mockMessage = {
      id: 'msg-789',
      sessionId: 'session-789',
      role: 'system',
      content: 'System notification',
      agentId: null,
      metadata: { type: 'notification' },
      timestamp: new Date(Date.now() - 86400000) // 2024-01-01T00:00:00Z'),
    };

    mockCreate.mockResolvedValueOnce(mockMessage);

    const requestBody = {
      sessionId: 'session-789',
      role: 'system',
      content: 'System notification',
      metadata: { type: 'notification' },
    };

    const request = new NextRequest('http://localhost/api/memory/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message.role).toBe('system');
  });

  it('should handle large metadata objects', async () => {
    const largeMetadata = {
      context: 'trading',
      analysis: {
        indicators: ['RSI', 'MACD', 'MA'],
        values: { RSI: 65, MACD: 0.5, MA: 45000 },
      },
      patterns: ['ascending triangle', 'support level'],
      confidence: 0.85,
      timestamp: new Date().toISOString(),
    };

    const mockMessage = {
      id: 'msg-large',
      sessionId: 'session-large',
      role: 'assistant',
      content: 'Analysis complete',
      agentId: 'analyzer',
      metadata: largeMetadata,
      timestamp: new Date(Date.now() - 86400000) // 2024-01-01T00:00:00Z'),
    };

    mockCreate.mockResolvedValueOnce(mockMessage);

    const requestBody = {
      sessionId: 'session-large',
      role: 'assistant',
      content: 'Analysis complete',
      agentId: 'analyzer',
      metadata: largeMetadata,
    };

    const request = new NextRequest('http://localhost/api/memory/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message.metadata).toEqual(largeMetadata);
  });

  it('should handle concurrent message creation', async () => {
    const createMockMessage = (index: number) => ({
      id: `msg-concurrent-${index}`,
      sessionId: `session-concurrent-${index}`,
      role: 'user',
      content: `Message ${index}`,
      agentId: null,
      metadata: {},
      timestamp: new Date(Date.now() - 86400000) // 2024-01-01T00:00:00Z'),
    });

    const requests = Array(5).fill(null).map((_, index) => {
      mockCreate.mockResolvedValueOnce(createMockMessage(index));

      const requestBody = {
        sessionId: `session-concurrent-${index}`,
        role: 'user',
        content: `Message ${index}`,
      };

      return new NextRequest('http://localhost/api/memory/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    });

    const responses = await Promise.all(requests.map(req => POST(req)));

    responses.forEach((response, index) => {
      expect(response.status).toBe(200);
    });

    expect(mockCreate).toHaveBeenCalledTimes(5);
  });
});