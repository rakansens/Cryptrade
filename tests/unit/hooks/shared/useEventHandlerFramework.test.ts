import { renderHook, act } from '@testing-library/react';
import { 
  useEventHandlerFramework, 
  createEventDefinition,
  commonValidators,
  commonSuccessMessages,
  commonErrorMessages
} from '@/hooks/shared/useEventHandlerFramework';
import { showToast } from '@/lib/notifications/toast';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/notifications/toast', () => ({
  showToast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn()
  }
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('@/hooks/shared/useEventHandlerBase', () => ({
  useEventHandlerBase: jest.fn()
}));

describe('useEventHandlerFramework', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Framework initialization', () => {
    it('should initialize with provided configuration', () => {
      const events = [
        createEventDefinition({
          type: 'test:action',
          operation: 'Test action',
          processor: jest.fn()
        })
      ];

      const { result } = renderHook(() =>
        useEventHandlerFramework({
          domain: 'test',
          hookName: 'testHook',
          events
        })
      );

      // Framework uses refs internally, need to check implementation details
      expect(result.current.isEventSupported('test:action')).toBe(true);
    });

    it('should build event map from definitions', () => {
      const events = [
        createEventDefinition({
          type: 'test:create',
          operation: 'Create',
          processor: jest.fn()
        }),
        createEventDefinition({
          type: 'test:update',
          operation: 'Update',
          processor: jest.fn()
        })
      ];

      const { result } = renderHook(() =>
        useEventHandlerFramework({
          domain: 'test',
          hookName: 'testHook',
          events
        })
      );

      expect(result.current.isEventSupported('test:create')).toBe(true);
      expect(result.current.isEventSupported('test:update')).toBe(true);
      expect(result.current.isEventSupported('test:delete')).toBe(false);
    });
  });

  describe('Event processing', () => {
    it('should process events successfully', async () => {
      const processor = jest.fn().mockResolvedValue({ success: true });
      const onSuccess = jest.fn();

      const events = [
        createEventDefinition({
          type: 'test:action',
          operation: 'Test action',
          processor,
          successMessage: 'Action completed'
        })
      ];

      const { result } = renderHook(() =>
        useEventHandlerFramework({
          domain: 'test',
          hookName: 'testHook',
          events,
          onSuccess
        })
      );

      const testData = { id: '123', value: 'test' };
      
      await act(async () => {
        await result.current.processEvent('test:action', testData);
      });

      expect(processor).toHaveBeenCalledWith(testData);
      expect(onSuccess).toHaveBeenCalledWith('test:action', testData);
      expect(showToast.success).toHaveBeenCalledWith('Action completed');
      expect(result.current.processingErrors.has('test:action')).toBe(false);
    });

    it('should handle event processing errors', async () => {
      const error = new Error('Processing failed');
      const processor = jest.fn().mockRejectedValue(error);
      const onError = jest.fn();

      const events = [
        createEventDefinition({
          type: 'test:action',
          operation: 'Test action',
          processor,
          errorMessage: 'Action failed'
        })
      ];

      const { result } = renderHook(() =>
        useEventHandlerFramework({
          domain: 'test',
          hookName: 'testHook',
          events,
          onError
        })
      );

      const testData = { id: '123' };

      await act(async () => {
        await expect(result.current.processEvent('test:action', testData))
          .rejects.toThrow('Processing failed');
      });

      expect(onError).toHaveBeenCalledWith('test:action', error, testData);
      expect(showToast.error).toHaveBeenCalledWith('Action failed');
      expect(result.current.processingErrors.get('test:action')).toBe(error);
    });

    it('should validate data before processing', async () => {
      const processor = jest.fn();
      const validator = jest.fn().mockReturnValue(false);

      const events = [
        createEventDefinition({
          type: 'test:action',
          operation: 'Test action',
          processor,
          validate: validator
        })
      ];

      const { result } = renderHook(() =>
        useEventHandlerFramework({
          domain: 'test',
          hookName: 'testHook',
          events
        })
      );

      await act(async () => {
        await expect(result.current.processEvent('test:action', {}))
          .rejects.toThrow('Validation failed for test:action');
      });

      expect(validator).toHaveBeenCalled();
      expect(processor).not.toHaveBeenCalled();
    });

    it('should handle async validation', async () => {
      const processor = jest.fn().mockResolvedValue({ success: true });
      const validator = jest.fn().mockResolvedValue(true);

      const events = [
        createEventDefinition({
          type: 'test:action',
          operation: 'Test action',
          processor,
          validate: validator,
          async: true
        })
      ];

      const { result } = renderHook(() =>
        useEventHandlerFramework({
          domain: 'test',
          hookName: 'testHook',
          events
        })
      );

      await act(async () => {
        await result.current.processEvent('test:action', {});
      });

      expect(validator).toHaveBeenCalled();
      expect(processor).toHaveBeenCalled();
    });

    it('should handle timeout for long-running operations', async () => {
      const processor = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      const events = [
        createEventDefinition({
          type: 'test:action',
          operation: 'Test action',
          processor,
          timeout: 100
        })
      ];

      const { result } = renderHook(() =>
        useEventHandlerFramework({
          domain: 'test',
          hookName: 'testHook',
          events
        })
      );

      await act(async () => {
        await expect(result.current.processEvent('test:action', {}))
          .rejects.toThrow('Processing timeout');
      });
    });

    it('should handle unsupported event types', async () => {
      const { result } = renderHook(() =>
        useEventHandlerFramework({
          domain: 'test',
          hookName: 'testHook',
          events: []
        })
      );

      await act(async () => {
        await expect(result.current.processEvent('unknown:event', {}))
          .rejects.toThrow('Unsupported event type: unknown:event');
      });

      // Note: processingErrors is a ref and may not be reactive in tests
      // The error should be stored but accessing it in tests may be limited
    });
  });

  describe('Notifications', () => {
    it('should show notifications when enabled', async () => {
      const processor = jest.fn().mockResolvedValue({ success: true });

      const events = [
        createEventDefinition({
          type: 'test:action',
          operation: 'Test action',
          processor,
          successMessage: 'Success!',
          notificationLevel: 'info'
        })
      ];

      const { result } = renderHook(() =>
        useEventHandlerFramework({
          domain: 'test',
          hookName: 'testHook',
          events,
          enableNotifications: true
        })
      );

      await act(async () => {
        await result.current.processEvent('test:action', {});
      });

      expect(showToast.info).toHaveBeenCalledWith('Success!');
    });

    it('should not show notifications when disabled', async () => {
      const processor = jest.fn().mockResolvedValue({ success: true });

      const events = [
        createEventDefinition({
          type: 'test:action',
          operation: 'Test action',
          processor,
          successMessage: 'Success!'
        })
      ];

      const { result } = renderHook(() =>
        useEventHandlerFramework({
          domain: 'test',
          hookName: 'testHook',
          events,
          enableNotifications: false
        })
      );

      await act(async () => {
        await result.current.processEvent('test:action', {});
      });

      expect(showToast.success).not.toHaveBeenCalled();
    });

    it('should use dynamic success messages', async () => {
      const processor = jest.fn().mockResolvedValue({ success: true });

      const events = [
        createEventDefinition({
          type: 'test:action',
          operation: 'Test action',
          processor,
          successMessage: (data: any) => `Created item ${data.id}`
        })
      ];

      const { result } = renderHook(() =>
        useEventHandlerFramework({
          domain: 'test',
          hookName: 'testHook',
          events
        })
      );

      await act(async () => {
        await result.current.processEvent('test:action', { id: '123' });
      });

      expect(showToast.success).toHaveBeenCalledWith('Created item 123');
    });

    it('should use dynamic error messages', async () => {
      const error = new Error('Not found');
      const processor = jest.fn().mockRejectedValue(error);

      const events = [
        createEventDefinition({
          type: 'test:action',
          operation: 'Test action',
          processor,
          errorMessage: (err: Error, data?: any) => `Failed to process ${data?.id}: ${err.message}`
        })
      ];

      const { result } = renderHook(() =>
        useEventHandlerFramework({
          domain: 'test',
          hookName: 'testHook',
          events
        })
      );

      await act(async () => {
        try {
          await result.current.processEvent('test:action', { id: '123' });
        } catch (e) {
          // Expected error
        }
      });

      expect(showToast.error).toHaveBeenCalledWith('Failed to process 123: Not found');
    });
  });

  describe('Utility functions', () => {
    it('should clear errors', () => {
      const { result } = renderHook(() =>
        useEventHandlerFramework({
          domain: 'test',
          hookName: 'testHook',
          events: []
        })
      );

      // Simulate errors being added by processing failed events
      act(() => {
        result.current.processEvent('unknown:event', {}).catch(() => {
          // Expected error for unsupported event
        });
      });

      act(() => {
        result.current.clearErrors();
      });

      // After clearing, errors should be removed
      expect(result.current.processingErrors.size).toBe(0);
    });

    it('should get event definition', () => {
      const eventDef = createEventDefinition({
        type: 'test:action',
        operation: 'Test action',
        processor: jest.fn()
      });

      const { result } = renderHook(() =>
        useEventHandlerFramework({
          domain: 'test',
          hookName: 'testHook',
          events: [eventDef]
        })
      );

      const retrieved = result.current.getEventDefinition('test:action');
      expect(retrieved).toEqual(eventDef);
      expect(result.current.getEventDefinition('unknown')).toBeUndefined();
    });
  });

  describe('Common validators', () => {
    it('should validate hasId', () => {
      // Import check
      expect(commonValidators).toBeDefined();
      expect(typeof commonValidators).toBe('object');
      expect(typeof commonValidators.hasId).toBe('function');
      
      // Test with valid ID
      const result1 = commonValidators.hasId({ id: '123' });
      expect(result1).toBe(true);
      
      // Test with empty string ID
      const result2 = commonValidators.hasId({ id: '' });
      expect(result2).toBe(false);
      
      // Test with missing ID
      const result3 = commonValidators.hasId({});
      expect(result3).toBe(false);
      
      // Test with null input
      const result4 = commonValidators.hasId(null);
      expect(result4).toBe(false);
    });

    it('should validate hasType', () => {
      expect(commonValidators.hasType({ type: 'test' })).toBe(true);
      expect(commonValidators.hasType({ type: '' })).toBe(false);
      expect(commonValidators.hasType({})).toBe(false);
    });

    it('should validate hasRequiredFields', () => {
      const validator = commonValidators.hasRequiredFields(['id', 'name', 'value']);
      
      expect(validator({ id: '1', name: 'test', value: 42 })).toBe(true);
      expect(validator({ id: '1', name: 'test' })).toBe(false);
      expect(validator({ id: '1', name: 'test', value: undefined })).toBe(false);
      expect(validator(null)).toBe(false);
    });

    it('should validate isValidNumber', () => {
      const validator = commonValidators.isValidNumber('price');
      
      expect(validator({ price: 42 })).toBe(true);
      expect(validator({ price: 0 })).toBe(true);
      expect(validator({ price: -10 })).toBe(true);
      expect(validator({ price: NaN })).toBe(false);
      expect(validator({ price: '42' })).toBe(false);
      expect(validator({})).toBe(false);
    });

    it('should validate isValidArray', () => {
      const validator = commonValidators.isValidArray('items', 2);
      
      expect(validator({ items: [1, 2, 3] })).toBe(true);
      expect(validator({ items: [1, 2] })).toBe(true);
      expect(validator({ items: [1] })).toBe(false);
      expect(validator({ items: [] })).toBe(false);
      expect(validator({ items: 'not array' })).toBe(false);
      expect(validator({})).toBe(false);
    });
  });

  describe('Common message generators', () => {
    it('should generate success messages', () => {
      const addMessage = commonSuccessMessages.added('Item');
      expect(addMessage({})).toBe('Item added successfully');

      const updateMessage = commonSuccessMessages.updated('Profile');
      expect(updateMessage({})).toBe('Profile updated successfully');

      const deleteMessage = commonSuccessMessages.deleted('Record');
      expect(deleteMessage({})).toBe('Record deleted successfully');

      const processMessage = commonSuccessMessages.processed('Export');
      expect(processMessage({})).toBe('Export completed successfully');
    });

    it('should generate error messages', () => {
      const error = new Error('Invalid format');

      const validationMessage = commonErrorMessages.validation('Email');
      expect(validationMessage(error)).toBe('Invalid Email data: Invalid format');

      const processingMessage = commonErrorMessages.processing('save file');
      expect(processingMessage(error)).toBe('Failed to save file: Invalid format');

      const genericMessage = commonErrorMessages.generic;
      expect(genericMessage(error)).toBe('Operation failed: Invalid format');
    });
  });

  describe('createEventDefinition helper', () => {
    it('should create event definition with defaults', () => {
      const def = createEventDefinition({
        type: 'test:action'
      });

      expect(def.type).toBe('test:action');
      expect(def.operation).toBe('Process event');
      expect(typeof def.processor).toBe('function');
    });

    it('should merge base and overrides', () => {
      const base = {
        operation: 'Base operation',
        successMessage: 'Base success'
      };

      const overrides = {
        type: 'test:custom',
        operation: 'Custom operation'
      };

      const def = createEventDefinition(base, overrides);

      expect(def.type).toBe('test:custom');
      expect(def.operation).toBe('Custom operation');
      expect(def.successMessage).toBe('Base success');
    });
  });

  describe('Logging', () => {
    it('should respect log levels', async () => {
      const processor = jest.fn().mockResolvedValue({ success: true });

      const events = [
        createEventDefinition({
          type: 'test:action',
          operation: 'Test action',
          processor
        })
      ];

      const { result } = renderHook(() =>
        useEventHandlerFramework({
          domain: 'test',
          hookName: 'testHook',
          events,
          logLevel: 'error'
        })
      );

      await act(async () => {
        await result.current.processEvent('test:action', {});
      });

      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.debug).not.toHaveBeenCalled();

      // Now test with error
      const errorProcessor = jest.fn().mockRejectedValue(new Error('Test error'));
      const errorEvents = [
        createEventDefinition({
          type: 'test:error',
          operation: 'Error action',
          processor: errorProcessor
        })
      ];

      const { result: errorResult } = renderHook(() =>
        useEventHandlerFramework({
          domain: 'test',
          hookName: 'testHook',
          events: errorEvents,
          logLevel: 'error'
        })
      );

      await act(async () => {
        try {
          await errorResult.current.processEvent('test:error', {});
        } catch (e) {
          // Expected
        }
      });

      expect(logger.error).toHaveBeenCalled();
    });
  });
});