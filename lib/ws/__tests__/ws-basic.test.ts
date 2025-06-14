/**
 * Basic WSManager Tests - Core functionality
 */

import { WSManager } from '../WSManager';
import { MockWebSocket, BinanceMessageGenerator, setupWebSocketMocking } from './websocket-mock';

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
  beforeEach(() => {
    MockWebSocket.clearInstances();
    jest.clearAllMocks();
  });

  it('should create and destroy manager', () => {
    const manager = new WSManager({
      url: 'wss://test.com'
    });
    
    expect(manager).toBeDefined();
    expect(manager.getActiveStreamsCount()).toBe(0);
    
    manager.destroy();
  });

  it('should subscribe to stream', () => {
    const manager = new WSManager({
      url: 'wss://test.com'
    });
    
    const subscription = manager.subscribe('test@stream').subscribe({
      next: () => {},
      error: () => {}
    });
    
    expect(manager.getActiveStreamsCount()).toBe(1);
    
    subscription.unsubscribe();
    manager.destroy();
  });

  it('should receive messages', (done) => {
    const manager = new WSManager({
      url: 'wss://test.com'
    });
    
    const testMessage = { test: 'data' };
    
    manager.subscribe('test@stream').subscribe({
      next: (data) => {
        expect(data).toEqual(testMessage);
        done();
      },
      error: done.fail
    });
    
    // Send message after connection
    setTimeout(() => {
      const ws = MockWebSocket.getInstanceByUrl('wss://test.com/test@stream');
      if (ws) {
        ws.simulateMessage(testMessage);
      }
    }, 20);
  });

  it('should share connections', () => {
    const manager = new WSManager({
      url: 'wss://test.com'
    });
    
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
    
    const metrics = manager.getMetrics();
    expect(metrics).toHaveProperty('activeConnections');
    expect(metrics).toHaveProperty('totalStreamCreations');
    expect(metrics).toHaveProperty('totalReconnections');
    
    manager.destroy();
  });

  afterEach(() => {
    MockWebSocket.clearInstances();
  });

  afterAll(() => {
    cleanupMock?.();
  });
});