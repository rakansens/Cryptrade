/**
 * Basic WSManager Tests - Core functionality
 */

import { WSManager } from '@/lib/ws/WSManager';
import { MockWebSocket, setupWebSocketMocking } from '@/lib/ws/websocket-mock';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Setup WebSocket mocking
const cleanupMock = setupWebSocketMocking();

describe('WSManager Basic Tests', () => {
  let managers: WSManager[] = [];

  beforeEach(() => {
    MockWebSocket.clearInstances();
    jest.clearAllMocks();
    managers = [];
  });

  it('should create and destroy manager', () => {
    const manager = new WSManager({
      url: 'wss://test.com'
    });
    managers.push(manager);
    
    expect(manager).toBeDefined();
    expect(manager.getActiveStreamsCount()).toBe(0);
    
    manager.destroy();
  });

  it('should subscribe to stream', () => {
    const manager = new WSManager({
      url: 'wss://test.com'
    });
    managers.push(manager);
    
    const subscription = manager.subscribe('test@stream').subscribe({
      next: () => {},
      error: () => {}
    });
    
    expect(manager.getActiveStreamsCount()).toBe(1);
    
    subscription.unsubscribe();
    manager.destroy();
  });

  it('should receive messages', async () => {
    const manager = new WSManager({
      url: 'wss://test.com'
    });
    
    const testMessage = { test: 'data' };
    
    // Create a promise that resolves when message is received
    const messageReceived = new Promise<void>((resolve, reject) => {
      manager.subscribe('test@stream').subscribe({
        next: (data) => {
          expect(data).toEqual(testMessage);
          resolve();
        },
        error: reject
      });
    });
    
    // Send message after connection
    await new Promise(resolve => setTimeout(resolve, 50));
    const ws = MockWebSocket.getInstanceByUrl('wss://test.com/test@stream');
    if (ws) {
      ws.simulateMessage(testMessage as any);
    }
    
    // Wait for message
    await messageReceived;
    manager.destroy();
  }, 10000);

  it('should share connections', () => {
    const manager = new WSManager({
      url: 'wss://test.com'
    });
    managers.push(manager);
    
    const sub1 = manager.subscribe('test@stream').subscribe({ next: () => {} });
    const sub2 = manager.subscribe('test@stream').subscribe({ next: () => {} });
    
    // Should only have one connection
    expect(MockWebSocket.getAllInstances()).toHaveLength(1);
    expect(manager.getActiveStreamsCount()).toBe(1);
    
    sub1.unsubscribe();
    sub2.unsubscribe();
    manager.destroy();
  });

  it('should track metrics', () => {
    const manager = new WSManager({
      url: 'wss://test.com'
    });
    managers.push(manager);
    
    const metrics = manager.getMetrics();
    expect(metrics).toHaveProperty('activeConnections');
    expect(metrics).toHaveProperty('totalStreamCreations');
    expect(metrics).toHaveProperty('totalReconnections');
    
    manager.destroy();
  });

  afterEach(() => {
    // Clean up all managers
    managers.forEach(manager => manager.destroy());
    managers = [];
    MockWebSocket.clearInstances();
  });

  afterAll(() => {
    cleanupMock?.();
  });
});