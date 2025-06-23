import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

/**
 * Generic safe parse wrapper with logging
 * @param {z.ZodSchema<T>} schema - Zod schema to validate against
 * @param {unknown} data - Data to validate
 * @param {string} context - Context string for logging (e.g., 'WebSocket', 'ChatInput')
 * @returns {T | null} Parsed data if valid, null if invalid
 */
export function safeParseOrWarn<T>(
  schema: z.ZodSchema<T>, 
  data: unknown, 
  context: string
): T | null {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    let dataPreview: string;
    try {
      dataPreview = JSON.stringify(data)?.slice(0, 200) || 'undefined';
    } catch (e) {
      dataPreview = '[Circular or non-serializable]';
    }
    
    logger.info(`[${context}] Validation failed`, {
      errors: result.error.issues,
      dataType: typeof data,
      dataPreview
    });
    return null;
  }
  
  return result.data;
}

/**
 * Safe parse with error logging for critical validations
 * @param {z.ZodSchema<T>} schema - Zod schema to validate against
 * @param {unknown} data - Data to validate
 * @param {string} context - Context string for logging
 * @returns {T | null} Parsed data if valid, null if invalid
 */
export function safeParseOrError<T>(
  schema: z.ZodSchema<T>, 
  data: unknown, 
  context: string
): T | null {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    let dataPreview: string;
    try {
      dataPreview = JSON.stringify(data)?.slice(0, 200) || 'undefined';
    } catch (e) {
      dataPreview = '[Circular or non-serializable]';
    }
    
    logger.error(`[${context}] Critical validation failed`, {
      errors: result.error.issues,
      dataType: typeof data,
      dataPreview
    });
    return null;
  }
  
  return result.data;
}

/**
 * Validate with custom success/failure callbacks
 * @param {z.ZodSchema<T>} schema - Zod schema to validate against
 * @param {unknown} data - Data to validate
 * @param {Object} options - Configuration options
 * @param {string} options.context - Context string for logging
 * @param {(data: T) => void} [options.onSuccess] - Success callback
 * @param {(errors: z.ZodIssue[]) => void} [options.onFailure] - Failure callback
 * @param {'info' | 'warn' | 'error'} [options.logLevel] - Log level
 */
export function validateWithCallbacks<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  options: {
    context: string;
    onSuccess?: (data: T) => void;
    onFailure?: (errors: z.ZodIssue[]) => void;
    logLevel?: 'info' | 'warn' | 'error';
  }
): T | null {
  const result = schema.safeParse(data);
  const logLevel = options.logLevel || 'info';
  
  if (result.success) {
    options.onSuccess?.(result.data);
    return result.data;
  } else {
    logger[logLevel](`[${options.context}] Validation failed`, {
      errors: result.error.issues
    });
    options.onFailure?.(result.error.issues);
    return null;
  }
}

/**
 * Commonly used validation schemas
 */
export const CommonSchemas = {
  NonEmptyString: z.string().min(1),
  ChatMessage: z.string().min(1).max(500),
  PositiveNumber: z.number().positive(),
  Url: z.string().url(),
  Email: z.string().email(),
  BooleanToggle: z.boolean(),
  
  // Indicator validation
  IndicatorKey: z.enum(['ma', 'rsi', 'macd', 'boll']),
  IndicatorToggle: z.object({
    key: z.enum(['ma', 'rsi', 'macd', 'boll']),
    value: z.boolean()
  })
} as const;