/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useApproveProposal } from '../../../../hooks/chat/use-approve-proposal';
import * as analysishistorystore from '../../../store/analysis-history.store';
import * as chatstore from '../../../store/chat.store';
import * as proposalapprovalstore from '../../../store/proposal-approval.store';
import * as uieventstore from '../../../store/ui-event.store';
import { toast } from '../../../../lib/notifications/toast';
import { logger } from '../../../../lib/utils/logger';
import { proposals } from '../../../types/proposals';
import { enums } from '../../../types/enums';

// Mock dependencies
jest.mock('../../../../store/analysis-history.store');
jest.mock('../../../../store/chat.store');
jest.mock('../../../../store/proposal-approval.store');
jest.mock('../../../../store/ui-event.store');
jest.mock('../../../../lib/notifications/toast');
jest.mock('../../../../lib/utils/logger');

// Mock window.dispatchEvent
const mockDispatchEvent = jest.fn();
Object.defineProperty(window, 'dispatchEvent', {
  value: mockDispatchEvent,
});

const mockAnalysisActions = {
  addRecord: jest.fn(),
};

const mockAddApprovedDrawing = jest.fn();

const mockPublish = jest.fn();

const mockProposalGroup: DrawingProposalGroup = {
  id: 'group-1',
  title: 'Test Group',
  description: 'Test Description',
  createdAt: Date.now(),
  groupType: 'analysis',
  proposals: [
    {
      id: 'proposal-1',
      type: ProposalType.TRENDLINE,
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
      priority: 'medium',
      status: ProposalStatus.PENDING,
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
    
    (useAnalysisActions as jest.Mock).mockReturnValue(mockAnalysisActions);
    (useChat as jest.Mock).mockReturnValue({ currentSessionId: 'session-1' });
    (useAddApprovedDrawing as jest.Mock).mockReturnValue(mockAddApprovedDrawing);
    (useUIEventPublisher as jest.Mock).mockReturnValue({ publish: mockPublish });
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
            ...mockProposalGroup.proposals[0],
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
            id: 'proposal-2',
            type: ProposalType.TRENDLINE,
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
            status: ProposalStatus.PENDING,
            createdAt: Date.now(),
            symbol: 'BTCUSDT',
            interval: '1h',
            drawingData: {
              type: ProposalType.TRENDLINE,
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
            id: 'proposal-1',
            type: ProposalType.TRENDLINE,
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
            status: ProposalStatus.PENDING,
            createdAt: Date.now(),
            symbol: 'BTCUSDT',
            interval: '1h',
            drawingData: {
              type: ProposalType.TRENDLINE,
              points: [
                { time: 1000, value: 100 },
                { time: 2000, value: 200 },
              ],
            },
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
