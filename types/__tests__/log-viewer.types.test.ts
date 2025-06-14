// Jest is configured globally, no imports needed
import type { LogEntry, LogFilters, LogPagination, LogExportOptions } from '../log-viewer.types';
import { isLogEntry, formatLogError } from '../log-viewer.types';

describe('log-viewer.types', () => {
  describe('isLogEntry', () => {
    it('should return true for valid LogEntry', () => {
      const validEntry: LogEntry = {
        id: 'test-id',
        timestamp: Date.now(),
        level: 'info',
        message: 'Test message'
      };

      expect(isLogEntry(validEntry)).toBe(true);
    });

    it('should return true for LogEntry with optional fields', () => {
      const validEntry: LogEntry = {
        id: 'test-id',
        timestamp: Date.now(),
        level: 'error',
        message: 'Test error',
        component: 'TestComponent',
        context: { key: 'value' },
        error: new Error('Test error')
      };

      expect(isLogEntry(validEntry)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isLogEntry(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isLogEntry(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isLogEntry('string')).toBe(false);
      expect(isLogEntry(123)).toBe(false);
      expect(isLogEntry(true)).toBe(false);
      expect(isLogEntry([])).toBe(false);
    });

    it('should return false for object missing required fields', () => {
      expect(isLogEntry({})).toBe(false);
      expect(isLogEntry({ id: 'test' })).toBe(false);
      expect(isLogEntry({ id: 'test', timestamp: Date.now() })).toBe(false);
      expect(isLogEntry({ id: 'test', timestamp: Date.now(), level: 'info' })).toBe(false);
    });

    it('should return false for object with wrong field types', () => {
      expect(isLogEntry({
        id: 123, // should be string
        timestamp: Date.now(),
        level: 'info',
        message: 'Test'
      })).toBe(false);

      expect(isLogEntry({
        id: 'test',
        timestamp: 'not-a-number', // should be number
        level: 'info',
        message: 'Test'
      })).toBe(false);

      expect(isLogEntry({
        id: 'test',
        timestamp: Date.now(),
        level: 123, // should be string
        message: 'Test'
      })).toBe(false);

      expect(isLogEntry({
        id: 'test',
        timestamp: Date.now(),
        level: 'info',
        message: 123 // should be string
      })).toBe(false);
    });
  });

  describe('formatLogError', () => {
    it('should return string as-is', () => {
      const error = 'Simple error message';
      expect(formatLogError(error)).toBe(error);
    });

    it('should return Error message', () => {
      const error = new Error('Test error message');
      expect(formatLogError(error)).toBe('Test error message');
    });

    it('should stringify object errors', () => {
      const error = { code: 'ERR_001', message: 'Custom error' };
      expect(formatLogError(error)).toBe(JSON.stringify(error, null, 2));
    });

    it('should handle null error', () => {
      expect(formatLogError(null)).toBe('null');
    });

    it('should handle undefined error', () => {
      expect(formatLogError(undefined)).toBe('undefined');
    });

    it('should convert number to string', () => {
      expect(formatLogError(404 as any)).toBe('404');
    });

    it('should convert boolean to string', () => {
      expect(formatLogError(false as any)).toBe('false');
    });
  });

  describe('LogFilters interface', () => {
    it('should accept valid filter objects', () => {
      const filters: LogFilters = {
        level: 'error',
        component: 'TestComponent',
        search: 'error',
        startTime: Date.now() - 3600000,
        endTime: Date.now()
      };

      expect(filters).toBeDefined();
    });

    it('should accept partial filter objects', () => {
      const filters1: LogFilters = { level: 'warn' };
      const filters2: LogFilters = { search: 'test' };
      const filters3: LogFilters = {};

      expect(filters1).toBeDefined();
      expect(filters2).toBeDefined();
      expect(filters3).toBeDefined();
    });
  });

  describe('LogPagination interface', () => {
    it('should accept valid pagination objects', () => {
      const pagination: LogPagination = {
        page: 1,
        limit: 50
      };

      expect(pagination).toBeDefined();
    });
  });

  describe('LogExportOptions interface', () => {
    it('should accept valid export options', () => {
      const options1: LogExportOptions = {
        format: 'json'
      };

      const options2: LogExportOptions = {
        format: 'csv',
        filters: {
          level: 'error',
          startTime: Date.now() - 86400000,
          endTime: Date.now()
        }
      };

      expect(options1).toBeDefined();
      expect(options2).toBeDefined();
    });
  });
});