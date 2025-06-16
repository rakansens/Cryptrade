/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import useAnalysisHistoryBase, { useAnalysisActions } from '@/store/analysis-history.store';
import type { AnalysisRecord } from '@/types/analysis-history';
import { AnalysisAPI } from '@/lib/api/analysis-api';

jest.mock('@/lib/api/analysis-api');
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/lib/utils/zustand-helpers', () => ({
  createStoreDebugger: jest.fn(() => jest.fn()),
}));

const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

const createRecord = (): AnalysisRecord => ({
  id: 'record-1',
  proposalId: 'proposal-1',
  sessionId: 'session-1',
  timestamp: Date.now(),
  symbol: 'BTCUSDT',
  interval: '1h',
  type: 'support',
  proposal: {
    price: 50000,
    confidence: 0.9,
    drawingData: {
      id: 'draw-1',
      type: 'horizontal',
      points: [{ time: Date.now() / 1000, value: 50000 }],
      style: { color: '#fff', lineWidth: 1, lineStyle: 'solid', showLabels: true },
    },
  },
  tracking: {
    status: 'active',
    startTime: Date.now(),
    touches: [],
  },
  dbMeta: { version: 1, synced: false },
});

beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockReturnValue(null);
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
});

describe('AnalysisHistoryStore updateRecord', () => {
  it('should persist updates to DB when enabled', async () => {
    const { result } = renderHook(() => useAnalysisActions());
    const record = createRecord();
    useAnalysisHistoryBase.setState(state => ({ ...state, records: [record] }));
    (AnalysisAPI.updateAnalysis as jest.Mock).mockResolvedValue(undefined);

    await act(async () => {
      await result.current.updateRecord(record.id, { symbol: 'ETHUSDT' });
    });

    expect(AnalysisAPI.updateAnalysis).toHaveBeenCalledWith(record.id, { symbol: 'ETHUSDT' });
    const updated = useAnalysisHistoryBase.getState().getRecord(record.id);
    expect(updated?.symbol).toBe('ETHUSDT');
    expect(updated?.dbMeta?.synced).toBe(true);
  });

  it('should not call API when DB sync disabled', async () => {
    const { result } = renderHook(() => useAnalysisActions());
    const record = createRecord();
    useAnalysisHistoryBase.setState(state => ({ ...state, records: [record], isDbEnabled: false }));

    await act(async () => {
      await result.current.updateRecord(record.id, { symbol: 'ETHUSDT' });
    });

    expect(AnalysisAPI.updateAnalysis).not.toHaveBeenCalled();
  });

  it('should keep record unsynced on API failure', async () => {
    const { result } = renderHook(() => useAnalysisActions());
    const record = createRecord();
    useAnalysisHistoryBase.setState(state => ({ ...state, records: [record] }));
    (AnalysisAPI.updateAnalysis as jest.Mock).mockRejectedValue(new Error('fail'));

    await act(async () => {
      await result.current.updateRecord(record.id, { symbol: 'ETHUSDT' });
    });

    const updated = useAnalysisHistoryBase.getState().getRecord(record.id);
    expect(updated?.dbMeta?.synced).toBe(false);
  });
});
