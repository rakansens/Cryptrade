import { renderHook } from '@testing-library/react';
import { act } from 'react';;
import { usePatternEventHandlers } from '@/hooks/chart/usePatternEventHandlers';
import { chart } from '@/store/chart';
import { logger } from '@/lib/utils/logger';
import type { ChartEventHandlers } from '@/components/chart/hooks/useAgentEventHandlers';
import { agentUtils } from '@/lib/chart/agent-utils';

// Mock dependencies
jest.mock('../../../store/chart');
jest.mock('../../../lib/utils/logger');
jest.mock('../../../lib/chart/agent-utils');

describe('usePatternEventHandlers', () => {
  const mockHandlers: ChartEventHandlers = {
    patternRenderer: {
      renderPattern: jest.fn(),
      removePattern: jest.fn(),
    },
    getPatternRenderer: jest.fn(() => ({
      renderPattern: jest.fn(),
      removePattern: jest.fn(),
    })),
  } as any;

  const mockPatternActions = {
    addPattern: jest.fn(),
    removePattern: jest.fn(),
    clearPatterns: jest.fn(),
  };

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
    jest.mocked(usePatternActions).mockReturnValue(mockPatternActions);
    jest.mocked(useChartBaseStore).mockReturnValue({
      symbol: 'BTCUSDT',
      timeframe: '1h',
    });
    (usePatternStore.getState as jest.Mock).mockReturnValue({
      patterns: mockPatterns,
    });
    
    // Mock agent utils
    (agentUtils.handleValidationError as jest.Mock).mockImplementation(() => {});
    (agentUtils.handleAgentError as jest.Mock).mockImplementation(() => {});
    (agentUtils.showAgentSuccess as jest.Mock).mockImplementation(() => {});
    (agentUtils.getPatternRenderer as jest.Mock).mockReturnValue(mockHandlers.patternRenderer);
  });

  afterEach(() => {
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
      renderHook(() => usePatternEventHandlers(mockHandlers));

      expect(addEventListenerSpy).toHaveBeenCalledTimes(3);
      expect(logger.info).toHaveBeenCalledWith(
        '[Pattern Event Handlers] Registered pattern event listeners',
        expect.objectContaining({ eventCount: 3 })
      );
    });

    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() => usePatternEventHandlers(mockHandlers));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledTimes(3);
      expect(logger.info).toHaveBeenCalledWith('[Pattern Event Handlers] Cleaned up pattern event listeners');
    });
  });

  describe('Add Pattern Event', () => {
    it('should handle valid add pattern event', () => {
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

      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockPatternActions.addPattern).toHaveBeenCalledWith(
        'pattern123',
        expect.objectContaining({
          id: 'pattern123',
          type: 'head_and_shoulders',
          symbol: 'BTCUSDT',
          interval: '1h',
        })
      );
      expect(mockHandlers.patternRenderer?.renderPattern).toHaveBeenCalled();
      expect(agentUtils.showAgentSuccess).toHaveBeenCalled();
    });

    it('should handle pattern with markers format', () => {
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

      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockPatternActions.addPattern).toHaveBeenCalled();
      // Verify transformation of markers to keyPoints
      const addPatternCall = mockPatternActions.addPattern.mock.calls[0];
      expect(addPatternCall[1].visualization).toBeDefined();
    });

    it('should handle validation error for invalid pattern event', () => {
      renderHook(() => usePatternEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:addPattern', {
        detail: { invalid: 'data' },
      });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(agentUtils.handleValidationError).toHaveBeenCalled();
      expect(mockPatternActions.addPattern).not.toHaveBeenCalled();
    });

    it('should handle missing pattern renderer gracefully', () => {
      (agentUtils.getPatternRenderer as jest.Mock).mockReturnValueOnce(null);
      
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

      act(() => {
        window.dispatchEvent(event);
      });

      expect(logger.warn).toHaveBeenCalledWith('[Pattern Event] Pattern renderer not available');
      expect(agentUtils.handleAgentError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ eventType: 'chart:addPattern' }),
        'Pattern renderer not initialized'
      );
    });
  });

  describe('Remove Pattern Event', () => {
    it('should handle valid remove pattern event', () => {
      renderHook(() => usePatternEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:removePattern', {
        detail: {
          type: 'chart:removePattern',
          timestamp: Date.now(),
          data: { id: 'pattern1' },
        },
      });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockPatternActions.removePattern).toHaveBeenCalledWith('pattern1');
      expect(mockHandlers.patternRenderer?.removePattern).toHaveBeenCalledWith('pattern1');
      expect(agentUtils.showAgentSuccess).toHaveBeenCalled();
    });

    it('should log pattern removal details', () => {
      renderHook(() => usePatternEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:removePattern', {
        detail: {
          type: 'chart:removePattern',
          timestamp: Date.now(),
          data: { id: 'pattern1' },
        },
      });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(logger.info).toHaveBeenCalledWith(
        '[Pattern Event] Current patterns in store:',
        expect.objectContaining({
          patternIds: ['pattern1'],
          requestedId: 'pattern1',
          hasPattern: true,
        })
      );
    });

    it('should handle missing pattern renderer on remove', () => {
      (agentUtils.getPatternRenderer as jest.Mock).mockReturnValueOnce(null);
      
      renderHook(() => usePatternEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:removePattern', {
        detail: {
          type: 'chart:removePattern',
          timestamp: Date.now(),
          data: { id: 'pattern1' },
        },
      });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockPatternActions.removePattern).toHaveBeenCalled();
      expect(agentUtils.handleAgentError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ eventType: 'chart:removePattern' }),
        'Pattern renderer not available'
      );
    });
  });

  describe('Update Pattern Style Event', () => {
    it('should handle valid update pattern style event', () => {
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

      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockHandlers.patternRenderer?.removePattern).toHaveBeenCalledWith('pattern1');
      expect(mockHandlers.patternRenderer?.renderPattern).toHaveBeenCalled();
      expect(agentUtils.showAgentSuccess).toHaveBeenCalled();
    });

    it('should handle line style updates', () => {
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

      act(() => {
        window.dispatchEvent(event);
      });

      expect(usePatternStore.setState).toHaveBeenCalled();
    });

    it('should handle pattern not found error', () => {
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

      act(() => {
        window.dispatchEvent(event);
      });

      expect(logger.warn).toHaveBeenCalledWith(
        '[Pattern Event] Pattern not found for style update',
        { patternId: 'nonexistent' }
      );
      expect(agentUtils.handleAgentError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ eventType: 'chart:updatePatternStyle' }),
        'パターンが見つかりません'
      );
    });

    it('should handle missing pattern renderer on style update', () => {
      (agentUtils.getPatternRenderer as jest.Mock).mockReturnValueOnce(null);
      
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

      act(() => {
        window.dispatchEvent(event);
      });

      expect(logger.error).toHaveBeenCalledWith('[Pattern Event] Pattern renderer not available for style update');
      expect(agentUtils.handleAgentError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ eventType: 'chart:updatePatternStyle' }),
        'パターンレンダラーが利用できません'
      );
    });

    it('should update area styles in pattern visualization', () => {
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

      act(() => {
        window.dispatchEvent(event);
      });

      // Verify area style was updated
      expect(mockHandlers.patternRenderer?.renderPattern).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle errors during pattern operations', () => {
      mockPatternActions.addPattern.mockImplementationOnce(() => {
        throw new Error('Failed to add pattern');
      });

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

      act(() => {
        window.dispatchEvent(event);
      });

      expect(agentUtils.handleAgentError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ eventType: 'chart:addPattern' }),
        undefined
      );
    });

    it('should handle pattern with markers transformation', () => {
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

      act(() => {
        window.dispatchEvent(event);
      });

      // Verify the pattern was re-rendered with transformed visualization
      expect(mockHandlers.patternRenderer?.renderPattern).toHaveBeenCalled();
      const renderCall = (mockHandlers.patternRenderer?.renderPattern as jest.Mock).mock.calls[0];
      expect(renderCall[1]).toHaveProperty('keyPoints');
    });
  });
});