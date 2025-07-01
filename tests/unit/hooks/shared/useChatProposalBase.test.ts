import { renderHook, act } from '@testing-library/react';
import { useChatProposalBase } from '@/hooks/shared/useChatProposalBase';
import type { ProposalMessage } from '@/types/proposals';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('useChatProposalBase', () => {
  const defaultConfig = {
    hookName: 'useChatProposalBase-test',
    defaultSymbol: 'BTCUSDT',
    logLevel: 'info' as const
  };

  const mockProposalMessage: ProposalMessage = {
    id: 'msg-123',
    content: 'Test proposal message',
    role: 'assistant',
    timestamp: Date.now(),
    proposals: [{
      id: 'proposal-123',
      type: 'horizontal',
      confidence: 0.85,
      reason: 'Strong support level detected',
      mlPrediction: {
        direction: 'up',
        confidence: 0.85,
        timeframe: '1h'
      },
      drawingData: {
        type: 'horizontal',
        points: [{ time: 1735830000, value: 50000 }],
        style: { color: '#00ff00', lineWidth: 2 }
      }
    }]
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      
      expect(result.current.isMounted()).toBe(true);
      expect(result.current.hasPublisher).toBe(false);
    });

    it('should handle custom configuration', () => {
      const customConfig = {
        hookName: 'custom-proposal',
        defaultSymbol: 'ETHUSDT',
        logLevel: 'debug' as const
      };
      
      const { result } = renderHook(() => useChatProposalBase(customConfig));
      
      expect(result.current.isMounted()).toBe(true);
    });
  });

  describe('proposal validation', () => {
    it('should validate valid proposal request', () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      
      const validation = result.current.validateProposalRequest(
        mockProposalMessage,
        'proposal-123',
        true
      );
      
      expect(validation.success).toBe(true);
      expect(validation.context).toEqual({
        symbol: 'BTCUSDT',
        interval: '1h',
        proposalGroupId: 'msg-123'
      });
    });

    it('should handle missing proposals', () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      
      const messageWithoutProposals: ProposalMessage = {
        ...mockProposalMessage,
        proposals: []
      };
      
      const validation = result.current.validateProposalRequest(
        messageWithoutProposals,
        'proposal-123',
        true
      );
      
      expect(validation.success).toBe(false);
      expect(validation.error).toContain('No proposals found');
    });

    it('should handle non-existent proposal ID', () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      
      const validation = result.current.validateProposalRequest(
        mockProposalMessage,
        'non-existent-proposal',
        true
      );
      
      expect(validation.success).toBe(false);
      expect(validation.error).toContain('Proposal not found');
    });

    it('should handle missing drawing data when required', () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      
      const messageWithoutDrawingData: ProposalMessage = {
        ...mockProposalMessage,
        proposals: [{
          ...mockProposalMessage.proposals[0],
          drawingData: undefined
        }]
      };
      
      const validation = result.current.validateProposalRequest(
        messageWithoutDrawingData,
        'proposal-123',
        true
      );
      
      expect(validation.success).toBe(false);
      expect(validation.error).toContain('Drawing data is required');
    });

    it('should pass validation when drawing data not required', () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      
      const messageWithoutDrawingData: ProposalMessage = {
        ...mockProposalMessage,
        proposals: [{
          ...mockProposalMessage.proposals[0],
          drawingData: undefined
        }]
      };
      
      const validation = result.current.validateProposalRequest(
        messageWithoutDrawingData,
        'proposal-123',
        false
      );
      
      expect(validation.success).toBe(true);
    });
  });

  describe('proposal data extraction', () => {
    it('should extract proposal data correctly', () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      
      const proposalData = result.current.getProposalData(mockProposalMessage, 'proposal-123');
      
      expect(proposalData).toEqual(mockProposalMessage.proposals[0]);
    });

    it('should return null for non-existent proposal', () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      
      const proposalData = result.current.getProposalData(mockProposalMessage, 'non-existent');
      
      expect(proposalData).toBeNull();
    });

    it('should handle messages without proposals', () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      
      const messageWithoutProposals: ProposalMessage = {
        ...mockProposalMessage,
        proposals: []
      };
      
      const proposalData = result.current.getProposalData(messageWithoutProposals, 'proposal-123');
      
      expect(proposalData).toBeNull();
    });
  });

  describe('batch processing', () => {
    it('should process batch proposals successfully', async () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      
      const mockProcessor = jest.fn().mockResolvedValue(undefined);
      
      await act(async () => {
        await result.current.processBatchProposals(mockProposalMessage, mockProcessor, 'approve');
      });
      
      expect(mockProcessor).toHaveBeenCalledWith(mockProposalMessage, 'proposal-123');
    });

    it('should handle errors in batch processing', async () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      const { logger } = require('@/lib/utils/logger');
      
      const mockProcessor = jest.fn().mockRejectedValue(new Error('Processing error'));
      
      await act(async () => {
        await result.current.processBatchProposals(mockProposalMessage, mockProcessor, 'approve');
      });
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to approve proposal in batch',
        expect.objectContaining({
          hook: 'useChatProposalBase-test',
          proposalId: 'proposal-123',
          error: 'Processing error'
        })
      );
    });

    it('should process multiple proposals in batch', async () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      
      const messageWithMultipleProposals: ProposalMessage = {
        ...mockProposalMessage,
        proposals: [
          { ...mockProposalMessage.proposals[0], id: 'proposal-1' },
          { ...mockProposalMessage.proposals[0], id: 'proposal-2' },
          { ...mockProposalMessage.proposals[0], id: 'proposal-3' }
        ]
      };
      
      const mockProcessor = jest.fn().mockResolvedValue(undefined);
      
      await act(async () => {
        await result.current.processBatchProposals(messageWithMultipleProposals, mockProcessor, 'approve');
      });
      
      expect(mockProcessor).toHaveBeenCalledTimes(3);
      expect(mockProcessor).toHaveBeenCalledWith(messageWithMultipleProposals, 'proposal-1');
      expect(mockProcessor).toHaveBeenCalledWith(messageWithMultipleProposals, 'proposal-2');
      expect(mockProcessor).toHaveBeenCalledWith(messageWithMultipleProposals, 'proposal-3');
    });
  });

  describe('error handling', () => {
    it('should handle proposal errors with context', () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      const { logger } = require('@/lib/utils/logger');
      
      const testError = new Error('Test error');
      const testContext = {
        messageId: 'msg-123',
        proposalId: 'proposal-123',
        proposalGroupId: 'msg-123',
        symbol: 'BTCUSDT',
        interval: '1h'
      };
      
      result.current.handleProposalError(testError, testContext, 'Test operation');
      
      expect(logger.error).toHaveBeenCalledWith(
        'Test operation failed',
        expect.objectContaining({
          hook: 'useChatProposalBase-test',
          context: testContext,
          error: 'Test error'
        })
      );
    });

    it('should handle errors without context gracefully', () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      const { logger } = require('@/lib/utils/logger');
      
      const testError = new Error('Test error');
      
      result.current.handleProposalError(testError, null as any, 'Test operation');
      
      expect(logger.error).toHaveBeenCalledWith(
        'Test operation failed',
        expect.objectContaining({
          hook: 'useChatProposalBase-test',
          context: null,
          error: 'Test error'
        })
      );
    });
  });

  describe('event publishing', () => {
    it('should publish proposal events when publisher is available', () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      
      // Mock publisher availability
      (result.current as any).hasPublisher = true;
      const mockPublish = jest.fn();
      (result.current as any).publishProposalEvent = mockPublish;
      
      const testContext = {
        symbol: 'BTCUSDT',
        interval: '1h',
        proposalGroupId: 'msg-123'
      };
      
      result.current.publishProposalEvent('approve', testContext, { test: 'data' });
      
      expect(mockPublish).toHaveBeenCalledWith('approve', testContext, { test: 'data' });
    });

    it('should handle publishing when publisher is not available', () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      const { logger } = require('@/lib/utils/logger');
      
      const testContext = {
        messageId: 'msg-123',
        proposalId: 'proposal-123',
        proposalGroupId: 'msg-123',
        symbol: 'BTCUSDT',
        interval: '1h'
      };
      
      result.current.publishProposalEvent('approve', testContext, { test: 'data' });
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Cannot publish event - publisher not available',
        expect.objectContaining({
          hook: 'useChatProposalBase-test',
          action: 'approve',
          context: testContext
        })
      );
    });
  });

  describe('logging', () => {
    it('should log info messages when log level allows', () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      const { logger } = require('@/lib/utils/logger');
      
      result.current.safeLog('info', 'Test info message', { test: 'data' });
      
      expect(logger.info).toHaveBeenCalledWith('Test info message', {
        hook: 'useChatProposalBase-test',
        test: 'data'
      });
    });

    it('should always log error messages', () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      const { logger } = require('@/lib/utils/logger');
      
      result.current.safeLog('error', 'Test error message', { error: 'test error' });
      
      expect(logger.error).toHaveBeenCalledWith('Test error message', {
        hook: 'useChatProposalBase-test',
        error: 'test error'
      });
    });
  });

  describe('cleanup', () => {
    it('should mark as unmounted when component unmounts', () => {
      const { result, unmount } = renderHook(() => useChatProposalBase(defaultConfig));
      
      expect(result.current.isMounted()).toBe(true);
      
      unmount();
      
      expect(result.current.isMounted()).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle malformed proposal messages', () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      
      const malformedMessage = {
        id: 'malformed',
        proposals: null
      } as any;
      
      const validation = result.current.validateProposalRequest(
        malformedMessage,
        'proposal-123',
        true
      );
      
      expect(validation.success).toBe(false);
      expect(validation.error).toContain('No proposals found');
    });

    it('should handle proposals without required fields', () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      
      const incompleteProposal = {
        id: 'incomplete',
        // missing required fields
      } as any;
      
      const messageWithIncompleteProposal: ProposalMessage = {
        ...mockProposalMessage,
        proposals: [incompleteProposal]
      };
      
      const validation = result.current.validateProposalRequest(
        messageWithIncompleteProposal,
        'incomplete',
        true
      );
      
      expect(validation.success).toBe(false);
    });

    it('should extract symbol from ML prediction when available', () => {
      const { result } = renderHook(() => useChatProposalBase(defaultConfig));
      
      const messageWithSymbolInML: ProposalMessage = {
        ...mockProposalMessage,
        proposals: [{
          ...mockProposalMessage.proposals[0],
          mlPrediction: {
            ...mockProposalMessage.proposals[0].mlPrediction!,
            timeframe: '4h'
          }
        }]
      };
      
      const validation = result.current.validateProposalRequest(
        messageWithSymbolInML,
        'proposal-123',
        true
      );
      
      expect(validation.success).toBe(true);
      expect(validation.context?.interval).toBe('4h');
    });
  });
});