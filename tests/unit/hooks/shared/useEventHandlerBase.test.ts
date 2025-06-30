import { renderHook } from '@testing-library/react';
import { useEventHandlerBase, createEventHandlerConfig, createEventListeners } from '@/hooks/shared/useEventHandlerBase';

// Mock dependencies
jest.mock('@/lib/mastra/agents/utils/agent-utils', () => ({
  handleAgentError: jest.fn()
}));

jest.mock('@/lib/chart/agent-utils', () => ({
  showAgentSuccess: jest.fn(),
  handleValidationError: jest.fn()
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('useEventHandlerBase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should register event listeners and create handlers', () => {
      const mockProcessor = jest.fn();
      const mockValidator = jest.fn().mockReturnValue({ success: true, data: { test: 'data' } });
      
      const config = createEventHandlerConfig(
        { 'test:event': 'Test Operation' },
        { 'test:event': (data) => `Test completed: ${data}` },
        mockValidator
      );

      const eventListeners = createEventListeners([
        { eventType: 'test:event', processor: mockProcessor }
      ]);

      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      const { logger } = require('@/lib/utils/logger');

      renderHook(() => useEventHandlerBase(config, eventListeners));

      expect(addEventListenerSpy).toHaveBeenCalledWith('test:event', expect.any(Function));
      expect(logger.info).toHaveBeenCalledWith(
        '[Event Handler Base] Registered event listeners',
        expect.objectContaining({
          eventCount: 1,
          events: ['test:event']
        })
      );

      addEventListenerSpy.mockRestore();
    });

    it('should clean up event listeners on unmount', () => {
      const mockProcessor = jest.fn();
      const mockValidator = jest.fn().mockReturnValue({ success: true, data: { test: 'data' } });
      
      const config = createEventHandlerConfig(
        { 'test:event': 'Test Operation' },
        { 'test:event': (data) => `Test completed: ${data}` },
        mockValidator
      );

      const eventListeners = createEventListeners([
        { eventType: 'test:event', processor: mockProcessor }
      ]);

      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      const { logger } = require('@/lib/utils/logger');

      const { unmount } = renderHook(() => useEventHandlerBase(config, eventListeners));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('test:event', expect.any(Function));
      expect(logger.info).toHaveBeenCalledWith('[Event Handler Base] Cleaned up event listeners');

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('event handling', () => {
    it('should handle valid events successfully', async () => {
      const mockProcessor = jest.fn().mockResolvedValue(undefined);
      const mockValidator = jest.fn().mockReturnValue({
        success: true,
        data: { data: { test: 'data' } }
      });
      
      const config = createEventHandlerConfig(
        { 'test:event': 'Test Operation' },
        { 'test:event': (data) => `Test completed: ${JSON.stringify(data)}` },
        mockValidator
      );

      const eventListeners = createEventListeners([
        { eventType: 'test:event', processor: mockProcessor }
      ]);

      const { result } = renderHook(() => useEventHandlerBase(config, eventListeners));
      const { logger } = require('@/lib/utils/logger');
      const { showAgentSuccess } = require('@/lib/chart/agent-utils');

      // Create and dispatch a custom event
      const testEvent = new CustomEvent('test:event', {
        detail: { test: 'data' }
      });

      // Get the created handler and call it directly
      const handler = result.current.createHandler('test:event', mockProcessor);
      await handler(testEvent);

      expect(mockValidator).toHaveBeenCalledWith('test:event', { test: 'data' });
      expect(mockProcessor).toHaveBeenCalledWith({ test: 'data' });
      expect(showAgentSuccess).toHaveBeenCalledWith(
        { eventType: 'test:event', operation: 'Test Operation' },
        'Test completed: {"test":"data"}'
      );
      expect(logger.info).toHaveBeenCalledWith(
        '[Event] Handling test:event',
        expect.objectContaining({
          eventType: 'test:event',
          operation: 'Test Operation',
          data: { test: 'data' }
        })
      );
    });

    it('should handle validation failures', async () => {
      const mockProcessor = jest.fn();
      const mockValidator = jest.fn().mockReturnValue({
        success: false,
        error: 'Validation failed'
      });
      
      const config = createEventHandlerConfig(
        { 'test:event': 'Test Operation' },
        { 'test:event': (data) => `Test completed: ${data}` },
        mockValidator
      );

      const eventListeners = createEventListeners([
        { eventType: 'test:event', processor: mockProcessor }
      ]);

      const { result } = renderHook(() => useEventHandlerBase(config, eventListeners));
      const { handleValidationError } = require('@/lib/chart/agent-utils');

      const testEvent = new CustomEvent('test:event', {
        detail: { test: 'invalid' }
      });

      const handler = result.current.createHandler('test:event', mockProcessor);
      await handler(testEvent);

      expect(mockValidator).toHaveBeenCalledWith('test:event', { test: 'invalid' });
      expect(mockProcessor).not.toHaveBeenCalled();
      expect(handleValidationError).toHaveBeenCalledWith(
        { success: false, error: 'Validation failed' },
        {
          eventType: 'test:event',
          operation: 'Test Operation',
          payload: { test: 'invalid' }
        }
      );
    });

    it('should handle processing errors', async () => {
      const processingError = new Error('Processing failed');
      const mockProcessor = jest.fn().mockRejectedValue(processingError);
      const mockValidator = jest.fn().mockReturnValue({
        success: true,
        data: { data: { test: 'data' } }
      });
      
      const config = createEventHandlerConfig(
        { 'test:event': 'Test Operation' },
        { 'test:event': (data) => `Test completed: ${data}` },
        mockValidator
      );

      const eventListeners = createEventListeners([
        { eventType: 'test:event', processor: mockProcessor }
      ]);

      const { result } = renderHook(() => useEventHandlerBase(config, eventListeners));
      const { handleAgentError } = require('@/lib/mastra/agents/utils/agent-utils');

      const testEvent = new CustomEvent('test:event', {
        detail: { test: 'data' }
      });

      const handler = result.current.createHandler('test:event', mockProcessor);
      await handler(testEvent);

      expect(mockProcessor).toHaveBeenCalledWith({ test: 'data' });
      expect(handleAgentError).toHaveBeenCalledWith(
        processingError,
        {
          eventType: 'test:event',
          operation: 'Test Operation',
          payload: { test: 'data' }
        }
      );
    });
  });

  describe('configuration helpers', () => {
    it('should create event handler config correctly', () => {
      const operations = { 'test:event': 'Test Operation' };
      const successMessages = { 'test:event': (data: any) => `Success: ${data.id}` };
      const validator = jest.fn();

      const config = createEventHandlerConfig(operations, successMessages, validator);

      expect(config.getOperation('test:event')).toBe('Test Operation');
      expect(config.getOperation('unknown:event')).toBe('Unknown operation');
      
      expect(config.getSuccessMessage('test:event', { id: '123' })).toBe('Success: 123');
      expect(config.getSuccessMessage('unknown:event', {})).toBe('unknown:event completed');
      
      expect(config.validator).toBe(validator);
    });

    it('should create event listeners config correctly', () => {
      const processor1 = jest.fn();
      const processor2 = jest.fn();

      const listeners = createEventListeners([
        { eventType: 'test:event1', processor: processor1 },
        { eventType: 'test:event2', processor: processor2 }
      ]);

      expect(listeners).toHaveLength(2);
      expect(listeners[0]).toEqual({ eventType: 'test:event1', processor: processor1 });
      expect(listeners[1]).toEqual({ eventType: 'test:event2', processor: processor2 });
    });
  });

  describe('error context handling', () => {
    it('should include error context when provided', async () => {
      const processingError = new Error('Processing failed');
      const mockProcessor = jest.fn().mockRejectedValue(processingError);
      const mockValidator = jest.fn().mockReturnValue({
        success: true,
        data: { data: { test: 'data' } }
      });

      const errorContextProvider = jest.fn().mockReturnValue({
        context: 'additional info'
      });
      
      const config = createEventHandlerConfig(
        { 'test:event': 'Test Operation' },
        { 'test:event': (data) => `Test completed: ${data}` },
        mockValidator,
        errorContextProvider
      );

      const eventListeners = createEventListeners([
        { eventType: 'test:event', processor: mockProcessor }
      ]);

      const { result } = renderHook(() => useEventHandlerBase(config, eventListeners));
      const { handleAgentError } = require('@/lib/mastra/agents/utils/agent-utils');

      const testEvent = new CustomEvent('test:event', {
        detail: { test: 'data' }
      });

      const handler = result.current.createHandler('test:event', mockProcessor);
      await handler(testEvent);

      expect(errorContextProvider).toHaveBeenCalledWith('test:event', { test: 'data' });
      expect(handleAgentError).toHaveBeenCalledWith(
        processingError,
        {
          eventType: 'test:event',
          operation: 'Test Operation',
          payload: { test: 'data' },
          context: 'additional info'
        }
      );
    });
  });
});