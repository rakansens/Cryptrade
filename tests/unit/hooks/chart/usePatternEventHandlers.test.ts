// Mock dependencies before imports
jest.mock('@/store/chart', () => ({
  usePatternActions: jest.fn(() => ({
    addPattern: jest.fn(),
    removePattern: jest.fn(),
    clearPatterns: jest.fn(),
  })),
  useChartBaseStore: jest.fn(() => ({
    symbol: 'BTCUSDT',
    timeframe: '1h',
  })),
  usePatternStore: jest.fn()
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));
jest.mock('@/lib/chart/agent-utils', () => ({
  handleValidationError: jest.fn(),
  handleAgentError: jest.fn(),
  showAgentSuccess: jest.fn(),
  getPatternRenderer: jest.fn(() => ({
    renderPattern: jest.fn(),
    removePattern: jest.fn(),
  }))
}));
jest.mock('@/types/events/pattern-events', () => ({
  validatePatternEvent: jest.fn((eventType, detail) => ({
    success: true,
    data: { type: eventType, data: detail?.data || detail }
  }))
}));

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePatternEventHandlers } from '@/hooks/chart/usePatternEventHandlers';
import { usePatternActions, useChartBaseStore, usePatternStore } from '@/store/chart';
import { logger } from '@/lib/utils/logger';
import type { ChartEventHandlers } from '@/components/chart/hooks/useAgentEventHandlers';
import { 
  handleValidationError, 
  handleAgentError, 
  showAgentSuccess, 
  getPatternRenderer 
} from '@/lib/chart/agent-utils';

describe('usePatternEventHandlers', () => {
  const mockPatternRenderer = {
    renderPattern: jest.fn(),
    removePattern: jest.fn(),
  };
  
  // Create a complete mock of ChartEventHandlers to ensure useEffect runs
  let mockHandlers: ChartEventHandlers;

  const mockPatterns = new Map([
    ['pattern1', {
      id: 'pattern1',
      type: 'triangle',
      visualization: {
        type: 'triangle',
        lines: [
          { start: { time: 1000, price: 100 }, end: { time: 2000, price: 200 }, type: 'trend' },
        ],
      },
    }],
  ]);

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset all mock implementations
    mockPatternRenderer.renderPattern.mockClear();
    mockPatternRenderer.removePattern.mockClear();
    
    // Initialize mockHandlers with stable references
    mockHandlers = {
      patternRenderer: mockPatternRenderer,
      getPatternRenderer: jest.fn(() => mockPatternRenderer),
      chart: {} as any,
      series: {} as any,
    } as ChartEventHandlers;
    
    // Mock usePatternStore with getState and setState methods
    (usePatternStore as any).getState = jest.fn().mockReturnValue({
      patterns: mockPatterns,
    });
    (usePatternStore as any).setState = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clean up event listeners
    const eventTypes = [
      'chart:addPattern',
      'chart:removePattern',
      'chart:updatePatternStyle',
    ];
    eventTypes.forEach(type => {
      window.removeEventListener(type, () => {});
    });
  });

  describe('Initial state and mounting', () => {
    it('should register event listeners on mount', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      
      // Render the hook 
      const { result } = renderHook(() => usePatternEventHandlers(mockHandlers));
      
      // useEffect should run immediately
      expect(addEventListenerSpy).toHaveBeenCalled();
      
      // Check that addEventListener was called
      expect(addEventListenerSpy).toHaveBeenCalledWith('chart:addPattern', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('chart:removePattern', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('chart:updatePatternStyle', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledTimes(3);

      expect(logger.info).toHaveBeenCalledWith(
        '[Pattern Event Handlers] Registered pattern event listeners',
        expect.objectContaining({ eventCount: 3 })
      );
      
      addEventListenerSpy.mockRestore();
    });

    it('should remove event listeners on unmount', async () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() => usePatternEventHandlers(mockHandlers));

      // Wait for initial mount
      await waitFor(() => {
        expect(logger.info).toHaveBeenCalledWith(
          '[Pattern Event Handlers] Registered pattern event listeners',
          expect.objectContaining({ eventCount: 3 })
        );
      });

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('chart:addPattern', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('chart:removePattern', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('chart:updatePatternStyle', expect.any(Function));
      expect(logger.info).toHaveBeenCalledWith('[Pattern Event Handlers] Cleaned up pattern event listeners');
      
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Add Pattern Event', () => {
    it('should handle valid add pattern event', async () => {
      renderHook(() => usePatternEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:addPattern', {
        detail: {
          type: 'chart:addPattern',
          timestamp: Date.now(),
          data: {
            id: 'pattern123',
            pattern: {
              type: 'head_and_shoulders',
              confidence: 0.85,
              tradingImplication: 'Bearish reversal pattern',
              visualization: {
                type: 'head_and_shoulders',
                lines: [
                  {
                    start: { time: 1000, price: 100 },
                    end: { time: 2000, price: 200 },
                    type: 'trend',
                  },
                ],
              },
              metrics: {
                confidence: 0.85,
                targetPrice: 95,
                stopLoss: 205,
                riskReward: 2.5,
              },
            },
          },
        },
      });

      await act(async () => {
        window.dispatchEvent(event);
      });

      await waitFor(() => {
        expect(mockAddPattern).toHaveBeenCalledWith(
          'pattern123',
          expect.objectContaining({
            id: 'pattern123',
            type: 'head_and_shoulders',
            symbol: 'BTCUSDT',
            interval: '1h',
          })
        );
      });
      
      expect(mockPatternRenderer.renderPattern).toHaveBeenCalled();
      expect(showAgentSuccess).toHaveBeenCalled();
    });

    it('should handle pattern with markers format', async () => {
      renderHook(() => usePatternEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:addPattern', {
        detail: {
          type: 'chart:addPattern',
          timestamp: Date.now(),
          data: {
            id: 'pattern456',
            pattern: {
              type: 'triangle',
              visualization: {
                markers: [
                  { time: 1000, value: 100, text: 'Point 1' },
                  { time: 2000, value: 200, text: 'Point 2' },
                ],
                lines: [{ style: { color: '#ff0000' } }],
                zones: [{ style: { fillColor: '#ff000020' } }],
              },
            },
          },
        },
      });

      await act(async () => {
        window.dispatchEvent(event);
      });

      await waitFor(() => {
        expect(mockAddPattern).toHaveBeenCalled();
      });
      
      // Verify transformation of markers to keyPoints
      const addPatternCall = mockAddPattern.mock.calls[0];
      expect(addPatternCall[1].visualization).toBeDefined();
    });

    it('should handle validation error for invalid pattern event', async () => {
      renderHook(() => usePatternEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:addPattern', {
        detail: { invalid: 'data' },
      });

      await act(async () => {
        window.dispatchEvent(event);
      });

      await waitFor(() => {
        expect(handleValidationError).toHaveBeenCalled();
      });
      
      expect(mockAddPattern).not.toHaveBeenCalled();
    });

    it('should handle missing pattern renderer gracefully', async () => {
      jest.mocked(getPatternRenderer).mockReturnValueOnce(null);
      
      renderHook(() => usePatternEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:addPattern', {
        detail: {
          type: 'chart:addPattern',
          timestamp: Date.now(),
          data: {
            id: 'pattern789',
            pattern: { type: 'triangle', visualization: {} },
          },
        },
      });

      await act(async () => {
        window.dispatchEvent(event);
      });

      await waitFor(() => {
        expect(logger.warn).toHaveBeenCalledWith('[Pattern Event] Pattern renderer not available');
      });
      
      expect(handleAgentError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ eventType: 'chart:addPattern' }),
        'Pattern renderer not initialized'
      );
    });
  });

  describe('Remove Pattern Event', () => {
    it('should handle valid remove pattern event', async () => {
      renderHook(() => usePatternEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:removePattern', {
        detail: {
          type: 'chart:removePattern',
          timestamp: Date.now(),
          data: { id: 'pattern1' },
        },
      });

      await act(async () => {
        window.dispatchEvent(event);
      });

      await waitFor(() => {
        expect(mockRemovePattern).toHaveBeenCalledWith('pattern1');
      });
      
      expect(mockPatternRenderer.removePattern).toHaveBeenCalledWith('pattern1');
      expect(showAgentSuccess).toHaveBeenCalled();
    });

    it('should log pattern removal details', async () => {
      renderHook(() => usePatternEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:removePattern', {
        detail: {
          type: 'chart:removePattern',
          timestamp: Date.now(),
          data: { id: 'pattern1' },
        },
      });

      await act(async () => {
        window.dispatchEvent(event);
      });

      await waitFor(() => {
        expect(logger.info).toHaveBeenCalledWith(
          '[Pattern Event] Current patterns in store:',
          expect.objectContaining({
            patternIds: ['pattern1'],
            requestedId: 'pattern1',
            hasPattern: true,
          })
        );
      });
    });

    it('should handle missing pattern renderer on remove', async () => {
      jest.mocked(getPatternRenderer).mockReturnValueOnce(null);
      
      renderHook(() => usePatternEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:removePattern', {
        detail: {
          type: 'chart:removePattern',
          timestamp: Date.now(),
          data: { id: 'pattern1' },
        },
      });

      await act(async () => {
        window.dispatchEvent(event);
      });

      await waitFor(() => {
        expect(mockRemovePattern).toHaveBeenCalled();
      });
      
      expect(handleAgentError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ eventType: 'chart:removePattern' }),
        'Pattern renderer not available'
      );
    });
  });

  describe('Update Pattern Style Event', () => {
    it('should handle valid update pattern style event', async () => {
      renderHook(() => usePatternEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:updatePatternStyle', {
        detail: {
          type: 'chart:updatePatternStyle',
          timestamp: Date.now(),
          data: {
            patternId: 'pattern1',
            patternStyle: {
              baseStyle: {
                color: '#00ff00',
                lineWidth: 3,
                lineStyle: 'dashed',
              },
            },
            immediate: true,
          },
        },
      });

      await act(async () => {
        window.dispatchEvent(event);
      });

      await waitFor(() => {
        expect(mockPatternRenderer.removePattern).toHaveBeenCalledWith('pattern1');
      });
      
      expect(mockPatternRenderer.renderPattern).toHaveBeenCalled();
      expect(showAgentSuccess).toHaveBeenCalled();
    });

    it('should handle line style updates', async () => {
      // Update mock patterns to include lines with ids
      const patternsWithLineIds = new Map([
        ['pattern1', {
          id: 'pattern1',
          type: 'triangle',
          visualization: {
            lines: [
              { id: 'line1', style: { color: '#ff0000' } },
              { id: 'line2', style: { color: '#00ff00' } },
            ],
          },
        }],
      ]);
      (usePatternStore.getState as jest.Mock).mockReturnValue({
        patterns: patternsWithLineIds,
      });

      renderHook(() => usePatternEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:updatePatternStyle', {
        detail: {
          type: 'chart:updatePatternStyle',
          timestamp: Date.now(),
          data: {
            patternId: 'pattern1',
            lineStyles: [
              {
                lineId: 'line1',
                style: { color: '#0000ff', lineWidth: 4 },
              },
            ],
          },
        },
      });

      await act(async () => {
        window.dispatchEvent(event);
      });

      await waitFor(() => {
        expect(usePatternStore.setState).toHaveBeenCalled();
      });
    });

    it('should handle pattern not found error', async () => {
      (usePatternStore.getState as jest.Mock).mockReturnValue({
        patterns: new Map(),
      });

      renderHook(() => usePatternEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:updatePatternStyle', {
        detail: {
          type: 'chart:updatePatternStyle',
          timestamp: Date.now(),
          data: {
            patternId: 'nonexistent',
            patternStyle: { baseStyle: { color: '#ff0000' } },
          },
        },
      });

      await act(async () => {
        window.dispatchEvent(event);
      });

      await waitFor(() => {
        expect(logger.warn).toHaveBeenCalledWith(
          '[Pattern Event] Pattern not found for style update',
          { patternId: 'nonexistent' }
        );
      });
      
      expect(handleAgentError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ eventType: 'chart:updatePatternStyle' }),
        'パターンが見つかりません'
      );
    });

    it('should handle missing pattern renderer on style update', async () => {
      jest.mocked(getPatternRenderer).mockReturnValueOnce(null);
      
      renderHook(() => usePatternEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:updatePatternStyle', {
        detail: {
          type: 'chart:updatePatternStyle',
          timestamp: Date.now(),
          data: {
            patternId: 'pattern1',
            patternStyle: { baseStyle: { color: '#ff0000' } },
          },
        },
      });

      await act(async () => {
        window.dispatchEvent(event);
      });

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith('[Pattern Event] Pattern renderer not available for style update');
      });
      
      expect(handleAgentError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ eventType: 'chart:updatePatternStyle' }),
        'パターンレンダラーが利用できません'
      );
    });

    it('should update area styles in pattern visualization', async () => {
      const patternWithAreas = new Map([
        ['pattern1', {
          id: 'pattern1',
          type: 'pattern',
          visualization: {
            areas: [
              { style: { fillColor: '#ff000050' } },
            ],
          },
        }],
      ]);
      (usePatternStore.getState as jest.Mock).mockReturnValue({
        patterns: patternWithAreas,
      });

      renderHook(() => usePatternEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:updatePatternStyle', {
        detail: {
          type: 'chart:updatePatternStyle',
          timestamp: Date.now(),
          data: {
            patternId: 'pattern1',
            patternStyle: {
              baseStyle: { color: '#0000ff' },
            },
          },
        },
      });

      await act(async () => {
        window.dispatchEvent(event);
      });

      await waitFor(() => {
        // Verify area style was updated
        expect(mockPatternRenderer.renderPattern).toHaveBeenCalled();
      });
    });
  });

  describe('Error handling', () => {
    it('should handle errors during pattern operations', async () => {
      // Get mock from the module
      const mockAddPattern = jest.mocked(usePatternActions).mock.results[0]?.value?.addPattern;
      if (mockAddPattern) {
        mockAddPattern.mockImplementationOnce(() => {
          throw new Error('Failed to add pattern');
        });
      }

      renderHook(() => usePatternEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:addPattern', {
        detail: {
          type: 'chart:addPattern',
          timestamp: Date.now(),
          data: {
            id: 'pattern123',
            pattern: {
              type: 'triangle',
              visualization: {},
            },
          },
        },
      });

      await act(async () => {
        window.dispatchEvent(event);
      });

      await waitFor(() => {
        expect(handleAgentError).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({ eventType: 'chart:addPattern' }),
          undefined
        );
      });
    });

    it('should handle pattern with markers transformation', async () => {
      renderHook(() => usePatternEventHandlers(mockHandlers));

      const patternWithMarkers = new Map([
        ['pattern1', {
          id: 'pattern1',
          type: 'pattern',
          visualization: {
            markers: [
              { time: 1000, value: 100, text: 'Peak' },
            ],
            lines: [],
            zones: [],
          },
        }],
      ]);
      (usePatternStore.getState as jest.Mock).mockReturnValue({
        patterns: patternWithMarkers,
      });

      const event = new CustomEvent('chart:updatePatternStyle', {
        detail: {
          type: 'chart:updatePatternStyle',
          timestamp: Date.now(),
          data: {
            patternId: 'pattern1',
            patternStyle: { baseStyle: { color: '#ff0000' } },
            immediate: true,
          },
        },
      });

      await act(async () => {
        window.dispatchEvent(event);
      });

      await waitFor(() => {
        // Verify the pattern was re-rendered with transformed visualization
        expect(mockPatternRenderer.renderPattern).toHaveBeenCalled();
      });
      
      const renderCall = (mockPatternRenderer.renderPattern as jest.Mock).mock.calls[0];
      expect(renderCall[1]).toHaveProperty('keyPoints');
    });
  });
});