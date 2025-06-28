import { useEffect } from 'react';
import { handleAgentError } from '@/lib/mastra/agents/utils/agent-utils';
import { showAgentSuccess, handleValidationError } from '@/lib/chart/agent-utils';
import { logger } from '@/lib/utils/logger';

/**
 * Event Handler Configuration
 */
export interface EventHandlerConfig<T = any> {
  /** Event type to operation name mapping */
  getOperation: (eventType: string) => string;
  /** Generate success message */
  getSuccessMessage: (eventType: string, data: T) => string;
  /** Validation function */
  validator: (eventType: string, detail: any) => { success: boolean; data?: any; error?: any };
  /** Optional error context provider */
  getErrorContext?: (eventType: string, data: T) => Record<string, any>;
}

/**
 * Event Handler Function Type
 */
export type EventHandler = (event: CustomEvent) => void | Promise<void>;

/**
 * Event Processor Function Type
 */
export type EventProcessor<T = any> = (data: T) => void | Promise<void>;

/**
 * Event Listener Configuration
 */
export interface EventListenerConfig {
  eventType: string;
  processor: EventProcessor<any>;
}

/**
 * Base Event Handler Hook
 * 
 * Provides common event handling patterns:
 * - Validation
 * - Error handling
 * - Success notification
 * - Logging
 * - Event listener registration/cleanup
 */
export function useEventHandlerBase<T = any>(
  config: EventHandlerConfig<T>,
  eventListeners: EventListenerConfig[],
  dependencies: any[] = []
) {
  /**
   * Create standardized event handler
   */
  const createHandler = (
    eventType: string, 
    processor: EventProcessor<any>
  ): EventHandler => {
    return async (event: CustomEvent) => {
      // Validation phase
      const validation = config.validator(eventType, event.detail);
      if (!validation.success) {
        handleValidationError(validation as { success: false; error: unknown }, {
          eventType,
          operation: config.getOperation(eventType),
          payload: event.detail,
        });
        return;
      }

      const data = validation.data?.data as any;
      logger.info(`[Event] Handling ${eventType}`, { 
        eventType, 
        operation: config.getOperation(eventType),
        data: typeof data === 'object' ? data : { value: data }
      });
      
      // Execution phase
      try {
        await processor(data);
        
        showAgentSuccess({
          eventType,
          operation: config.getOperation(eventType),
        }, config.getSuccessMessage(eventType, data));
      } catch (error) {
        const errorContext = config.getErrorContext?.(eventType, data) || {};
        handleAgentError(error, {
          eventType,
          operation: config.getOperation(eventType),
          payload: data,
          ...errorContext,
        });
      }
    };
  };

  /**
   * Register event listeners with cleanup
   */
  useEffect(() => {
    // Create handlers
    const handlers = eventListeners.map(({ eventType, processor }) => ({
      eventType,
      handler: createHandler(eventType, processor)
    }));

    // Register event listeners
    handlers.forEach(({ eventType, handler }) => {
      window.addEventListener(eventType, handler as EventListener);
    });

    logger.info('[Event Handler Base] Registered event listeners', {
      eventCount: handlers.length,
      events: handlers.map(({ eventType }) => eventType),
    });

    // Cleanup function
    return () => {
      handlers.forEach(({ eventType, handler }) => {
        window.removeEventListener(eventType, handler as EventListener);
      });
      logger.info('[Event Handler Base] Cleaned up event listeners');
    };
  }, dependencies);

  return {
    createHandler,
  };
}

/**
 * Helper for creating common event handler configurations
 */
export const createEventHandlerConfig = <T>(
  operations: Record<string, string>,
  successMessages: Record<string, (data: T) => string>,
  validator: EventHandlerConfig<T>['validator'],
  errorContextProvider?: EventHandlerConfig<T>['getErrorContext']
): EventHandlerConfig<T> => ({
  getOperation: (eventType: string) => operations[eventType] || 'Unknown operation',
  getSuccessMessage: (eventType: string, data: T) => {
    const messageGen = successMessages[eventType];
    return messageGen ? messageGen(data) : `${eventType} completed`;
  },
  validator,
  getErrorContext: errorContextProvider,
});

/**
 * Helper for creating event listener configurations
 */
export const createEventListeners = (
  configs: Array<{ eventType: string; processor: EventProcessor<any> }>
): EventListenerConfig[] => configs;