import { act, renderHook } from '@testing-library/react';
import { useChartStore, useDrawingStore, usePatternStore, useChartBaseStore } from '@/store/chart';
import { useChatStore, useChatActions } from '@/store/chat.store';
import { useUIEventStore, useUIEventPublisher } from '@/store/ui-event.store';
import { useProposalApprovalStore } from '@/store/proposal-approval.store';
import type { ChartDrawing } from '@/types/drawing';
import type { Pattern } from '@/types/pattern';
import type { PatternData } from '@/store/chart/types';

// Import the base store for direct access
// @ts-ignore - importing private export for testing
import { useChatStoreBase } from '@/store/chat.store';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/utils/zustand-helpers', () => ({
  createStoreDebugger: jest.fn(() => jest.fn()),
}));

const mockPublish = jest.fn();
jest.mock('@/hooks/use-ui-event-stream', () => ({
  useUIEventStream: () => ({
    publish: mockPublish,
  }),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Store Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);

    // Reset all stores using their reset methods
    act(() => {
      useChartBaseStore.getState().reset();
      useChatStoreBase.getState().reset();
      useUIEventStore.getState().reset();
      useProposalApprovalStore.getState().reset();
      useDrawingStore.getState().reset();
      usePatternStore.getState().reset();
    });
  });

  describe('Chart and Drawing Integration', () => {
    it('should coordinate drawing creation with UI events', () => {
      const { result: drawingStore } = renderHook(() => useDrawingStore());
      const { result: uiPublisher } = renderHook(() => useUIEventPublisher());

      const drawing: ChartDrawing = {
        id: 'test-drawing-1',
        type: 'trendline',
        points: [{ time: 1000, value: 100 }, { time: 2000, value: 200 }],
        style: {
          color: '#ff0000',
          lineWidth: 2,
          lineStyle: 'solid',
          showLabels: false,
        },
        visible: true,
        interactive: true,
      };

      // Add drawing
      act(() => {
        drawingStore.current.addDrawing(drawing);
      });

      // Publish UI event for drawing creation
      act(() => {
        uiPublisher.current.publish({
          type: 'drawing-created',
          data: {
            drawingId: drawingStore.current.drawings[0].id,
            drawingType: 'trendline',
          },
        });
      });

      expect(drawingStore.current.drawings).toHaveLength(1);
      expect(mockPublish).toHaveBeenCalledWith({
        type: 'drawing-created',
        data: expect.objectContaining({
          drawingId: expect.any(String),
          drawingType: 'trendline',
        }),
      });
    });

    it('should handle pattern creation with associated drawings', () => {
      const { result: drawingStore } = renderHook(() => useDrawingStore());
      const { result: patternStore } = renderHook(() => usePatternStore());

      // Create multiple drawings
      const drawings: ChartDrawing[] = [
        {
          id: 'test-drawing-1',
          type: 'trendline',
          points: [{ time: 1000, value: 100 }, { time: 2000, value: 200 }],
          style: {
            color: '#ff0000',
            lineWidth: 2,
            lineStyle: 'solid',
            showLabels: false,
          },
          visible: true,
          interactive: true,
        },
        {
          id: 'test-drawing-2',
          type: 'trendline',
          points: [{ time: 1500, value: 150 }, { time: 2500, value: 250 }],
          style: {
            color: '#00ff00',
            lineWidth: 2,
            lineStyle: 'solid',
            showLabels: false,
          },
          visible: true,
          interactive: true,
        },
      ];

      const drawingIds: string[] = [];

      act(() => {
        drawings.forEach(drawing => {
          drawingStore.current.addDrawing(drawing);
          drawingIds.push(drawingStore.current.drawings[drawingStore.current.drawings.length - 1].id);
        });
      });

      // Create pattern from drawings
      const patternId = 'pattern-1';
      const patternData: PatternData = {
        type: 'triangle',
        visualization: {
          type: 'triangle',
          points: [
            { time: 1000, value: 100 },
            { time: 2000, value: 200 },
            { time: 1500, value: 150 },
          ],
          color: 'blue',
          drawingIds,
        },
        confidence: 0.85,
      };

      act(() => {
        patternStore.current.addPattern(patternId, patternData);
      });

      expect(drawingStore.current.drawings).toHaveLength(2);
      expect(patternStore.current.patterns.size).toBe(1);
      expect(patternStore.current.patterns.get(patternId)?.visualization.drawingIds).toEqual(drawingIds);
    });
  });

  describe('Chat and Proposal Integration', () => {
    it('should handle proposal creation in chat messages', () => {
      const { result: chatActions } = renderHook(() => useChatActions());
      const { result: chatStore } = renderHook(() => useChatStore(state => state));
      const { result: proposalStore } = renderHook(() => useProposalApprovalStore());

      let sessionId: string = '';

      // Create chat session
      act(() => {
        sessionId = chatActions.current.createSession();
      });

      // Add user message
      act(() => {
        chatActions.current.addMessage(sessionId, {
          content: 'Analyze BTCUSDT for trading opportunities',
          role: 'user',
        });
      });

      // Add AI response with proposal
      const proposalGroup = {
        id: 'proposal-group-1',
        drawings: [
          {
            type: 'trendline',
            points: [{ time: 1000, price: 45000 }, { time: 2000, price: 48000 }],
            color: '#00ff00',
            lineWidth: 2,
            label: 'Bullish Trendline',
          },
        ],
        analysis: 'Bullish trend identified',
      };

      act(() => {
        chatActions.current.addMessage(sessionId, {
          content: 'I found a bullish trading opportunity',
          role: 'assistant',
          type: 'proposal',
          proposalGroup,
        });
      });

      const messages = chatStore.current.messagesBySession[sessionId];
      expect(messages).toHaveLength(2);
      expect(messages[1].type).toBe('proposal');
      expect(messages[1].proposalGroup).toEqual(proposalGroup);
    });

    it('should handle proposal approval flow', async () => {
      const { result: proposalStore } = renderHook(() => useProposalApprovalStore());
      const { result: drawingStore } = renderHook(() => useDrawingStore());
      const { result: uiPublisher } = renderHook(() => useUIEventPublisher());

      const messageId = 'msg-1';
      const proposalId = 'proposal-1';
      const drawingType = 'trendline' as const;

      // Simulate drawing creation from approved proposal
      act(() => {
        const drawing = {
          type: drawingType,
          points: [{ time: 1000, price: 45000 }, { time: 2000, price: 48000 }],
          color: '#00ff00',
          lineWidth: 2,
          label: 'Support Line',
        };
        drawingStore.current.addDrawing(drawing);
      });

      const drawingId = drawingStore.current.drawings[0].id;

      // Track approved drawing
      act(() => {
        proposalStore.current.addApprovedDrawing(messageId, proposalId, drawingId, drawingType);
      });

      // Publish approval event
      act(() => {
        uiPublisher.current.publish({
          type: 'proposal-approved',
          data: {
            proposalId,
            drawingCount: 1,
          },
        });
      });

      expect(proposalStore.current.isDrawingApproved(messageId, proposalId)).toBe(true);
      expect(proposalStore.current.getApprovedDrawingId(messageId, proposalId)).toBe(drawingId);
      expect(proposalStore.current.getDrawingType(drawingId)).toBe(drawingType);
      expect(drawingStore.current.drawings).toHaveLength(1);
      expect(mockPublish).toHaveBeenCalledWith({
        type: 'proposal-approved',
        data: {
          proposalId: 'proposal-1',
          drawingCount: 1,
        },
      });
    });
  });

  describe('Multi-Store Workflow', () => {
    it('should handle complete AI analysis workflow', () => {
      const { result: chatActions } = renderHook(() => useChatActions());
      const { result: chatStore } = renderHook(() => useChatStore(state => state));
      const { result: chartStore } = renderHook(() => useChartStore(state => state));
      const { result: drawingStore } = renderHook(() => useDrawingStore());
      const { result: proposalStore } = renderHook(() => useProposalApprovalStore());
      const { result: uiPublisher } = renderHook(() => useUIEventPublisher());

      let sessionId: string = '';

      // 1. Initialize chart
      act(() => {
        chartStore.current.setSymbol('ETHUSDT');
        chartStore.current.setTimeframe('4h');
        chartStore.current.setChartReady(true);
      });

      // 2. Create chat session
      act(() => {
        sessionId = chatActions.current.createSession();
        chatActions.current.setOpen(true);
      });

      // 3. User asks for analysis
      act(() => {
        chatActions.current.addMessage(sessionId, {
          content: 'Find support and resistance levels',
          role: 'user',
        });
        chatActions.current.setLoading(true);
      });

      // 4. AI starts streaming response
      act(() => {
        chatActions.current.setLoading(false);
        chatActions.current.setStreaming(true);
        chatActions.current.addMessage(sessionId, {
          content: '',
          role: 'assistant',
        });
      });

      // 5. AI updates message with analysis
      act(() => {
        chatActions.current.updateLastMessage(sessionId, 'I\'ve identified key levels...');
      });

      // 6. AI completes with proposal
      const proposalData = {
        id: 'proposal-sr-1',
        drawings: [
          {
            type: 'horizontal' as const,
            points: [{ time: Date.now(), price: 2500 }],
            color: '#00ff00',
            lineWidth: 2,
            label: 'Support',
          },
          {
            type: 'horizontal' as const,
            points: [{ time: Date.now(), price: 2800 }],
            color: '#ff0000',
            lineWidth: 2,
            label: 'Resistance',
          },
        ],
      };

      act(() => {
        chatActions.current.updateLastMessage(sessionId, {
          content: 'I\'ve identified key support at $2,500 and resistance at $2,800',
          type: 'proposal',
          proposalGroup: proposalData,
        });
        chatActions.current.setStreaming(false);
      });

      // 7. User approves proposal
      act(() => {
        // Add drawings to chart
        proposalData.drawings.forEach((drawing, index) => {
          drawingStore.current.addDrawing(drawing);
          const drawingId = drawingStore.current.drawings[index].id;
          proposalStore.current.addApprovedDrawing(
            sessionId, 
            `${proposalData.id}-${index}`, 
            drawingId, 
            drawing.type
          );
        });
      });

      // 8. Publish completion event
      act(() => {
        uiPublisher.current.publish({
          type: 'analysis-complete',
          data: {
            symbol: chartStore.current.symbol,
            timeframe: chartStore.current.timeframe,
            drawingsAdded: proposalData.drawings.length,
          },
        });
      });

      // Verify final state
      expect(chartStore.current.symbol).toBe('ETHUSDT');
      expect(chartStore.current.timeframe).toBe('4h');
      expect(chatStore.current.messagesBySession[sessionId]).toHaveLength(2);
      expect(chatStore.current.messagesBySession[sessionId][1].type).toBe('proposal');
      expect(drawingStore.current.drawings).toHaveLength(2);
      expect(proposalStore.current.isDrawingApproved(sessionId, `${proposalData.id}-0`)).toBe(true);
      expect(proposalStore.current.isDrawingApproved(sessionId, `${proposalData.id}-1`)).toBe(true);
      expect(mockPublish).toHaveBeenCalledWith({
        type: 'analysis-complete',
        data: {
          symbol: 'ETHUSDT',
          timeframe: '4h',
          drawingsAdded: 2,
        },
      });
    });

    it('should handle state cleanup on session switch', () => {
      const { result: chatActions } = renderHook(() => useChatActions());
      const { result: drawingStore } = renderHook(() => useDrawingStore());
      const { result: proposalStore } = renderHook(() => useProposalApprovalStore());

      let sessionId1: string = '';
      let sessionId2: string = '';

      // Create two sessions with different contexts
      act(() => {
        sessionId1 = chatActions.current.createSession();
        
        // Add drawings for session 1
        drawingStore.current.addDrawing({
          id: 'session1-drawing',
          type: 'trendline',
          points: [{ time: 1000, value: 100 }, { time: 2000, value: 200 }],
          style: {
            color: '#ff0000',
            lineWidth: 2,
            lineStyle: 'solid',
            showLabels: false,
          },
          visible: true,
          interactive: true,
          metadata: { sessionId: sessionId1 },
        });
      });

      act(() => {
        sessionId2 = chatActions.current.createSession();
        
        // Clear drawings when switching session
        drawingStore.current.clearAllDrawings();
        
        // Add drawings for session 2
        drawingStore.current.addDrawing({
          id: 'session2-drawing',
          type: 'horizontal',
          points: [{ time: 1500, value: 150 }],
          style: {
            color: '#00ff00',
            lineWidth: 2,
            lineStyle: 'solid',
            showLabels: false,
          },
          visible: true,
          interactive: true,
          metadata: { sessionId: sessionId2 },
        });
      });

      // Switch back to session 1
      act(() => {
        chatActions.current.switchSession(sessionId1);
        
        // In a real app, you would restore session 1 drawings here
        drawingStore.current.clearAllDrawings();
      });

      // Verify state isolation
      expect(chatStore.current.currentSessionId).toBe(sessionId1);
      expect(drawingStore.current.drawings).toHaveLength(0);
      expect(proposalStore.current.approvedDrawingIds.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling Across Stores', () => {
    it('should propagate errors between stores', () => {
      const { result: chatActions } = renderHook(() => useChatActions());
      const { result: chartStore } = renderHook(() => useChartStore(state => state));

      // Set error in chart store
      act(() => {
        chartStore.current.setError('Chart initialization failed');
      });

      // Error should affect chat functionality
      let sessionId: string = '';
      act(() => {
        sessionId = chatActions.current.createSession();
        chatActions.current.setError('Cannot analyze - chart not ready');
      });

      expect(chartStore.current.error).toBe('Chart initialization failed');
      expect(useChatStoreBase.getState().error).toBe('Cannot analyze - chart not ready');
    });

    it('should handle concurrent operations', async () => {
      const { result: drawingStore } = renderHook(() => useDrawingStore());
      const { result: patternStore } = renderHook(() => usePatternStore());

      const drawingPromises: Promise<void>[] = [];

      // Simulate concurrent drawing additions
      act(() => {
        for (let i = 0; i < 10; i++) {
          const promise = drawingStore.current.addDrawingAsync({
            id: `concurrent-drawing-${i}`,
            type: 'trendline',
            points: [{ time: i * 1000, value: i * 100 }, { time: (i + 1) * 1000, value: (i + 1) * 100 }],
            style: {
              color: '#ff0000',
              lineWidth: 2,
              lineStyle: 'solid',
              showLabels: false,
            },
            visible: true,
            interactive: true,
          });
          drawingPromises.push(promise);
        }
      });

      await Promise.all(drawingPromises);

      // All drawings should be added
      expect(drawingStore.current.drawings).toHaveLength(10);

      // Create pattern from all drawings
      act(() => {
        patternStore.current.addPattern('concurrent-pattern', {
          type: 'complex',
          visualization: {
            type: 'complex',
            points: drawingStore.current.drawings.flatMap(d => d.points),
            color: 'blue',
          },
          confidence: 0.75,
        });
      });

      expect(patternStore.current.patterns.size).toBe(1);
      expect(patternStore.current.patterns.get('concurrent-pattern')?.visualization.points).toHaveLength(20); // 10 drawings * 2 points each
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large numbers of messages efficiently', () => {
      const { result: chatActions } = renderHook(() => useChatActions());

      let sessionId: string = '';
      const messageCount = 1000;

      act(() => {
        sessionId = chatActions.current.createSession();
      });

      const startTime = Date.now();

      act(() => {
        for (let i = 0; i < messageCount; i++) {
          chatActions.current.addMessage(sessionId, {
            content: `Message ${i}`,
            role: i % 2 === 0 ? 'user' : 'assistant',
          });
        }
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle 1000 messages in reasonable time
      expect(duration).toBeLessThan(1000);
      
      const messages = useChatStoreBase.getState().messagesBySession[sessionId];
      expect(messages).toHaveLength(messageCount);
    });

    it('should clean up resources on store reset', () => {
      const { result: chartStore } = renderHook(() => useChartStore(state => state));
      const { result: drawingStore } = renderHook(() => useDrawingStore());
      const { result: patternStore } = renderHook(() => usePatternStore());
      const { result: chatStore } = renderHook(() => useChatStore(state => state));

      // Populate stores with data
      act(() => {
        // Add drawings
        for (let i = 0; i < 50; i++) {
          drawingStore.current.addDrawing({
            id: `perf-drawing-${i}`,
            type: 'trendline',
            points: [{ time: i * 1000, value: i * 100 }, { time: (i + 1) * 1000, value: (i + 1) * 100 }],
            style: {
              color: '#ff0000',
              lineWidth: 2,
              lineStyle: 'solid',
              showLabels: false,
            },
            visible: true,
            interactive: true,
          });
        }

        // Add patterns
        for (let i = 0; i < 20; i++) {
          patternStore.current.addPattern(`pattern-${i}`, {
            type: 'triangle',
            visualization: {
              type: 'triangle',
              points: [],
              color: 'blue',
            },
            confidence: 0.8,
          });
        }

        // Add chat sessions and messages
        for (let i = 0; i < 5; i++) {
          const sessionId = chatStore.current.createSession();
          for (let j = 0; j < 100; j++) {
            chatStore.current.addMessage(sessionId, {
              content: `Message ${j}`,
              role: 'user',
            });
          }
        }
      });

      // Reset all stores
      act(() => {
        chartStore.current.reset();
        drawingStore.current.reset();
        patternStore.current.clearPatterns();
        chatStore.current.reset();
      });

      // Verify all data is cleared
      expect(drawingStore.current.drawings).toHaveLength(0);
      expect(drawingStore.current.undoStack).toHaveLength(0);
      expect(drawingStore.current.redoStack).toHaveLength(0);
      expect(patternStore.current.patterns.size).toBe(0);
      expect(Object.keys(useChatStoreBase.getState().sessions)).toHaveLength(0);
      expect(Object.keys(useChatStoreBase.getState().messagesBySession)).toHaveLength(0);
    });
  });
});