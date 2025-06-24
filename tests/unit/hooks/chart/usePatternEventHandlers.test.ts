// Tests for usePatternEventHandlers

// Unmock the hook we're testing
jest.unmock('@/hooks/chart/usePatternEventHandlers');

import { renderHook, act, waitFor } from '@testing-library/react';
import { usePatternEventHandlers } from '@/hooks/chart/usePatternEventHandlers';
import { usePatternStore } from '@/store/chart';
import { logger } from '@/lib/utils/logger';
import type { ChartEventHandlers } from '@/components/chart/hooks/useAgentEventHandlers';
import { 
  handleValidationError, 
  handleAgentError, 
  showAgentSuccess,
  getPatternRenderer
} from '@/lib/chart/agent-utils';
import { validatePatternEvent } from '@/types/events/pattern-events';

// Mock dependencies
const mockAddPattern = jest.fn();
const mockRemovePattern = jest.fn();
const mockClearPatterns = jest.fn();

const mockPatternActionsReturn = {
  addPattern: mockAddPattern,
  removePattern: mockRemovePattern,
  clearPatterns: mockClearPatterns,
};

const mockChartBaseStoreReturn = {
  symbol: 'BTCUSDT',
  timeframe: '1h',
};

// First unmock, then re-mock with specific implementations
jest.unmock('@/store/chart');
jest.mock('@/store/chart', () => ({
  usePatternActions: jest.fn(() => mockPatternActionsReturn),
  useChartBaseStore: jest.fn(() => mockChartBaseStoreReturn),
  usePatternStore: Object.assign(jest.fn(), {
    getState: jest.fn(() => ({
      patterns: new Map()
    })),
    setState: jest.fn()
  })
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

const mockPatternRenderer = {
  renderPattern: jest.fn(),
  removePattern: jest.fn(),
};

jest.mock('@/lib/chart/agent-utils', () => ({
  handleValidationError: jest.fn(),
  handleAgentError: jest.fn(),
  showAgentSuccess: jest.fn(),
  getPatternRenderer: jest.fn(() => mockPatternRenderer)
}));

jest.mock('@/types/events/pattern-events', () => ({
  validatePatternEvent: jest.fn((eventType, detail) => ({
    success: true,
    data: { type: eventType, data: detail?.data || detail }
  }))
}));

describe('usePatternEventHandlers', () => {
  const mockHandlers: ChartEventHandlers = {
    patternRenderer: mockPatternRenderer,
    getPatternRenderer: () => mockPatternRenderer,
    chart: {} as any,
    series: {} as any,
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset pattern store state
    (usePatternStore as any).getState.mockReturnValue({
      patterns: new Map(),
    });
  });

  afterEach(() => {
    // Clean up any remaining event listeners
    const events = ['chart:addPattern', 'chart:removePattern', 'chart:updatePatternStyle'];
    events.forEach(event => {
      const listeners = (window as any).listeners?.(event) || [];
      listeners.forEach((listener: any) => {
        window.removeEventListener(event, listener);
      });
    });
  });

  describe('Event listener registration and cleanup', () => {
    it('should register event listeners on mount', async () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      
      const { result } = renderHook(() => usePatternEventHandlers(mockHandlers));
      
      // Wait for effects to run
      await waitFor(() => {
        expect(addEventListenerSpy).toHaveBeenCalledTimes(3);
      });
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('chart:addPattern', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('chart:removePattern', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('chart:updatePatternStyle', expect.any(Function));
      
      expect(logger.info).toHaveBeenCalledWith(
        '[Pattern Event Handlers] Registered pattern event listeners',
        expect.objectContaining({
          eventCount: 3,
          events: ['chart:addPattern', 'chart:removePattern', 'chart:updatePatternStyle']
        })
      );
    });

    it('should remove event listeners on unmount', async () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      
      const { unmount } = renderHook(() => usePatternEventHandlers(mockHandlers));
      
      // Wait for initial mount effects
      await waitFor(() => {
        expect(logger.info).toHaveBeenCalledWith(
          '[Pattern Event Handlers] Registered pattern event listeners',
          expect.anything()
        );
      });
      
      unmount();
      
      await waitFor(() => {
        expect(removeEventListenerSpy).toHaveBeenCalledTimes(3);
      });
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('chart:addPattern', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('chart:removePattern', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('chart:updatePatternStyle', expect.any(Function));
      
      expect(logger.info).toHaveBeenCalledWith('[Pattern Event Handlers] Cleaned up pattern event listeners');
    });
  });

  describe('Add Pattern Event', () => {
    it('should handle valid add pattern event', async () => {
      renderHook(() => usePatternEventHandlers(mockHandlers));
      
      // Wait for effects to run
      await waitFor(() => {
        expect(logger.info).toHaveBeenCalledWith(
          '[Pattern Event Handlers] Registered pattern event listeners',
          expect.anything()
        );
      });
      
      const patternData = {
        id: 'test-pattern',
        pattern: {
          type: 'triangle',
          visualization: {
            type: 'triangle',
            lines: [
              { start: { time: 1000, price: 100 }, end: { time: 2000, price: 200 }, type: 'trend' }
            ],
          },
          confidence: 0.85,
          tradingImplication: 'Bullish breakout expected',
          metrics: {
            confidence: 0.85,
            entryPrice: 150,
            targetPrice: 200,
            stopLoss: 140,
            riskReward: 5
          }
        }
      };

      act(() => {
        window.dispatchEvent(new CustomEvent('chart:addPattern', {
          detail: { data: patternData }
        }));
      });

      // Event handler should be called synchronously
      expect(validatePatternEvent).toHaveBeenCalledWith('chart:addPattern', { data: patternData });
      expect(mockAddPattern).toHaveBeenCalledWith('test-pattern', expect.objectContaining({
        id: 'test-pattern',
        type: 'triangle',
        symbol: 'BTCUSDT',
        interval: '1h',
        visualization: expect.objectContaining({
          type: 'triangle',
          lines: expect.any(Array)
        }),
        confidence: 0.85,
        tradingImplication: 'Bullish breakout expected',
        metrics: expect.objectContaining({
          confidence: 0.85,
          entryPrice: 150,
          targetPrice: 200,
          stopLoss: 140,
          riskReward: 5
        })
      }));
      expect(mockPatternRenderer.renderPattern).toHaveBeenCalledWith(
        'test-pattern',
        expect.any(Object),
        'triangle',
        expect.objectContaining({
          targetLevel: 200,
          stopLoss: 140
        })
      );
      expect(showAgentSuccess).toHaveBeenCalled();
    });

    it('should handle pattern with markers transformation', async () => {
      renderHook(() => usePatternEventHandlers(mockHandlers));
      
      // Wait for effects to run
      await waitFor(() => {
        expect(logger.info).toHaveBeenCalledWith(
          '[Pattern Event Handlers] Registered pattern event listeners',
          expect.anything()
        );
      });
      
      const patternData = {
        id: 'marker-pattern',
        pattern: {
          type: 'head-and-shoulders',
          visualization: {
            markers: [
              { time: 1000, value: 100, text: 'Left Shoulder' },
              { time: 2000, value: 120, text: 'Head' },
              { time: 3000, value: 100, text: 'Right Shoulder' }
            ],
            lines: [{ style: { color: 'red' } }],
            zones: [{ style: { fillColor: 'rgba(255,0,0,0.1)' } }]
          }
        }
      };

      act(() => {
        window.dispatchEvent(new CustomEvent('chart:addPattern', {
          detail: { data: patternData }
        }));
      });

      expect(mockPatternRenderer.renderPattern).toHaveBeenCalledWith(
        'marker-pattern',
        expect.objectContaining({
          keyPoints: expect.arrayContaining([
            expect.objectContaining({ time: 1000, value: 100, label: 'Left Shoulder' }),
            expect.objectContaining({ time: 2000, value: 120, label: 'Head' }),
            expect.objectContaining({ time: 3000, value: 100, label: 'Right Shoulder' })
          ])
        }),
        'head-and-shoulders',
        undefined
      );
    });

    it('should handle validation errors', async () => {
      (validatePatternEvent as jest.Mock).mockReturnValueOnce({
        success: false,
        error: 'Invalid pattern data'
      });

      renderHook(() => usePatternEventHandlers(mockHandlers));
      
      // Wait for effects to run
      await waitFor(() => {
        expect(logger.info).toHaveBeenCalledWith(
          '[Pattern Event Handlers] Registered pattern event listeners',
          expect.anything()
        );
      });
      
      act(() => {
        window.dispatchEvent(new CustomEvent('chart:addPattern', {
          detail: { invalid: 'data' }
        }));
      });

      expect(handleValidationError).toHaveBeenCalledWith(
        { success: false, error: 'Invalid pattern data' },
        expect.objectContaining({
          eventType: 'chart:addPattern',
          operation: 'Add pattern'
        })
      );
      expect(mockAddPattern).not.toHaveBeenCalled();
      expect(mockPatternRenderer.renderPattern).not.toHaveBeenCalled();
    });

    it('should handle missing pattern renderer', async () => {
      (getPatternRenderer as jest.Mock).mockReturnValueOnce(null);

      renderHook(() => usePatternEventHandlers(mockHandlers));
      
      // Wait for effects to run
      await waitFor(() => {
        expect(logger.info).toHaveBeenCalledWith(
          '[Pattern Event Handlers] Registered pattern event listeners',
          expect.anything()
        );
      });
      
      const patternData = {
        id: 'test-pattern',
        pattern: { type: 'triangle', visualization: { type: 'triangle', lines: [] } }
      };

      act(() => {
        window.dispatchEvent(new CustomEvent('chart:addPattern', {
          detail: { data: patternData }
        }));
      });

      expect(logger.warn).toHaveBeenCalledWith('[Pattern Event] Pattern renderer not available');
      expect(handleAgentError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          eventType: 'chart:addPattern',
          operation: 'Add pattern'
        }),
        'Pattern renderer not initialized'
      );
    });
  });

  describe('Remove Pattern Event', () => {
    it('should handle valid remove pattern event', async () => {
      const mockPatterns = new Map([
        ['pattern-to-remove', { id: 'pattern-to-remove', type: 'triangle' }]
      ]);
      (usePatternStore as any).getState.mockReturnValue({ patterns: mockPatterns });

      renderHook(() => usePatternEventHandlers(mockHandlers));
      
      // Wait for effects to run
      await waitFor(() => {
        expect(logger.info).toHaveBeenCalledWith(
          '[Pattern Event Handlers] Registered pattern event listeners',
          expect.anything()
        );
      });
      
      act(() => {
        window.dispatchEvent(new CustomEvent('chart:removePattern', {
          detail: { data: { id: 'pattern-to-remove' } }
        }));
      });

      expect(validatePatternEvent).toHaveBeenCalledWith('chart:removePattern', { data: { id: 'pattern-to-remove' } });
      expect(mockRemovePattern).toHaveBeenCalledWith('pattern-to-remove');
      expect(mockPatternRenderer.removePattern).toHaveBeenCalledWith('pattern-to-remove');
      expect(showAgentSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'chart:removePattern',
          operation: 'Remove pattern'
        }),
        'Pattern removed from chart'
      );
    });

    it('should handle errors during pattern removal', async () => {
      mockRemovePattern.mockImplementationOnce(() => {
        throw new Error('Failed to remove pattern');
      });

      renderHook(() => usePatternEventHandlers(mockHandlers));
      
      // Wait for effects to run
      await waitFor(() => {
        expect(logger.info).toHaveBeenCalledWith(
          '[Pattern Event Handlers] Registered pattern event listeners',
          expect.anything()
        );
      });
      
      act(() => {
        window.dispatchEvent(new CustomEvent('chart:removePattern', {
          detail: { data: { id: 'pattern-id' } }
        }));
      });

      expect(handleAgentError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          eventType: 'chart:removePattern',
          operation: 'Remove pattern',
          id: 'pattern-id'
        })
      );
    });
  });

  describe('Update Pattern Style Event', () => {
    it('should handle valid style update event', async () => {
      const mockPattern = {
        id: 'pattern1',
        type: 'triangle',
        visualization: {
          lines: [
            { id: 'line1', start: { time: 1000, price: 100 }, end: { time: 2000, price: 200 }, style: {} }
          ]
        }
      };
      const mockPatterns = new Map([['pattern1', mockPattern]]);
      (usePatternStore as any).getState.mockReturnValue({ patterns: mockPatterns });

      renderHook(() => usePatternEventHandlers(mockHandlers));
      
      // Wait for effects to run
      await waitFor(() => {
        expect(logger.info).toHaveBeenCalledWith(
          '[Pattern Event Handlers] Registered pattern event listeners',
          expect.anything()
        );
      });
      
      const updateData = {
        patternId: 'pattern1',
        patternStyle: {
          baseStyle: {
            color: '#ff0000',
            lineWidth: 2,
            lineStyle: 0
          }
        },
        lineStyles: [
          { lineId: 'line1', style: { color: '#00ff00', lineWidth: 3 } }
        ],
        immediate: true
      };

      act(() => {
        window.dispatchEvent(new CustomEvent('chart:updatePatternStyle', {
          detail: { data: updateData }
        }));
      });

      expect(validatePatternEvent).toHaveBeenCalledWith('chart:updatePatternStyle', { data: updateData });
      expect(mockPatternRenderer.removePattern).toHaveBeenCalledWith('pattern1');
      expect(mockPatternRenderer.renderPattern).toHaveBeenCalledWith(
        'pattern1',
        expect.any(Object),
        'triangle',
        undefined
      );
      expect(showAgentSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'chart:updatePatternStyle',
          operation: 'Update pattern style'
        }),
        'パターンスタイルを更新しました'
      );
    });

    it('should handle pattern not found error', async () => {
      (usePatternStore as any).getState.mockReturnValue({ patterns: new Map() });

      renderHook(() => usePatternEventHandlers(mockHandlers));
      
      // Wait for effects to run
      await waitFor(() => {
        expect(logger.info).toHaveBeenCalledWith(
          '[Pattern Event Handlers] Registered pattern event listeners',
          expect.anything()
        );
      });
      
      act(() => {
        window.dispatchEvent(new CustomEvent('chart:updatePatternStyle', {
          detail: { data: { patternId: 'non-existent', patternStyle: {} } }
        }));
      });

      expect(logger.warn).toHaveBeenCalledWith('[Pattern Event] Pattern not found for style update', { patternId: 'non-existent' });
      expect(handleAgentError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          eventType: 'chart:updatePatternStyle',
          operation: 'Update pattern style'
        }),
        'パターンが見つかりません'
      );
    });
  });

  describe('Error handling', () => {
    it('should handle errors in event handlers gracefully', async () => {
      mockAddPattern.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });

      renderHook(() => usePatternEventHandlers(mockHandlers));
      
      // Wait for effects to run
      await waitFor(() => {
        expect(logger.info).toHaveBeenCalledWith(
          '[Pattern Event Handlers] Registered pattern event listeners',
          expect.anything()
        );
      });
      
      act(() => {
        window.dispatchEvent(new CustomEvent('chart:addPattern', {
          detail: { data: { id: 'test', pattern: { type: 'triangle', visualization: {} } } }
        }));
      });

      expect(handleAgentError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          eventType: 'chart:addPattern',
          operation: 'Add pattern'
        })
      );
    });
  });
});