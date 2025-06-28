/**
 * Event Handler Framework
 * 
 * Unified framework for handling UI events across different domains
 * Consolidates patterns from chart, UI, and other event handlers
 */

import { useCallback, useEffect, useRef } from 'react';
import { logger } from '@/lib/utils/logger';
import { useEventHandlerBase, type EventProcessor } from './useEventHandlerBase';
import { showToast } from '@/lib/notifications/toast';

export interface EventHandlerFrameworkConfig<T = any> {
  // Basic configuration
  domain: string; // 'chart', 'ui', 'chat', etc.
  hookName: string;
  
  // Event definitions
  events: EventDefinition<T>[];
  
  // Global handlers
  onSuccess?: (eventType: string, data: T) => void;
  onError?: (eventType: string, error: Error, data?: T) => void;
  
  // Options
  enableNotifications?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface EventDefinition<T = any> {
  // Event identification
  type: string; // e.g., 'chart:addDrawing'
  operation: string; // Human-readable operation name
  
  // Processing
  validate?: (data: T) => boolean | Promise<boolean>;
  processor: EventProcessor<T>;
  
  // Messaging
  successMessage?: string | ((data: T) => string);
  errorMessage?: string | ((error: Error, data?: T) => string);
  
  // Options
  async?: boolean;
  timeout?: number;
  retryCount?: number;
  notificationLevel?: 'success' | 'info' | 'warning' | 'error';
}

export interface EventHandlerFrameworkReturn {
  // State
  isProcessing: boolean;
  lastProcessedEvent: string | null;
  processingErrors: Map<string, Error>;
  
  // Actions
  processEvent: (eventType: string, data: any) => Promise<void>;
  clearErrors: () => void;
  
  // Utilities
  getEventDefinition: (eventType: string) => EventDefinition | undefined;
  isEventSupported: (eventType: string) => boolean;
}

/**
 * Unified event handler framework
 */
export function useEventHandlerFramework<T = any>(
  config: EventHandlerFrameworkConfig<T>
): EventHandlerFrameworkReturn {
  const {
    domain,
    hookName,
    events,
    onSuccess,
    onError,
    enableNotifications = true,
    logLevel = 'info',
  } = config;

  // State
  const isProcessingRef = useRef(false);
  const lastProcessedEventRef = useRef<string | null>(null);
  const processingErrorsRef = useRef<Map<string, Error>>(new Map());
  const eventMapRef = useRef<Map<string, EventDefinition<T>>>(new Map());

  // Build event map
  useEffect(() => {
    eventMapRef.current.clear();
    events.forEach(event => {
      eventMapRef.current.set(event.type, event);
    });
  }, [events]);

  // Safe logging
  const safeLog = useCallback((level: typeof logLevel, message: string, data?: any) => {
    const shouldLog = level === 'error' || 
      (level === 'warn' && ['warn', 'info', 'debug'].includes(logLevel)) ||
      (level === 'info' && ['info', 'debug'].includes(logLevel)) ||
      (level === 'debug' && logLevel === 'debug');
    
    if (shouldLog) {
      logger[level](`[${hookName}] ${message}`, {
        domain,
        ...data,
      });
    }
  }, [hookName, domain, logLevel]);

  // Process event
  const processEvent = useCallback(async (eventType: string, data: T) => {
    const eventDef = eventMapRef.current.get(eventType);
    if (!eventDef) {
      const error = new Error(`Unsupported event type: ${eventType}`);
      safeLog('error', 'Unsupported event type', { eventType });
      processingErrorsRef.current.set(eventType, error);
      throw error;
    }

    isProcessingRef.current = true;
    lastProcessedEventRef.current = eventType;

    try {
      safeLog('info', `Processing ${eventDef.operation}`, { eventType, data });

      // Validation
      if (eventDef.validate) {
        const isValid = await Promise.resolve(eventDef.validate(data));
        if (!isValid) {
          throw new Error(`Validation failed for ${eventType}`);
        }
      }

      // Process with timeout if specified
      let result: any;
      if (eventDef.timeout) {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Processing timeout')), eventDef.timeout)
        );
        result = await Promise.race([
          eventDef.processor(data),
          timeoutPromise,
        ]);
      } else {
        result = await eventDef.processor(data);
      }

      // Success handling
      safeLog('info', `Successfully processed ${eventDef.operation}`, { eventType });
      
      // Show success notification
      if (enableNotifications && eventDef.successMessage) {
        const message = typeof eventDef.successMessage === 'function' 
          ? eventDef.successMessage(data)
          : eventDef.successMessage;
        
        showToast[eventDef.notificationLevel || 'success'](message);
      }

      // Call global success handler
      onSuccess?.(eventType, data);

      // Clear any previous errors for this event type
      processingErrorsRef.current.delete(eventType);

      return result;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      safeLog('error', `Failed to process ${eventDef.operation}`, { 
        eventType, 
        error: err.message,
        data,
      });

      // Store error
      processingErrorsRef.current.set(eventType, err);

      // Show error notification
      if (enableNotifications && eventDef.errorMessage) {
        const message = typeof eventDef.errorMessage === 'function'
          ? eventDef.errorMessage(err, data)
          : eventDef.errorMessage;
        
        showToast.error(message);
      }

      // Call global error handler
      onError?.(eventType, err, data);

      throw err;

    } finally {
      isProcessingRef.current = false;
    }
  }, [domain, hookName, enableNotifications, onSuccess, onError, safeLog]);

  // Create event listeners configuration for base hook
  const eventListeners = useCallback(() => {
    return events.map(eventDef => ({
      eventType: eventDef.type,
      processor: eventDef.processor,
    }));
  }, [events]);

  // Create operations and success messages for base hook
  const operations = useCallback(() => {
    const ops: Record<string, string> = {};
    events.forEach(event => {
      ops[event.type] = event.operation;
    });
    return ops;
  }, [events]);

  const successMessages = useCallback(() => {
    const messages: Record<string, (data: any) => string> = {};
    events.forEach(event => {
      if (event.successMessage) {
        messages[event.type] = typeof event.successMessage === 'function'
          ? event.successMessage
          : () => event.successMessage as string;
      }
    });
    return messages;
  }, [events]);

  // Use base event handler
  useEventHandlerBase(
    {
      operations: operations(),
      successMessages: successMessages(),
      validator: (eventType: string, data: any) => {
        const eventDef = eventMapRef.current.get(eventType);
        if (!eventDef) return false;
        if (!eventDef.validate) return true;
        return eventDef.validate(data);
      },
    },
    eventListeners(),
    [] // Dependencies handled internally
  );

  // Utility functions
  const clearErrors = useCallback(() => {
    processingErrorsRef.current.clear();
    safeLog('debug', 'Cleared all processing errors');
  }, [safeLog]);

  const getEventDefinition = useCallback((eventType: string) => {
    return eventMapRef.current.get(eventType);
  }, []);

  const isEventSupported = useCallback((eventType: string) => {
    return eventMapRef.current.has(eventType);
  }, []);

  return {
    // State
    isProcessing: isProcessingRef.current,
    lastProcessedEvent: lastProcessedEventRef.current,
    processingErrors: processingErrorsRef.current,
    
    // Actions
    processEvent,
    clearErrors,
    
    // Utilities
    getEventDefinition,
    isEventSupported,
  };
}

/**
 * Helper to create event definitions with common patterns
 */
export function createEventDefinition<T = any>(
  base: Partial<EventDefinition<T>>,
  overrides?: Partial<EventDefinition<T>>
): EventDefinition<T> {
  return {
    type: '',
    operation: 'Process event',
    processor: () => Promise.resolve(),
    ...base,
    ...overrides,
  } as EventDefinition<T>;
}

/**
 * Common event validators
 */
export const commonValidators = {
  hasId: (data: any): boolean => {
    return data && typeof data.id === 'string' && data.id.length > 0;
  },
  
  hasType: (data: any): boolean => {
    return data && typeof data.type === 'string' && data.type.length > 0;
  },
  
  hasRequiredFields: (fields: string[]) => (data: any): boolean => {
    if (!data || typeof data !== 'object') return false;
    return fields.every(field => field in data && data[field] !== undefined);
  },
  
  isValidNumber: (field: string) => (data: any): boolean => {
    return data && typeof data[field] === 'number' && !isNaN(data[field]);
  },
  
  isValidArray: (field: string, minLength = 0) => (data: any): boolean => {
    return data && Array.isArray(data[field]) && data[field].length >= minLength;
  },
};

/**
 * Common success message generators
 */
export const commonSuccessMessages = {
  added: (type: string) => (data: any) => `${type} added successfully`,
  updated: (type: string) => (data: any) => `${type} updated successfully`,
  deleted: (type: string) => (data: any) => `${type} deleted successfully`,
  processed: (action: string) => (data: any) => `${action} completed successfully`,
};

/**
 * Common error message generators
 */
export const commonErrorMessages = {
  validation: (type: string) => (error: Error) => `Invalid ${type} data: ${error.message}`,
  processing: (action: string) => (error: Error) => `Failed to ${action}: ${error.message}`,
  generic: (error: Error) => `Operation failed: ${error.message}`,
};