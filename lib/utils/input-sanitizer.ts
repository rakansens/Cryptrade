import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';

/**
 * Sanitize HTML content to prevent XSS attacks
 * Used for user-generated content that needs to support basic formatting
 */
export function sanitizeHtml(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre'],
    ALLOWED_ATTR: ['class'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input', 'button', 'link', 'style'],
    FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'href', 'src', 'style', 'on*']
  });
}

/**
 * Sanitize plain text content to prevent any script injection
 * Used for user inputs that should not contain HTML
 */
export function sanitizeText(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
  });
}

/**
 * Validation schema for chat messages
 */
export const ChatMessageSchema = z.object({
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message too long')
    .refine(val => {
      // Check for dangerous patterns
      const dangerousPatterns = [
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
        /data:text\/html/gi,
        /vbscript:/gi,
        /on\w+\s*=/gi,
        /eval\s*\(/gi,
        /expression\s*\(/gi,
        /document\.(cookie|domain|location)/gi,
        /window\.(location|open)/gi,
      ];
      
      return !dangerousPatterns.some(pattern => pattern.test(val));
    }, 'Message contains prohibited content'),
  sessionId: z.string()
    .min(1, 'Session ID is required')
    .max(100, 'Session ID too long')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Invalid session ID format'),
});

/**
 * Validation schema for symbol names (cryptocurrency pairs)
 */
export const SymbolSchema = z.string()
  .min(3, 'Symbol must be at least 3 characters')
  .max(15, 'Symbol must be at most 15 characters')
  .regex(/^[A-Z]{3,10}(USDT?|BTC|ETH|BNB|ADA|DOT|SOL)?$/i, 'Invalid cryptocurrency symbol format')
  .transform(val => val.toUpperCase());

/**
 * Validation schema for price values
 */
export const PriceSchema = z.number()
  .positive('Price must be positive')
  .finite('Price must be a finite number')
  .max(10000000, 'Price too high')
  .refine(val => !isNaN(val), 'Price must be a valid number');

/**
 * Validation schema for user IDs
 */
export const UserIdSchema = z.string()
  .min(1, 'User ID is required')
  .max(100, 'User ID too long')
  .regex(/^[a-zA-Z0-9-_]+$/, 'Invalid user ID format');

/**
 * Rate limiting validation - check if content appears to be spam
 */
export function validateNotSpam(content: string): boolean {
  // Check for excessive repetition
  const words = content.split(/\s+/);
  const uniqueWords = new Set(words);
  const repetitionRatio = uniqueWords.size / words.length;
  
  if (words.length > 20 && repetitionRatio < 0.3) {
    return false; // Too much repetition
  }
  
  // Check for excessive capitalization
  const uppercaseRatio = (content.match(/[A-Z]/g) || []).length / content.length;
  if (uppercaseRatio > 0.7 && content.length > 50) {
    return false; // Too much CAPS
  }
  
  // Check for excessive special characters
  const specialCharRatio = (content.match(/[!@#$%^&*()_+={}\[\]|\\:";'<>?,./]/g) || []).length / content.length;
  if (specialCharRatio > 0.3) {
    return false; // Too many special characters
  }
  
  return true;
}

/**
 * Comprehensive input validation for API endpoints
 */
export function validateApiInput<T>(
  data: unknown, 
  schema: z.ZodSchema<T>,
  options: { 
    sanitizeStrings?: boolean; 
    checkSpam?: boolean; 
  } = {}
): { success: true; data: T } | { success: false; error: string } {
  try {
    // Pre-validation sanitization if requested
    if (options.sanitizeStrings && typeof data === 'object' && data !== null) {
      data = sanitizeObjectStrings(data);
    }
    
    const validated = schema.parse(data);
    
    // Spam check if requested
    if (options.checkSpam && typeof validated === 'object' && validated !== null) {
      const stringFields = extractStringFields(validated);
      for (const field of stringFields) {
        if (!validateNotSpam(field)) {
          return { success: false, error: 'Content appears to be spam' };
        }
      }
    }
    
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || 'Validation error' };
    }
    return { success: false, error: 'Validation failed' };
  }
}

/**
 * Helper function to sanitize all string fields in an object
 */
function sanitizeObjectStrings(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return sanitizeText(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObjectStrings);
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObjectStrings(value);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Helper function to extract all string fields from an object for spam checking
 */
function extractStringFields(obj: unknown): string[] {
  const strings: string[] = [];
  
  if (typeof obj === 'string') {
    strings.push(obj);
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      strings.push(...extractStringFields(item));
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const value of Object.values(obj)) {
      strings.push(...extractStringFields(value));
    }
  }
  
  return strings;
}