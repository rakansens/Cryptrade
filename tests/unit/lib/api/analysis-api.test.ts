import { AnalysisAPI } from '@/lib/api/analysis-api';
import { logger } from '@/lib/utils/logger';
import { apiCache } from '@/lib/utils/api-cache';
import { withRetry } from '@/lib/utils/retry';
import { convertDbAnalysisRecord } from '@/lib/utils/db-conversions';
import type { AnalysisRecord, TouchEvent } from '@/types/analysis-history';

// Mock dependencies
jest.mock('@/lib/utils/logger');
jest.mock('@/lib/utils/api-cache');
jest.mock('@/lib/utils/retry');
jest.mock('@/lib/utils/db-conversions');
jest.mock('@/config/env', () => ({
  env: {
    NODE_ENV: 'test'
  }
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('AnalysisAPI', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
  const mockLogger = logger as jest.Mocked<typeof logger>;
  const mockWithRetry = withRetry as jest.MockedFunction<typeof withRetry>;
  const mockConvertDbAnalysisRecord = convertDbAnalysisRecord as jest.MockedFunction<typeof convertDbAnalysisRecord>;

  // Mock apiCache methods
  const mockCacheGet = jest.fn();
  const mockCacheSet = jest.fn();
  const mockCreateKey = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup apiCache mocks
    (apiCache as any).get = mockCacheGet;
    (apiCache as any).set = mockCacheSet;
    require('@/lib/utils/api-cache').createKey = mockCreateKey;
    
    // Default mock implementations
    mockCreateKey.mockImplementation((prefix, params) => 
      `${prefix}_${Object.entries(params || {}).map(([k, v]) => `${k}:${v}`).join('_')}`
    );
    
    mockWithRetry.mockImplementation(async (fn) => fn());
    
    mockConvertDbAnalysisRecord.mockImplementation((record) => record as AnalysisRecord);
  });

  describe('saveAnalysis', () => {
    const mockAnalysisData = {
      sessionId: 'session-123',
      symbol: 'BTCUSDT',
      interval: '1h',
      type: 'support' as const,
      proposalData: {
        id: 'proposal-1',
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
      },
    };

    it('should save analysis successfully', async () => {
      const mockRecordId = 'record-123';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ recordId: mockRecordId }),
      } as Response);

      const result = await AnalysisAPI.saveAnalysis(mockAnalysisData);

      expect(mockFetch).toHaveBeenCalledWith('/api/analysis/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockAnalysisData),
      });
      expect(result).toBe(mockRecordId);
    });

    it('should handle server errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(AnalysisAPI.saveAnalysis(mockAnalysisData))
        .rejects.toThrow('Failed to save analysis: Internal Server Error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[AnalysisAPI] Failed to save analysis',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      mockFetch.mockRejectedValueOnce(networkError);

      await expect(AnalysisAPI.saveAnalysis(mockAnalysisData))
        .rejects.toThrow('Network error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[AnalysisAPI] Failed to save analysis',
        { error: networkError }
      );
    });

    it('should save analysis without optional fields', async () => {
      const minimalData = {
        symbol: 'ETHUSDT',
        interval: '5m',
        type: 'resistance' as const,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ recordId: 'record-456' }),
      } as Response);

      const result = await AnalysisAPI.saveAnalysis(minimalData);

      expect(mockFetch).toHaveBeenCalledWith('/api/analysis/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(minimalData),
      });
      expect(result).toBe('record-456');
    });
  });

  describe('recordTouchEvent', () => {
    const mockRecordId = 'record-123';
    const mockTouchEvent: Omit<TouchEvent, 'id' | 'timestamp'> = {
      price: 45000,
      type: 'approach',
      distance: 50,
      direction: 'above',
    };

    it('should record touch event successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await AnalysisAPI.recordTouchEvent(mockRecordId, mockTouchEvent);

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/analysis/records/${mockRecordId}/touch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mockTouchEvent),
        }
      );
    });

    it('should handle touch event errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
      } as Response);

      await expect(
        AnalysisAPI.recordTouchEvent(mockRecordId, mockTouchEvent)
      ).rejects.toThrow('Failed to record touch event: Bad Request');

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[AnalysisAPI] Failed to record touch event',
        expect.objectContaining({
          error: expect.any(Error),
          recordId: mockRecordId,
        })
      );
    });
  });

  describe('getSessionAnalyses', () => {
    const mockSessionId = 'session-123';
    const mockRecords: AnalysisRecord[] = [
      {
        id: 'record-1',
        sessionId: mockSessionId,
        symbol: 'BTCUSDT',
        interval: '1h',
        type: 'support',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        touchEvents: [],
      },
    ];

    it('should return cached data if available', async () => {
      mockCacheGet.mockReturnValueOnce(mockRecords);
      mockCreateKey.mockReturnValueOnce('analysis_session_sessionId:session-123');

      const result = await AnalysisAPI.getSessionAnalyses(mockSessionId);

      expect(result).toEqual(mockRecords);
      expect(mockCacheGet).toHaveBeenCalledWith(
        'analysis_session_sessionId:session-123',
        { ttl: 120000, useLocalStorage: true }
      );
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[AnalysisAPI] Returning cached session analyses',
        { sessionId: mockSessionId }
      );
    });

    it('should fetch from API when cache misses', async () => {
      mockCacheGet.mockReturnValueOnce(null);
      mockWithRetry.mockImplementationOnce(async (fn) => fn());
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records: mockRecords }),
      } as Response);

      const result = await AnalysisAPI.getSessionAnalyses(mockSessionId);

      expect(result).toEqual(mockRecords);
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/analysis/sessions/${mockSessionId}/records`
      );
      expect(mockCacheSet).toHaveBeenCalledWith(
        'analysis_session_sessionId:session-123',
        mockRecords,
        { useLocalStorage: true }
      );
    });

    it('should retry on failure', async () => {
      mockCacheGet.mockReturnValueOnce(null);
      
      let attempt = 0;
      mockWithRetry.mockImplementationOnce(async (fn, options) => {
        try {
          return await fn();
        } catch (error) {
          attempt++;
          if (options?.onRetry) {
            options.onRetry(error as Error, attempt);
          }
          throw error;
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Service Unavailable',
      } as Response);

      await expect(AnalysisAPI.getSessionAnalyses(mockSessionId))
        .rejects.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[AnalysisAPI] Retrying getSessionAnalyses',
        expect.objectContaining({
          error: expect.any(String),
          attempt: 1,
          sessionId: mockSessionId,
        })
      );
    });

    it('should use stale cache on API failure', async () => {
      mockCacheGet
        .mockReturnValueOnce(null) // First call - normal TTL
        .mockReturnValueOnce(mockRecords); // Second call - infinite TTL

      mockWithRetry.mockRejectedValueOnce(new Error('API Error'));

      const result = await AnalysisAPI.getSessionAnalyses(mockSessionId);

      expect(result).toEqual(mockRecords);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[AnalysisAPI] Using stale cache due to API failure',
        { sessionId: mockSessionId }
      );
    });

    it('should return empty array in development mode when all fails', async () => {
      mockCacheGet.mockReturnValue(null);
      mockWithRetry.mockRejectedValueOnce(new Error('API Error'));
      
      // Mock development environment
      const originalEnv = process.env.NODE_ENV;
      (require('@/config/env').env as any).NODE_ENV = 'development';

      const result = await AnalysisAPI.getSessionAnalyses(mockSessionId);

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[AnalysisAPI] Returning empty array in development mode'
      );

      // Restore environment
      (require('@/config/env').env as any).NODE_ENV = originalEnv;
    });

    it('should throw error in production mode when all fails', async () => {
      mockCacheGet.mockReturnValue(null);
      mockWithRetry.mockRejectedValueOnce(new Error('API Error'));
      
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      (require('@/config/env').env as any).NODE_ENV = 'production';

      await expect(AnalysisAPI.getSessionAnalyses(mockSessionId))
        .rejects.toThrow(`Failed to get session analyses for ${mockSessionId}: API Error`);

      // Restore environment
      (require('@/config/env').env as any).NODE_ENV = originalEnv;
    });
  });

  describe('getActiveAnalyses', () => {
    const mockRecords: AnalysisRecord[] = [
      {
        id: 'record-1',
        sessionId: 'session-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        type: 'pattern',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        touchEvents: [],
      },
    ];

    it('should fetch all active analyses without symbol filter', async () => {
      mockCacheGet.mockReturnValueOnce(null);
      mockWithRetry.mockImplementationOnce(async (fn) => fn());
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records: mockRecords }),
      } as Response);

      const result = await AnalysisAPI.getActiveAnalyses();

      expect(result).toEqual(mockRecords);
      expect(mockFetch).toHaveBeenCalledWith('/api/analysis/active');
      expect(mockCreateKey).toHaveBeenCalledWith('analysis_active', { symbol: 'all' });
    });

    it('should fetch active analyses with symbol filter', async () => {
      const symbol = 'BTCUSDT';
      mockCacheGet.mockReturnValueOnce(null);
      mockWithRetry.mockImplementationOnce(async (fn) => fn());
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records: mockRecords }),
      } as Response);

      const result = await AnalysisAPI.getActiveAnalyses(symbol);

      expect(result).toEqual(mockRecords);
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/analysis/active?symbol=${encodeURIComponent(symbol)}`
      );
      expect(mockCreateKey).toHaveBeenCalledWith('analysis_active', { symbol });
    });

    it('should handle special characters in symbol', async () => {
      const symbol = 'BTC/USDT';
      mockCacheGet.mockReturnValueOnce(null);
      mockWithRetry.mockImplementationOnce(async (fn) => fn());
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records: [] }),
      } as Response);

      await AnalysisAPI.getActiveAnalyses(symbol);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/analysis/active?symbol=BTC%2FUSDT'
      );
    });

    it('should cache results with shorter TTL than session analyses', async () => {
      mockCacheGet.mockReturnValueOnce(null);
      mockWithRetry.mockImplementationOnce(async (fn) => fn());
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records: mockRecords }),
      } as Response);

      await AnalysisAPI.getActiveAnalyses();

      expect(mockCacheGet).toHaveBeenCalledWith(
        expect.any(String),
        { ttl: 60000, useLocalStorage: true } // 1 minute TTL
      );
    });
  });

  describe('updateAnalysis', () => {
    const mockRecordId = 'record-123';
    const mockUpdates: Partial<AnalysisRecord> = {
      isActive: false,
      trackingData: {
        accuracy: 0.95,
        touchCount: 5,
        lastTouchAt: new Date().toISOString(),
      },
    };

    it('should update analysis successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await AnalysisAPI.updateAnalysis(mockRecordId, mockUpdates);

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/analysis/records/${mockRecordId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mockUpdates),
        }
      );
    });

    it('should handle update errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      } as Response);

      await expect(
        AnalysisAPI.updateAnalysis(mockRecordId, mockUpdates)
      ).rejects.toThrow('Failed to update analysis: Not Found');

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[AnalysisAPI] Failed to update analysis',
        expect.objectContaining({
          error: expect.any(Error),
          recordId: mockRecordId,
        })
      );
    });

    it('should handle empty updates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await AnalysisAPI.updateAnalysis(mockRecordId, {});

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/analysis/records/${mockRecordId}`,
        expect.objectContaining({
          body: JSON.stringify({}),
        })
      );
    });
  });

  describe('convertToAnalysisRecord', () => {
    it('should convert DB record to client format', () => {
      const mockDbRecord = {
        id: 'record-123',
        session_id: 'session-123',
        symbol: 'BTCUSDT',
        interval: '1h',
        type: 'support',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_active: true,
        touch_events: [],
      };

      const mockConvertedRecord: AnalysisRecord = {
        id: 'record-123',
        sessionId: 'session-123',
        symbol: 'BTCUSDT',
        interval: '1h',
        type: 'support',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isActive: true,
        touchEvents: [],
      };

      mockConvertDbAnalysisRecord.mockReturnValueOnce(mockConvertedRecord);

      const result = AnalysisAPI.convertToAnalysisRecord(mockDbRecord);

      expect(result).toEqual(mockConvertedRecord);
      expect(mockConvertDbAnalysisRecord).toHaveBeenCalledWith(mockDbRecord);
    });
  });

  describe('error handling', () => {
    it('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as Response);

      await expect(
        AnalysisAPI.saveAnalysis({ symbol: 'BTC', interval: '1h', type: 'support' })
      ).rejects.toThrow('Invalid JSON');
    });

    it('should handle timeout errors', async () => {
      mockCacheGet.mockReturnValueOnce(null);
      mockWithRetry.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(
        AnalysisAPI.getSessionAnalyses('session-123')
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[AnalysisAPI] Failed to get session analyses after retries',
        expect.objectContaining({
          error: expect.any(Error),
          sessionId: 'session-123',
        })
      );
    });
  });

  describe('concurrent requests', () => {
    it('should handle concurrent save requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        symbol: `SYMBOL${i}`,
        interval: '1h',
        type: 'support' as const,
      }));

      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: async () => ({ recordId: `record-${Math.random()}` }),
      } as Response));

      const results = await Promise.all(
        requests.map(data => AnalysisAPI.saveAnalysis(data))
      );

      expect(results).toHaveLength(5);
      expect(mockFetch).toHaveBeenCalledTimes(5);
      results.forEach(result => {
        expect(result).toMatch(/^record-/);
      });
    });

    it('should handle concurrent fetch requests with caching', async () => {
      const sessionId = 'session-123';
      const mockRecords: AnalysisRecord[] = [];

      // First request should hit API
      mockCacheGet.mockReturnValueOnce(null);
      // Subsequent requests should hit cache
      mockCacheGet.mockReturnValue(mockRecords);

      mockWithRetry.mockImplementationOnce(async (fn) => fn());
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records: mockRecords }),
      } as Response);

      const results = await Promise.all([
        AnalysisAPI.getSessionAnalyses(sessionId),
        AnalysisAPI.getSessionAnalyses(sessionId),
        AnalysisAPI.getSessionAnalyses(sessionId),
      ]);

      expect(results).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only one API call
      results.forEach(result => {
        expect(result).toEqual(mockRecords);
      });
    });
  });
});