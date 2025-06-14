import { renderHook, act, waitFor } from '@testing-library/react';
import { useAnalysisStream } from '../use-analysis-stream';
import { useStreaming } from '@/hooks/base/use-streaming';
import { logger } from '@/lib/utils/logger';
import { streamToLines } from '@/lib/utils/stream-utils';
import type { AnalysisProgressEvent, AnalysisStep } from '@/types/analysis-progress';

// Mock dependencies
jest.mock('@/hooks/base/use-streaming');
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('@/lib/utils/stream-utils');

// Mock fetch
global.fetch = jest.fn();

describe('useAnalysisStream', () => {
  const mockStreamingHook = {
    isStreaming: false,
    error: null,
    disconnect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useStreaming as jest.Mock).mockReturnValue(mockStreamingHook);
  });

  describe('initialization', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useAnalysisStream());

      expect(result.current.steps).toEqual([]);
      expect(result.current.currentStepIndex).toBe(-1);
      expect(result.current.isAnalyzing).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should setup streaming hook with correct config', () => {
      renderHook(() => useAnalysisStream());

      expect(useStreaming).toHaveBeenCalledWith({
        endpoint: '/api/ai/analysis-stream',
        autoConnect: false,
        onMessage: expect.any(Function),
        onError: expect.any(Function),
        parseResponse: expect.any(Function),
      });
    });
  });

  describe('startAnalysis', () => {
    it('should start analysis with correct parameters', async () => {
      const { result } = renderHook(() => useAnalysisStream());

      const mockResponse = {
        ok: true,
        body: {},
      };
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse);
      (streamToLines as jest.Mock).mockImplementation(async function* () {
        yield JSON.stringify({ type: 'analysis:complete', data: { duration: 1000, proposalCount: 5, proposalGroupId: 'pg-123' } });
      });

      await act(async () => {
        await result.current.startAnalysis({
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'trendline',
          maxProposals: 5,
        });
      });

      expect(fetch).toHaveBeenCalledWith('/api/ai/analysis-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"symbol":"BTCUSDT"'),
      });
    });

    it('should reset state before starting new analysis', async () => {
      const { result } = renderHook(() => useAnalysisStream());

      // Set some initial state
      act(() => {
        result.current.steps.push({ id: 'old-step', type: 'data_fetch' as any, name: 'Old Step', status: 'completed', progress: 100 });
      });

      const mockResponse = { ok: true, body: {} };
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse);
      (streamToLines as jest.Mock).mockImplementation(async function* () {
        yield JSON.stringify({ type: 'analysis:complete', data: { duration: 1000, proposalCount: 5, proposalGroupId: 'pg-123' } });
      });

      await act(async () => {
        await result.current.startAnalysis({
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'all',
        });
      });

      expect(mockStreamingHook.disconnect).toHaveBeenCalled();
    });

    it('should handle fetch errors', async () => {
      const onError = jest.fn();
      const { result } = renderHook(() => useAnalysisStream({ onError }));

      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        await result.current.startAnalysis({
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'pattern',
        });
      });

      expect(onError).toHaveBeenCalledWith('Network error');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should generate unique session IDs', async () => {
      const { result } = renderHook(() => useAnalysisStream());

      const mockResponse = { ok: true, body: {} };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);
      (streamToLines as jest.Mock).mockImplementation(async function* () {
        yield JSON.stringify({ type: 'analysis:complete', data: { duration: 1000, proposalCount: 5, proposalGroupId: 'pg-123' } });
      });

      const calls: string[] = [];
      (fetch as jest.Mock).mockImplementation((url, options) => {
        const body = JSON.parse(options.body);
        calls.push(body.sessionId);
        return Promise.resolve(mockResponse);
      });

      await act(async () => {
        await result.current.startAnalysis({ symbol: 'BTCUSDT', interval: '1h', analysisType: 'all' });
      });

      await act(async () => {
        await result.current.startAnalysis({ symbol: 'ETHUSDT', interval: '4h', analysisType: 'all' });
      });

      expect(calls[0]).not.toBe(calls[1]);
      expect(calls[0]).toMatch(/^session_\d+$/);
      expect(calls[1]).toMatch(/^session_\d+$/);
    });
  });

  describe('event handling', () => {
    let onMessage: (event: AnalysisProgressEvent) => void;

    beforeEach(() => {
      (useStreaming as jest.Mock).mockImplementation((config) => {
        onMessage = config.onMessage;
        return mockStreamingHook;
      });
    });

    it('should handle analysis:start event', () => {
      const { result } = renderHook(() => useAnalysisStream());

      act(() => {
        onMessage({
          type: 'analysis:start',
          data: { totalSteps: 5, sessionId: 'session-123' },
        });
      });

      expect(logger.info).toHaveBeenCalledWith('[Analysis Stream] Analysis started', expect.any(Object));
    });

    it('should handle analysis:step-start event', () => {
      const onStepStart = jest.fn();
      const { result } = renderHook(() => useAnalysisStream({ onStepStart }));

      const step: AnalysisStep = {
        id: 'step-1',
        type: 'data_fetch' as AnalysisStepType,
        name: 'Fetching data',
        status: 'in_progress',
        progress: 0,
      };

      act(() => {
        onMessage({
          type: 'analysis:step-start',
          data: { step, currentStepIndex: 0 },
        });
      });

      expect(result.current.steps[0]).toEqual(step);
      expect(result.current.currentStepIndex).toBe(0);
      expect(onStepStart).toHaveBeenCalledWith(step);
    });

    it('should handle analysis:step-progress event', () => {
      const onStepProgress = jest.fn();
      const { result } = renderHook(() => useAnalysisStream({ onStepProgress }));

      const step: AnalysisStep = {
        id: 'step-1',
        type: 'ml_analysis' as AnalysisStepType,
        name: 'ML Analysis',
        status: 'in_progress',
        progress: 50,
      };

      act(() => {
        onMessage({
          type: 'analysis:step-progress',
          data: { step, currentStepIndex: 1 },
        });
      });

      expect(result.current.steps[1]).toEqual(step);
      expect(onStepProgress).toHaveBeenCalledWith(step);
    });

    it('should handle analysis:step-complete event', () => {
      const onStepComplete = jest.fn();
      const { result } = renderHook(() => useAnalysisStream({ onStepComplete }));

      const step: AnalysisStep = {
        id: 'step-1',
        type: 'proposal_generation' as AnalysisStepType,
        name: 'Generating proposals',
        status: 'completed',
        progress: 100,
      };

      act(() => {
        onMessage({
          type: 'analysis:step-complete',
          data: { step, currentStepIndex: 2 },
        });
      });

      expect(result.current.steps[2]).toEqual(step);
      expect(onStepComplete).toHaveBeenCalledWith(step);
    });

    it('should handle analysis:complete event', () => {
      const onComplete = jest.fn();
      const { result } = renderHook(() => useAnalysisStream({ onComplete }));

      const completeData = {
        duration: 2500,
        proposalCount: 5,
        proposalGroupId: 'pg-123',
      };

      act(() => {
        onMessage({
          type: 'analysis:complete',
          data: completeData,
        });
      });

      expect(onComplete).toHaveBeenCalledWith(completeData);
      expect(logger.info).toHaveBeenCalledWith('[Analysis Stream] Analysis completed', completeData);
    });

    it('should handle analysis:error event', () => {
      const onError = jest.fn();
      const { result } = renderHook(() => useAnalysisStream({ onError }));

      act(() => {
        onMessage({
          type: 'analysis:error',
          data: { error: 'Analysis failed' },
        });
      });

      expect(onError).toHaveBeenCalledWith('Analysis failed');
      expect(logger.error).toHaveBeenCalledWith('[Analysis Stream] Analysis error', { error: 'Analysis failed' });
    });

    it('should warn on unknown event type', () => {
      renderHook(() => useAnalysisStream());

      act(() => {
        onMessage({
          type: 'unknown:event' as any,
          data: {},
        });
      });

      expect(logger.warn).toHaveBeenCalledWith('[Analysis Stream] Unknown event type', { type: 'unknown:event' });
    });
  });

  describe('stream processing', () => {
    it('should process stream events correctly', async () => {
      const onStepStart = jest.fn();
      const onComplete = jest.fn();
      const { result } = renderHook(() => useAnalysisStream({ onStepStart, onComplete }));

      const mockEvents = [
        { type: 'analysis:start', data: { totalSteps: 3, sessionId: 'session-123' } },
        { type: 'analysis:step-start', data: { step: { id: '1', type: 'data_fetch', name: 'Fetching', status: 'in_progress', progress: 0 }, currentStepIndex: 0 } },
        { type: 'analysis:step-complete', data: { step: { id: '1', type: 'data_fetch', name: 'Fetching', status: 'completed', progress: 100 }, currentStepIndex: 0 } },
        { type: 'analysis:complete', data: { duration: 1000, proposalCount: 3, proposalGroupId: 'pg-123' } },
      ];

      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, body: {} });
      (streamToLines as jest.Mock).mockImplementation(async function* () {
        for (const event of mockEvents) {
          yield JSON.stringify(event);
        }
      });

      await act(async () => {
        await result.current.startAnalysis({
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'all',
        });
      });

      await waitFor(() => {
        expect(onStepStart).toHaveBeenCalled();
        expect(onComplete).toHaveBeenCalled();
      });
    });

    it('should handle JSON parsing errors in stream', async () => {
      const { result } = renderHook(() => useAnalysisStream());

      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, body: {} });
      (streamToLines as jest.Mock).mockImplementation(async function* () {
        yield 'invalid json';
        yield JSON.stringify({ type: 'analysis:complete', data: { duration: 1000, proposalCount: 1, proposalGroupId: 'pg-123' } });
      });

      await act(async () => {
        await result.current.startAnalysis({
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'all',
        });
      });

      expect(logger.error).toHaveBeenCalledWith('[Analysis Stream] Failed to parse event', expect.any(Object));
    });

    it('should handle stream processing errors', async () => {
      const onError = jest.fn();
      const { result } = renderHook(() => useAnalysisStream({ onError }));

      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, body: {} });
      (streamToLines as jest.Mock).mockRejectedValueOnce(new Error('Stream error'));

      await act(async () => {
        await result.current.startAnalysis({
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'all',
        });
      });

      expect(onError).toHaveBeenCalledWith('Stream error');
      expect(logger.error).toHaveBeenCalledWith('[Analysis Stream] Stream processing error', expect.any(Object));
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      const { result } = renderHook(() => useAnalysisStream());

      // Set some state
      act(() => {
        const step: AnalysisStep = {
          id: 'step-1',
          type: 'data_fetch' as AnalysisStepType,
          name: 'Test Step',
          status: 'completed',
          progress: 100,
        };
        result.current.steps.push(step);
        result.current.currentStepIndex = 0;
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.steps).toEqual([]);
      expect(result.current.currentStepIndex).toBe(-1);
      expect(mockStreamingHook.disconnect).toHaveBeenCalled();
    });
  });

  describe('error state', () => {
    it('should return error from streaming hook', () => {
      const streamingError = new Error('Streaming error');
      (useStreaming as jest.Mock).mockReturnValue({
        ...mockStreamingHook,
        error: streamingError,
      });

      const { result } = renderHook(() => useAnalysisStream());

      expect(result.current.error).toBe('Streaming error');
    });

    it('should return null when no error', () => {
      const { result } = renderHook(() => useAnalysisStream());

      expect(result.current.error).toBeNull();
    });
  });

  describe('isAnalyzing state', () => {
    it('should reflect streaming state', () => {
      (useStreaming as jest.Mock).mockReturnValue({
        ...mockStreamingHook,
        isStreaming: true,
      });

      const { result } = renderHook(() => useAnalysisStream());

      expect(result.current.isAnalyzing).toBe(true);
    });
  });
});