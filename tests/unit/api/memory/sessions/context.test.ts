import { GET } from '@/app/api/memory/sessions/[sessionId]/context/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    conversationMessage: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('GET /api/memory/sessions/[sessionId]/context', () => {
  const mockRequest = new NextRequest('http://localhost:3000/api/memory/sessions/123/context');
  const mockRouteContext = {
    params: Promise.resolve({ sessionId: 'test-session-123' }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return context for existing messages', async () => {
    const mockMessages = [
      {
        id: '1',
        sessionId: 'test-session-123',
        role: 'user',
        content: 'Hello, how are you?',
        timestamp: new Date('2024-01-01T10:00:00Z'),
      },
      {
        id: '2',
        sessionId: 'test-session-123',
        role: 'assistant',
        content: 'I am doing well, thank you!',
        timestamp: new Date('2024-01-01T10:01:00Z'),
      },
      {
        id: '3',
        sessionId: 'test-session-123',
        role: 'user',
        content: 'What is the weather today?',
        timestamp: new Date('2024-01-01T10:02:00Z'),
      },
    ];

    (prisma.conversationMessage.findMany as jest.Mock).mockResolvedValue(mockMessages);

    const response = await GET(mockRequest, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.context).toBe(
      'Recent conversation context:\n' +
      'user: What is the weather today?\n' +
      'assistant: I am doing well, thank you!\n' +
      'user: Hello, how are you?'
    );

    expect(prisma.conversationMessage.findMany).toHaveBeenCalledWith({
      where: { sessionId: 'test-session-123' },
      orderBy: { timestamp: 'desc' },
      take: 5,
    });

    expect(logger.info).toHaveBeenCalledWith(
      '[API] Generated conversation context',
      {
        sessionId: 'test-session-123',
        messageCount: 3,
      }
    );
  });

  it('should return appropriate message when no messages exist', async () => {
    (prisma.conversationMessage.findMany as jest.Mock).mockResolvedValue([]);

    const response = await GET(mockRequest, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.context).toBe('No previous context available.');
  });

  it('should handle database errors gracefully', async () => {
    const mockError = new Error('Database connection failed');
    (prisma.conversationMessage.findMany as jest.Mock).mockRejectedValue(mockError);

    const response = await GET(mockRequest, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to get context');
    expect(logger.error).toHaveBeenCalledWith(
      '[API] Failed to get conversation context',
      { error: mockError }
    );
  });

  it('should handle messages in correct chronological order', async () => {
    const mockMessages = [
      {
        id: '3',
        sessionId: 'test-session-123',
        role: 'user',
        content: 'Third message',
        timestamp: new Date('2024-01-01T10:02:00Z'),
      },
      {
        id: '2',
        sessionId: 'test-session-123',
        role: 'assistant',
        content: 'Second message',
        timestamp: new Date('2024-01-01T10:01:00Z'),
      },
      {
        id: '1',
        sessionId: 'test-session-123',
        role: 'user',
        content: 'First message',
        timestamp: new Date('2024-01-01T10:00:00Z'),
      },
    ];

    // findMany returns in desc order, but we reverse it
    (prisma.conversationMessage.findMany as jest.Mock).mockResolvedValue(mockMessages);

    const response = await GET(mockRequest, mockRouteContext);
    const data = await response.json();

    // After reverse, should be in chronological order
    expect(data.context).toBe(
      'Recent conversation context:\n' +
      'user: First message\n' +
      'assistant: Second message\n' +
      'user: Third message'
    );
  });

  it('should only retrieve last 5 messages', async () => {
    const mockMessages = Array.from({ length: 5 }, (_, i) => ({
      id: String(i + 1),
      sessionId: 'test-session-123',
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i + 1}`,
      timestamp: new Date(`2024-01-01T10:0${i}:00Z`),
    }));

    (prisma.conversationMessage.findMany as jest.Mock).mockResolvedValue(mockMessages);

    const response = await GET(mockRequest, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.conversationMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
      })
    );
  });

  it('should handle special characters in messages', async () => {
    const mockMessages = [
      {
        id: '1',
        sessionId: 'test-session-123',
        role: 'user',
        content: 'What\'s the price of BTC/USD?',
        timestamp: new Date('2024-01-01T10:00:00Z'),
      },
      {
        id: '2',
        sessionId: 'test-session-123',
        role: 'assistant',
        content: 'BTC/USD is currently at $42,000\n\nThis represents a 5% increase.',
        timestamp: new Date('2024-01-01T10:01:00Z'),
      },
    ];

    (prisma.conversationMessage.findMany as jest.Mock).mockResolvedValue(mockMessages);

    const response = await GET(mockRequest, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.context).toContain('What\'s the price of BTC/USD?');
    expect(data.context).toContain('$42,000\n\nThis represents a 5% increase.');
  });
});