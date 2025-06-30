import { mockTestEnv } from '@/tests/helpers/setupEnvMock';
const restoreEnv = mockTestEnv();

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/memory/messages/route';

// Mock authentication
jest.mock('@/lib/auth/server', () => ({
  getServerSession: jest.fn(),
}));

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
import { getServerSession } from '@/lib/auth/server';

describe('POST /api/memory/messages', () => {
  const mockCreate = prisma.conversationMessage.create as jest.MockedFunction<any>;
  const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful authentication by default
    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'test-user-id',
        email: 'test@example.com'
      }
    } as any);
  });

  afterAll(() => {
    restoreEnv();
  });

  it('should create a message successfully', async () => {
    const messageId = `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const timestampOffset = Math.floor(Math.random() * 86400000); // Random time within last day
    
    const mockMessage = {
      id: messageId,
      sessionId: sessionId,
      role: 'user',
      content: 'Hello, world!',
      agentId: null,
      metadata: {},
      timestamp: new Date(Date.now() - timestampOffset),
    };

    mockCreate.mockResolvedValueOnce(mockMessage);

    const requestBody = {
      sessionId: sessionId,
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
    expect(data.message).toMatchObject({
      id: messageId,
      sessionId: sessionId,
      role: 'user',
      content: 'Hello, world!',
      timestamp: expect.any(String),
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        sessionId: sessionId,
        role: 'user',
        content: 'Hello, world!',
        agentId: null,
        metadata: undefined,
      },
    });

    expect(logger.info).toHaveBeenCalledWith(
      '[API] Conversation message created',
      {
        messageId: messageId,
        sessionId: sessionId,
      }
    );
  });

  it('should create a message with optional fields', async () => {
    const messageId = `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const agentId = `agent-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const confidence = 0.8 + Math.random() * 0.2; // 0.8 to 1.0
    const timestampOffset = Math.floor(Math.random() * 172800000); // Random time within last 2 days
    
    const mockMessage = {
      id: messageId,
      sessionId: sessionId,
      role: 'assistant',
      content: 'Here is my response',
      agentId: agentId,
      metadata: { context: 'trading', confidence: parseFloat(confidence.toFixed(2)) },
      timestamp: new Date(Date.now() - timestampOffset),
    };

    mockCreate.mockResolvedValueOnce(mockMessage);

    const requestBody = {
      sessionId: sessionId,
      role: 'assistant',
      content: 'Here is my response',
      agentId: agentId,
      metadata: { context: 'trading', confidence: parseFloat(confidence.toFixed(2)) },
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
    expect(data.message).toMatchObject({
      id: messageId,
      sessionId: sessionId,
      role: 'assistant',
      content: 'Here is my response',
      agentId: agentId,
      metadata: { context: 'trading', confidence: parseFloat(confidence.toFixed(2)) },
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        sessionId: sessionId,
        role: 'assistant',
        content: 'Here is my response',
        agentId: agentId,
        metadata: { context: 'trading', confidence: parseFloat(confidence.toFixed(2)) },
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
    const messageId = `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const timestampOffset = Math.floor(Math.random() * 259200000); // Random time within last 3 days
    
    const mockMessage = {
      id: messageId,
      sessionId: sessionId,
      role: 'system',
      content: 'System notification',
      agentId: null,
      metadata: { type: 'notification' },
      timestamp: new Date(Date.now() - timestampOffset),
    };

    mockCreate.mockResolvedValueOnce(mockMessage);

    const requestBody = {
      sessionId: sessionId,
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
    const rsiValue = Math.floor(30 + Math.random() * 70); // RSI between 30 and 100
    const macdValue = -2 + Math.random() * 4; // MACD between -2 and 2
    const maValue = Math.floor(40000 + Math.random() * 20000); // MA between 40k and 60k
    const confidenceValue = 0.7 + Math.random() * 0.3; // confidence between 0.7 and 1.0
    
    const largeMetadata = {
      context: 'trading',
      analysis: {
        indicators: ['RSI', 'MACD', 'MA'],
        values: { RSI: rsiValue, MACD: parseFloat(macdValue.toFixed(2)), MA: maValue },
      },
      patterns: ['ascending triangle', 'support level'],
      confidence: parseFloat(confidenceValue.toFixed(2)),
      timestamp: new Date().toISOString(),
    };

    const messageId = `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const agentId = `analyzer-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const timestampOffset = Math.floor(Math.random() * 604800000); // Random time within last week
    
    const mockMessage = {
      id: messageId,
      sessionId: sessionId,
      role: 'assistant',
      content: 'Analysis complete',
      agentId: agentId,
      metadata: largeMetadata,
      timestamp: new Date(Date.now() - timestampOffset),
    };

    mockCreate.mockResolvedValueOnce(mockMessage);

    const requestBody = {
      sessionId: sessionId,
      role: 'assistant',
      content: 'Analysis complete',
      agentId: agentId,
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
    const createMockMessage = (index: number) => {
      const timestampOffset = Math.floor(Math.random() * 172800000); // Random time within last 2 days
      return {
        id: `msg-concurrent-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
        sessionId: `session-concurrent-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
        role: 'user',
        content: `Message ${index}`,
        agentId: null,
        metadata: {},
        timestamp: new Date(Date.now() - timestampOffset),
      };
    };

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