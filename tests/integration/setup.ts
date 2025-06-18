/**
 * Integration Test Setup
 * 
 * Common setup and utilities for integration tests
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:54322/postgres';

// Helper to clean up database between tests
export async function cleanupDatabase() {
  try {
    // Clean up in correct order to avoid foreign key constraints
    await prisma.conversationMessage.deleteMany();
    await prisma.conversationSession.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.rateLimitRecord.deleteMany();
    
    logger.info('[Integration Setup] Database cleaned');
  } catch (error) {
    logger.error('[Integration Setup] Failed to cleanup database', { error });
  }
}

// Helper to seed test data
export async function seedTestData() {
  try {
    // Create test user
    const testUserId = 'test-user-123';
    
    // Create test session
    const session = await prisma.conversationSession.create({
      data: {
        id: 'test-session-123',
        userId: testUserId,
        startedAt: new Date(),
        lastActiveAt: new Date(),
      },
    });
    
    // Create test messages
    await prisma.conversationMessage.createMany({
      data: [
        {
          sessionId: session.id,
          role: 'user',
          content: 'What is the price of Bitcoin?',
          timestamp: new Date(),
        },
        {
          sessionId: session.id,
          role: 'assistant',
          content: 'Bitcoin is currently trading at $45,000.',
          timestamp: new Date(),
        },
      ],
    });
    
    logger.info('[Integration Setup] Test data seeded');
  } catch (error) {
    logger.error('[Integration Setup] Failed to seed test data', { error });
  }
}

// Mock WebSocket for testing
export class MockWebSocket {
  public readyState: number = 1; // OPEN
  public onopen?: (event: Event) => void;
  public onclose?: (event: CloseEvent) => void;
  public onerror?: (event: Event) => void;
  public onmessage?: (event: MessageEvent) => void;
  
  constructor(public url: string) {
    setTimeout(() => {
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }
  
  send(data: string) {
    // Mock implementation
    console.log('[MockWebSocket] Sending:', data);
  }
  
  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }
  
  // Helper to simulate receiving messages
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }
}

// Mock fetch for testing
export function mockFetch(responses: Record<string, any>) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    
    for (const [pattern, response] of Object.entries(responses)) {
      if (urlStr.includes(pattern)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => response,
          text: async () => JSON.stringify(response),
          headers: new Headers({
            'content-type': 'application/json',
          }),
        });
      }
    }
    
    return Promise.resolve({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
      text: async () => 'Not found',
      headers: new Headers(),
    });
  });
}

// Restore original fetch
export function restoreFetch() {
  if ('fetch' in global && jest.isMockFunction(global.fetch)) {
    (global.fetch as jest.Mock).mockRestore();
  }
}

// Setup and teardown hooks
export function setupIntegrationTests() {
  beforeAll(async () => {
    await cleanupDatabase();
  });
  
  afterEach(async () => {
    await cleanupDatabase();
    restoreFetch();
  });
  
  afterAll(async () => {
    await prisma.$disconnect();
  });
}

// Export everything
export default {
  cleanupDatabase,
  seedTestData,
  MockWebSocket,
  mockFetch,
  restoreFetch,
  setupIntegrationTests,
};