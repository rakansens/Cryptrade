/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';

// Mock all dependencies
const mockAddRecord = jest.fn();
const mockAddApprovedDrawing = jest.fn();
const mockPublish = jest.fn();
const mockShowProposalApprovalSuccess = jest.fn();
const mockShowProposalApprovalError = jest.fn();

jest.mock('@/store/analysis-history.store', () => ({
  useAnalysisActions: () => ({ addRecord: mockAddRecord })
}));

jest.mock('@/store/chat.store', () => ({
  useChat: () => ({ currentSessionId: 'session-1' })
}));

jest.mock('@/store/proposal-approval.store', () => ({
  useAddApprovedDrawing: () => mockAddApprovedDrawing
}));

jest.mock('@/store/ui-event.store', () => ({
  useUIEventPublisher: () => ({ publish: mockPublish })
}));

jest.mock('@/lib/notifications/toast', () => ({
  showProposalApprovalSuccess: mockShowProposalApprovalSuccess,
  showProposalApprovalError: mockShowProposalApprovalError
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { error: jest.fn() }
}));

// Import after mocking
import { useApproveProposal } from '@/hooks/chat/use-approve-proposal';

// Mock types and data
const mockProposalGroup = {
  id: 'group-1',
  title: 'Test Group',
  description: 'Test Description',
  createdAt: Date.now(),
  groupType: 'analysis' as const,
  proposals: [
    {
      id: 'proposal-1',
      type: 'trendline' as const,
      analysisType: 'trendline' as const,
      coordinates: {
        start: { x: 1000, y: 100 },
        end: { x: 2000, y: 200 }
      },
      confidence: 0.8,
      title: 'Test Trendline',
      description: 'Test trendline',
      reason: 'Test reasoning',
      reasoning: 'Test reasoning',
      priority: 'medium' as const,
      status: 'pending' as const,
      createdAt: Date.now(),
      drawingData: {
        type: 'trendline',
        points: [
          { time: 1000, value: 100 },
          { time: 2000, value: 200 },
        ],
      },
    },
  ],
};

const mockProposalMessage = {
  id: 'message-1',
  role: 'assistant' as const,
  content: 'Test proposal',
  type: 'proposal' as const,
  timestamp: Date.now(),
  proposalGroup: mockProposalGroup,
};

describe('useApproveProposal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should approve a proposal successfully', async () => {
    const { result } = renderHook(() => useApproveProposal());

    await act(async () => {
      await result.current.approveProposal(mockProposalMessage, 'proposal-1');
    });

    expect(mockAddApprovedDrawing).toHaveBeenCalledWith(
      'message-1',
      'proposal-1',
      expect.stringContaining('proposal-1_'),
      'drawing'
    );

    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ui:proposal-action',
        detail: expect.objectContaining({
          action: 'approve',
          proposalId: 'proposal-1',
        }),
      })
    );

    expect(mockShowProposalApprovalSuccess).toHaveBeenCalledWith('BTCUSDT', 'trendline');
  });

  it('should handle approval errors gracefully', async () => {
    const { result } = renderHook(() => useApproveProposal());
    
    const invalidMessage = {
      ...mockProposalMessage,
      proposalGroup: {
        ...mockProposalMessage.proposalGroup,
        proposals: [
          {
            ...mockProposalGroup.proposals[0],
            drawingData: null,
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

    expect(mockShowProposalApprovalError).toHaveBeenCalled();
  });

  it('should approve all proposals in a group', async () => {
    const messageWithMultipleProposals = {
      ...mockProposalMessage,
      proposalGroup: {
        ...mockProposalMessage.proposalGroup,
        proposals: [
          mockProposalMessage.proposalGroup.proposals[0],
          {
            id: 'proposal-2',
            type: 'trendline' as const,
            analysisType: 'trendline' as const,
            coordinates: {
              start: { x: 1000, y: 100 },
              end: { x: 2000, y: 200 }
            },
            confidence: 0.8,
            title: 'Test Trendline 2',
            description: 'Test trendline 2',
            reason: 'Test reasoning 2',
            reasoning: 'Test reasoning 2',
            priority: 'medium' as const,
            status: 'pending' as const,
            createdAt: Date.now(),
            symbol: 'BTCUSDT',
            interval: '1h',
            drawingData: {
              type: 'trendline',
              points: [
                { time: 1000, value: 100 },
                { time: 2000, value: 200 },
              ],
            },
          },
        ],
      },
    };

    const { result } = renderHook(() => useApproveProposal());

    await act(async () => {
      await result.current.approveAllProposals(messageWithMultipleProposals as any);
    });

    expect(mockAddApprovedDrawing).toHaveBeenCalledTimes(2);
    expect(mockShowProposalApprovalSuccess).toHaveBeenCalledTimes(2);
  });
});
