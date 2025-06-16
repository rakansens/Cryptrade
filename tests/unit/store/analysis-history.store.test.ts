/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import useAnalysisHistoryBase, { useAnalysisActions } from '@/store/analysis-history.store';
import { AnalysisAPI } from '@/lib/api/analysis-api';
import { withRetry } from '@/lib/utils/retry';

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

afterEach(() => {
  jest.clearAllMocks();
});

jest.mock('@/lib/utils/retry', () => ({
  withRetry: jest.fn((fn: any) => fn())
}));

const mockRecord = () => ({
  id: 'rec1',
  proposalId: 'prop1',
  sessionId: 'sess1',
  timestamp: Date.now(),
  symbol: 'BTCUSDT',
  interval: '1h',
  type: 'support' as const,
  proposal: {
    confidence: 0.8,
    drawingData: {} as any,
  },
  tracking: {
    status: 'active' as const,
    startTime: Date.now(),
    touches: [] as any[],
  },
  dbMeta: { version: 1, synced: false }
});

const resetStore = () => {
  useAnalysisHistoryBase.setState({
    records: [],
    selectedRecord: null,
    filter: 'all',
    sortBy: 'timestamp',
    sortOrder: 'desc',
    performanceMetrics: null,
    lastCalculated: 0,
    isDbEnabled: true,
    isSyncing: false,
    currentSessionId: null,
  });
};

describe('AnalysisHistoryStore DB Sync', () => {
  beforeEach(() => {
    resetStore();
  });

  it('calls saveAnalysis when DB sync enabled', async () => {
    const saveSpy = jest.spyOn(AnalysisAPI, 'saveAnalysis').mockResolvedValue('rec1');
    const record = mockRecord();
    act(() => {
      useAnalysisHistoryBase.setState(state => ({ ...state, records: [record] }));
    });

    const { result } = renderHook(() => useAnalysisActions());

    await act(async () => {
      await result.current.updateRecord('rec1', { symbol: 'ETHUSDT' });
    });

    expect(saveSpy).toHaveBeenCalled();
    expect(withRetry as jest.Mock).toHaveBeenCalled();
    const updated = useAnalysisHistoryBase.getState().getRecord('rec1');
    expect(updated?.symbol).toBe('ETHUSDT');
    expect(updated?.dbMeta?.synced).toBe(true);
  });

  it('does not call saveAnalysis when DB sync disabled', async () => {
    const saveSpy = jest.spyOn(AnalysisAPI, 'saveAnalysis').mockResolvedValue('rec1');
    const record = mockRecord();
    act(() => {
      useAnalysisHistoryBase.setState(state => ({ ...state, isDbEnabled: false, records: [record] }));
    });

    const { result } = renderHook(() => useAnalysisActions());
    await act(async () => {
      await result.current.updateRecord('rec1', { symbol: 'ETHUSDT' });
    });

    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('retries when saveAnalysis fails', async () => {
    const saveSpy = jest
      .spyOn(AnalysisAPI, 'saveAnalysis')
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('rec1');
    const record = mockRecord();
    act(() => {
      useAnalysisHistoryBase.setState(state => ({ ...state, records: [record] }));
    });

    const { result } = renderHook(() => useAnalysisActions());
    await act(async () => {
      await result.current.updateRecord('rec1', { symbol: 'ETHUSDT' });
    });

    expect(saveSpy).toHaveBeenCalledTimes(3);
    expect(withRetry as jest.Mock).toHaveBeenCalled();
    const updated = useAnalysisHistoryBase.getState().getRecord('rec1');
    expect(updated?.dbMeta?.synced).toBe(true);
  });
});
