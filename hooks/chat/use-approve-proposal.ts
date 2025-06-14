'use client';

import { useCallback } from 'react';
import { useAnalysisActions } from '@/store/analysis-history.store';
import { useChat } from '@/store/chat.store';
import { useAddApprovedDrawing } from '@/store/proposal-approval.store';
import { useUIEventPublisher } from '@/store/ui-event.store';
import { useAsyncState } from '@/hooks/base/use-async-state';
import { validateDrawingData } from '@/schema/drawing';
import { ExtendedProposalSchema, type ProposalMessage } from '@/types/proposal';
import { createChartEvent } from '@/types/events/chart-events';
import { showProposalApprovalSuccess, showProposalApprovalError } from '@/lib/notifications/toast';
import { logger } from '@/lib/utils/logger';
import type { AnalysisRecord } from '@/types/analysis-history';
import type { EnhancedProposalActionEvent } from '@/types/proposal';

/**
 * Hook for handling proposal approval logic
 */
export function useApproveProposal() {
  const { addRecord: addAnalysisRecord } = useAnalysisActions();
  const { currentSessionId } = useChat();
  const addApprovedDrawing = useAddApprovedDrawing();
  const { publish } = useUIEventPublisher();

  const approveAsync = useCallback(async (message: ProposalMessage, proposalId: string) => {
    if (!message.proposalGroup || !publish || !currentSessionId) {
      logger.error('[ApproveProposal] Missing required data for proposal approval', {
        hasMessage: !!message,
        hasProposalGroup: !!message?.proposalGroup,
        hasPublish: !!publish,
        hasSessionId: !!currentSessionId,
        messageId: message?.id,
        proposalId
      });
      throw new Error('Missing required data for proposal approval');
    }

    if (!proposalId) {
      logger.error('[ApproveProposal] proposalId is required but was not provided', {
        messageId: message.id,
        proposalGroupId: message.proposalGroup.id
      });
      throw new Error('Proposal ID is required');
    }

    const proposalData = message.proposalGroup.proposals.find(p => p.id === proposalId);
    if (!proposalData) {
      logger.error('[ApproveProposal] Proposal not found', { proposalId });
      throw new Error('Proposal not found');
    }

    // Extract symbol and interval from proposal group title/description or use defaults
    const extractSymbolFromTitle = (title: string): string => {
      const symbolMatch = title.match(/([A-Z]{3,}USDT?|[A-Z]{3,}USD)/);
      return symbolMatch?.[1] || 'BTCUSDT';
    };

    const extractIntervalFromDescription = (description: string): string => {
      const intervalMatch = description.match(/(\d+[mhd])/);
      return intervalMatch?.[1] || '1h';
    };

    // Construct proposal with context from message
    const proposal = {
      ...proposalData,
      symbol: extractSymbolFromTitle(message.proposalGroup.title),
      interval: extractIntervalFromDescription(message.proposalGroup.description),
    };
    logger.info('[ApproveProposal] Approving proposal', { proposalId, type: proposal.type });

    // Validate the drawing data
    const validatedData = validateDrawingData(proposal.drawingData);

    // Create a unique drawing ID for this approval
    const drawingId = `${proposalId}_${Date.now()}`;
    
    let chartEvent;
    
    // Use different event types for patterns vs drawings
    if (validatedData.type === 'pattern') {
      // Pattern events require addPattern with specific structure
      chartEvent = createChartEvent('addPattern', {
        id: drawingId,
        pattern: {
          type: validatedData.metadata?.patternType || 'unknown',
          visualization: {
            keyPoints: validatedData.points.map(point => ({
              time: point.time,
              value: point.value,
              type: point.type || 'pattern-point',
              label: point.label || ''
            })),
            lines: validatedData.metadata?.lines || [],
            areas: validatedData.metadata?.areas || []
          },
          metrics: validatedData.metadata || {},
          trading_implication: validatedData.metadata?.tradingImplication || 'neutral',
          confidence: proposal.confidence || 0.5
        }
      });
    } else {
      // Regular drawing events
      chartEvent = createChartEvent('addDrawingWithMetadata', {
        id: drawingId,
        type: validatedData.type,
        points: validatedData.points,
        style: validatedData.style || {},
        price: validatedData.price,
        time: validatedData.time,
        levels: validatedData.levels,
        visible: true,
        interactive: true,
        metadata: {
          symbol: proposal.symbol,
          interval: proposal.interval,
          proposalId: proposalId,
          proposalGroup: message.proposalGroup.id,
          approvedAt: new Date().toISOString()
        }
      });
    }

    // Dispatch the drawing creation event directly to the window
    if (typeof window !== 'undefined') {
      window.dispatchEvent(chartEvent);
      logger.info('[ApproveProposal] Drawing added to chart', { eventType: chartEvent.type, drawingId });
    } else {
      // If on server, publish through SSE
      publish(chartEvent);
    }

    // Update approved drawing IDs in store
    addApprovedDrawing(
      message.id, 
      proposalId, 
      drawingId, 
      validatedData.type === 'pattern' ? 'pattern' : 'drawing'
    );

    // Create analysis record if ML prediction exists
    if (proposal.mlPrediction && proposal.mlPrediction.successProbability !== undefined) {
      const analysisRecord: Omit<AnalysisRecord, 'id'> = {
        proposalId,
        sessionId: currentSessionId,
        timestamp: Date.now(),
        symbol: proposal.symbol,
        interval: proposal.interval,
        type: validatedData.type === 'horizontal' ? 
          (proposal.mlPrediction.direction === 'up' ? 'support' : 'resistance') : 
          validatedData.type === 'trendline' ? 'trendline' : 
          validatedData.type === 'fibonacci' ? 'fibonacci' : 'pattern',
        proposal: {
          confidence: proposal.confidence,
          price: proposal.drawingData.points[0]?.value,
          mlPrediction: {
            successProbability: proposal.mlPrediction.successProbability,
            expectedBounces: proposal.mlPrediction.expectedBounces,
            reasoning: proposal.mlPrediction.reasoning
          },
          drawingData: proposal.drawingData
        },
        tracking: {
          status: 'active',
          startTime: Date.now(),
          touches: []
        }
      };
      
      addAnalysisRecord(analysisRecord);
      logger.info('[ApproveProposal] Analysis record created', { proposalId });
    }

    // Publish approval event  
    const approvalEvent: EnhancedProposalActionEvent = {
      type: 'ui:proposal-action',
      timestamp: Date.now(),
      payload: {
        action: 'approve',
        proposalId: proposalId,
        proposalGroupId: message.proposalGroup.id,
        drawingId: drawingId,
        symbol: proposal.symbol,
        interval: proposal.interval
      }
    };
    
    publish(approvalEvent);

    // Show success notification
    showProposalApprovalSuccess(proposal.symbol, proposal.type || validatedData.type);

  }, [publish, currentSessionId, addAnalysisRecord, addApprovedDrawing]);

  const {
    execute: approveProposal,
    loading: approveLoading,
    error: approveError,
  } = useAsyncState(async (message: ProposalMessage, proposalId: string) => {
    try {
      return await approveAsync(message, proposalId);
    } catch (error) {
      logger.error('[ApproveProposal] Failed to approve proposal', error);
      showProposalApprovalError(error as Error);
      throw error;
    }
  });

  const approveAllProposals = useCallback(async (message: ProposalMessage) => {
    if (!message.proposalGroup) {
      logger.warn('[ApproveProposal] No proposal group found for approve all');
      return;
    }
    
    logger.info('[ApproveProposal] Approving all proposals', { 
      groupId: message.proposalGroup.id,
      count: message.proposalGroup.proposals.length 
    });
    
    // Approve all proposals sequentially to avoid race conditions
    for (const proposal of message.proposalGroup.proposals) {
      try {
        await approveProposal(message, proposal.id);
      } catch (error) {
        logger.error('[ApproveProposal] Failed to approve proposal in batch', { 
          proposalId: proposal.id, 
          error 
        });
        // Continue with other proposals even if one fails
      }
    }
  }, [approveProposal]);

  return {
    approveProposal,
    approveAllProposals,
    approveLoading,
    approveError,
  };
}