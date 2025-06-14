import { z } from 'zod';
import { 
  safeParseOrWarn, 
  safeParseOrError, 
  validateWithCallbacks,
  CommonSchemas 
} from '../validation';
import { logger } from '../logger';

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

describe('validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('safeParseOrWarn', () => {
    const testSchema = z.object({
      name: z.string(),
      age: z.number().positive(),
    });

    it('should return parsed data for valid input', () => {
      const validData = { name: 'John', age: 25 };
      const result = safeParseOrWarn(testSchema, validData, 'TestContext');

      expect(result).toEqual(validData);
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should return null and log warning for invalid input', () => {
      const invalidData = { name: 'John', age: -5 };
      const result = safeParseOrWarn(testSchema, invalidData, 'TestContext');

      expect(result).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(
        '[TestContext] Validation failed',
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              path: ['age'],
              message: expect.stringContaining('greater than 0')
            })
          ]),
          dataType: 'object',
          dataPreview: expect.any(String)
        })
      );
    });

    it('should handle missing fields', () => {
      const incompleteData = { name: 'John' };
      const result = safeParseOrWarn(testSchema, incompleteData, 'TestContext');

      expect(result).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(
        '[TestContext] Validation failed',
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              path: ['age'],
              code: 'invalid_type'
            })
          ])
        })
      );
    });

    it('should truncate long data in preview', () => {
      const longData = { 
        name: 'a'.repeat(300), 
        age: 25 
      };
      safeParseOrWarn(testSchema, longData, 'TestContext');

      expect(logger.info).not.toHaveBeenCalled(); // Valid data
    });

    it('should handle null input', () => {
      const result = safeParseOrWarn(testSchema, null, 'TestContext');

      expect(result).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(
        '[TestContext] Validation failed',
        expect.objectContaining({
          dataType: 'object',
          dataPreview: 'null'
        })
      );
    });

    it('should handle undefined input', () => {
      const result = safeParseOrWarn(testSchema, undefined, 'TestContext');

      expect(result).toBeNull();
      expect(logger.info).toHaveBeenCalled();
    });
  });

  describe('safeParseOrError', () => {
    const criticalSchema = z.object({
      apiKey: z.string().min(10),
      endpoint: z.string().url(),
    });

    it('should return parsed data for valid input', () => {
      const validData = {
        apiKey: 'test-api-key-123',
        endpoint: 'https://api.example.com'
      };
      const result = safeParseOrError(criticalSchema, validData, 'CriticalValidation');

      expect(result).toEqual(validData);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should return null and log error for invalid input', () => {
      const invalidData = {
        apiKey: 'short',
        endpoint: 'not-a-url'
      };
      const result = safeParseOrError(criticalSchema, invalidData, 'CriticalValidation');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        '[CriticalValidation] Critical validation failed',
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              path: ['apiKey'],
              message: expect.stringContaining('at least 10')
            }),
            expect.objectContaining({
              path: ['endpoint'],
              message: expect.stringContaining('Invalid url')
            })
          ])
        })
      );
    });
  });

  describe('validateWithCallbacks', () => {
    const callbackSchema = z.object({
      username: z.string().min(3),
      email: z.string().email(),
    });

    it('should call onSuccess for valid data', () => {
      const onSuccess = jest.fn();
      const onFailure = jest.fn();
      const validData = {
        username: 'john_doe',
        email: 'john@example.com'
      };

      const result = validateWithCallbacks(
        callbackSchema,
        validData,
        {
          context: 'UserRegistration',
          onSuccess,
          onFailure
        }
      );

      expect(result).toEqual(validData);
      expect(onSuccess).toHaveBeenCalledWith(validData);
      expect(onFailure).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should call onFailure for invalid data', () => {
      const onSuccess = jest.fn();
      const onFailure = jest.fn();
      const invalidData = {
        username: 'ab',
        email: 'not-an-email'
      };

      const result = validateWithCallbacks(
        callbackSchema,
        invalidData,
        {
          context: 'UserRegistration',
          onSuccess,
          onFailure
        }
      );

      expect(result).toBeNull();
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onFailure).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ path: ['username'] }),
          expect.objectContaining({ path: ['email'] })
        ])
      );
      expect(logger.info).toHaveBeenCalledWith(
        '[UserRegistration] Validation failed',
        expect.any(Object)
      );
    });

    it('should use custom log level', () => {
      const invalidData = { username: 'ab', email: 'bad' };

      validateWithCallbacks(
        callbackSchema,
        invalidData,
        {
          context: 'CriticalValidation',
          logLevel: 'error'
        }
      );

      expect(logger.error).toHaveBeenCalledWith(
        '[CriticalValidation] Validation failed',
        expect.any(Object)
      );
      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should handle missing callbacks gracefully', () => {
      const validData = {
        username: 'john_doe',
        email: 'john@example.com'
      };

      const result = validateWithCallbacks(
        callbackSchema,
        validData,
        { context: 'NoCallbacks' }
      );

      expect(result).toEqual(validData);
      expect(() => result).not.toThrow();
    });

    it('should handle validation errors in callbacks', () => {
      const onFailure = jest.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      const invalidData = { username: 'ab', email: 'bad' };

      expect(() => {
        validateWithCallbacks(
          callbackSchema,
          invalidData,
          {
            context: 'ErrorInCallback',
            onFailure
          }
        );
      }).toThrow('Callback error');
    });
  });

  describe('CommonSchemas', () => {
    describe('NonEmptyString', () => {
      it('should validate non-empty strings', () => {
        expect(CommonSchemas.NonEmptyString.parse('hello')).toBe('hello');
        expect(() => CommonSchemas.NonEmptyString.parse('')).toThrow();
        expect(() => CommonSchemas.NonEmptyString.parse(123)).toThrow();
      });
    });

    describe('ChatMessage', () => {
      it('should validate chat messages within limits', () => {
        const validMessage = 'Hello, this is a valid message';
        expect(CommonSchemas.ChatMessage.parse(validMessage)).toBe(validMessage);
        
        const longMessage = 'a'.repeat(501);
        expect(() => CommonSchemas.ChatMessage.parse(longMessage)).toThrow();
        
        expect(() => CommonSchemas.ChatMessage.parse('')).toThrow();
      });
    });

    describe('PositiveNumber', () => {
      it('should validate positive numbers', () => {
        expect(CommonSchemas.PositiveNumber.parse(1)).toBe(1);
        expect(CommonSchemas.PositiveNumber.parse(0.1)).toBe(0.1);
        expect(() => CommonSchemas.PositiveNumber.parse(0)).toThrow();
        expect(() => CommonSchemas.PositiveNumber.parse(-1)).toThrow();
        expect(() => CommonSchemas.PositiveNumber.parse('1')).toThrow();
      });
    });

    describe('Url', () => {
      it('should validate URLs', () => {
        expect(CommonSchemas.Url.parse('https://example.com')).toBe('https://example.com');
        expect(CommonSchemas.Url.parse('http://localhost:3000')).toBe('http://localhost:3000');
        expect(() => CommonSchemas.Url.parse('not-a-url')).toThrow();
        expect(() => CommonSchemas.Url.parse('example.com')).toThrow();
      });
    });

    describe('Email', () => {
      it('should validate email addresses', () => {
        expect(CommonSchemas.Email.parse('user@example.com')).toBe('user@example.com');
        expect(CommonSchemas.Email.parse('test.user+tag@example.co.uk')).toBe('test.user+tag@example.co.uk');
        expect(() => CommonSchemas.Email.parse('not-an-email')).toThrow();
        expect(() => CommonSchemas.Email.parse('@example.com')).toThrow();
      });
    });

    describe('BooleanToggle', () => {
      it('should validate boolean values', () => {
        expect(CommonSchemas.BooleanToggle.parse(true)).toBe(true);
        expect(CommonSchemas.BooleanToggle.parse(false)).toBe(false);
        expect(() => CommonSchemas.BooleanToggle.parse('true')).toThrow();
        expect(() => CommonSchemas.BooleanToggle.parse(1)).toThrow();
      });
    });

    describe('IndicatorKey', () => {
      it('should validate indicator keys', () => {
        expect(CommonSchemas.IndicatorKey.parse('ma')).toBe('ma');
        expect(CommonSchemas.IndicatorKey.parse('rsi')).toBe('rsi');
        expect(CommonSchemas.IndicatorKey.parse('macd')).toBe('macd');
        expect(CommonSchemas.IndicatorKey.parse('boll')).toBe('boll');
        expect(() => CommonSchemas.IndicatorKey.parse('invalid')).toThrow();
      });
    });

    describe('IndicatorToggle', () => {
      it('should validate indicator toggle objects', () => {
        const valid = { key: 'ma', value: true };
        expect(CommonSchemas.IndicatorToggle.parse(valid)).toEqual(valid);
        
        const valid2 = { key: 'rsi', value: false };
        expect(CommonSchemas.IndicatorToggle.parse(valid2)).toEqual(valid2);
        
        expect(() => CommonSchemas.IndicatorToggle.parse({ key: 'invalid', value: true })).toThrow();
        expect(() => CommonSchemas.IndicatorToggle.parse({ key: 'ma', value: 'true' })).toThrow();
        expect(() => CommonSchemas.IndicatorToggle.parse({ key: 'ma' })).toThrow();
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle circular references in data preview', () => {
      const circular: any = { name: 123 }; // Invalid type to force failure
      circular.self = circular;

      const schema = z.object({ 
        name: z.string()
      });
      
      safeParseOrWarn(schema, circular, 'CircularTest');

      expect(logger.info).toHaveBeenCalledWith(
        '[CircularTest] Validation failed',
        expect.objectContaining({
          dataPreview: '[Circular or non-serializable]'
        })
      );
    });

    it('should handle very large objects', () => {
      const largeObject = {
        data: Array(1000).fill({ id: 1, name: 'test', value: 123.45 })
      };

      const schema = z.object({
        data: z.array(z.object({
          id: z.number(),
          name: z.string(),
          value: z.number()
        }))
      });

      const result = safeParseOrWarn(schema, largeObject, 'LargeObjectTest');
      expect(result).toEqual(largeObject);
    });
  });
});