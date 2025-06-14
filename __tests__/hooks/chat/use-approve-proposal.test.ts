import { renderHook, act } from '@testing-library/react';
import { useApproveProposal } from '@/hooks/chat/use-approve-proposal';
import { useAnalysisActions } from '@/store/analysis-history.store';
import { useChat } from '@/store/chat.store';
import { useProposalApprovalActions } from '@/store/proposal-approval.store';
import { useUIEventPublisher } from '@/store/ui-event.store';
import { showProposalApprovalSuccess, showProposalApprovalError } from '@/lib/notifications/toast';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/store/analysis-history.store');
jest.mock('@/store/chat.store');
jest.mock('@/store/proposal-approval.store');
jest.mock('@/store/ui-event.store');
jest.mock('@/lib/notifications/toast');
jest.mock('@/lib/utils/logger');

// Mock window.dispatchEvent
const mockDispatchEvent = jest.fn();
Object.defineProperty(window, 'dispatchEvent', {
  value: mockDispatchEvent,
});

const mockAnalysisActions = {
  addRecord: jest.fn(),
};

const mockApprovalActions = {
  addApprovedDrawing: jest.fn(),
};

const mockPublish = jest.fn();

const mockProposalMessage = {
  id: 'message-1',
  role: 'assistant' as const,
  content: 'Test proposal',
  type: 'proposal' as const,
  timestamp: Date.now(),
  proposalGroup: {
    id: 'group-1',
    title: 'Test Group',
    description: 'Test Description',
    status: 'pending' as const,
    createdAt: Date.now(),
    proposals: [
      {
        id: 'proposal-1',
        type: 'trendline' as const,
        confidence: 0.8,
        description: 'Test trendline',
        symbol: 'BTCUSDT',
        interval: '1h',
        reasoning: 'Test reasoning',
        drawingData: {
          type: 'trendline' as const,
          points: [
            { time: 1000, value: 100 },
            { time: 2000, value: 200 },
          ],
        },
      },
    ],
  },
};

describe('useApproveProposal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    (useAnalysisActions as jest.Mock).mockReturnValue(mockAnalysisActions);
    (useChat as jest.Mock).mockReturnValue({ currentSessionId: 'session-1' });
    (useProposalApprovalActions as jest.Mock).mockReturnValue(mockApprovalActions);
    (useUIEventPublisher as jest.Mock).mockReturnValue({ publish: mockPublish });
  });

  it('should approve a proposal successfully', async () => {
    const { result } = renderHook(() => useApproveProposal());

    await act(async () => {
      await result.current.approveProposal(mockProposalMessage, 'proposal-1');
    });

    expect(mockApprovalActions.addApprovedDrawing).toHaveBeenCalledWith(
      'message-1',
      'proposal-1',
      expect.stringContaining('proposal-1_'),
      'drawing'
    );

    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ui:proposal-action',
        payload: expect.objectContaining({
          action: 'approve',
          proposalId: 'proposal-1',
        }),
      })
    );

    expect(showProposalApprovalSuccess).toHaveBeenCalledWith('BTCUSDT', 'trendline');
    expect(mockDispatchEvent).toHaveBeenCalled();
  });

  it('should handle approval errors gracefully', async () => {
    // Mock validation error
    const { result } = renderHook(() => useApproveProposal());
    
    const invalidMessage = {
      ...mockProposalMessage,
      proposalGroup: {
        ...mockProposalMessage.proposalGroup,
        proposals: [
          {
            ...mockProposalMessage.proposalGroup.proposals[0],
            drawingData: null, // Invalid data
          },
        ],
      },
    };

    await act(async () => {
      try {
        await result.current.approveProposal(invalidMessage as any, 'proposal-1');
      } catch (error) {
        // Expected to throw
      }
    });

    expect(showProposalApprovalError).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('should approve all proposals in a group', async () => {
    const messageWithMultipleProposals = {
      ...mockProposalMessage,
      proposalGroup: {
        ...mockProposalMessage.proposalGroup,
        proposals: [
          mockProposalMessage.proposalGroup.proposals[0],
          {
            ...mockProposalMessage.proposalGroup.proposals[0],
            id: 'proposal-2',
          },
        ],
      },
    };

    const { result } = renderHook(() => useApproveProposal());

    await act(async () => {
      await result.current.approveAllProposals(messageWithMultipleProposals);
    });

    expect(mockApprovalActions.addApprovedDrawing).toHaveBeenCalledTimes(2);
    expect(showProposalApprovalSuccess).toHaveBeenCalledTimes(2);
  });

  it('should handle missing required data', async () => {
    (useChat as jest.Mock).mockReturnValue({ currentSessionId: null });
    const { result } = renderHook(() => useApproveProposal());

    await act(async () => {
      try {
        await result.current.approveProposal(mockProposalMessage, 'proposal-1');
      } catch (error) {
        expect(error).toEqual(expect.any(Error));
      }
    });

    expect(logger.error).toHaveBeenCalledWith(
      '[ApproveProposal] Missing required data for proposal approval',
      expect.any(Object)
    );
  });

  it('should create analysis record for proposals with ML prediction', async () => {
    const proposalWithML = {
      ...mockProposalMessage,
      proposalGroup: {
        ...mockProposalMessage.proposalGroup,
        proposals: [
          {
            ...mockProposalMessage.proposalGroup.proposals[0],
            mlPrediction: {
              successProbability: 0.75,
              expectedBounces: 3,
              direction: 'up' as const,
              reasoning: [],
            },
            targets: [110, 120],
            stopLoss: 95,
          },
        ],
      },
    };

    const { result } = renderHook(() => useApproveProposal());

    await act(async () => {
      await result.current.approveProposal(proposalWithML, 'proposal-1');
    });

    expect(mockAnalysisActions.addRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'BTCUSDT',
        interval: '1h',
        type: 'trendline',
        proposal: expect.objectContaining({
          mlPrediction: expect.objectContaining({
            direction: 'up',
            successProbability: 0.75,
          }),
        }),
      })
    );
  });
});