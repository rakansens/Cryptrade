'use client';

import { useCallback } from 'react';
import { useAnalysisActions } from '@/store/analysis-history.store';
import { useChat } from '@/store/chat.store';
import { useAddApprovedDrawing } from '@/store/proposal-approval.store';
import { useUIEventPublisher } from '@/store/ui-event.store';
import { useAsyncState } from '@/hooks/base/use-async-state';
import { validateDrawingData } from '@/schema/drawing';
import { type ProposalMessage } from '@/types/proposals';
import type { ExtendedProposal } from '@/types/proposals';
import { createChartEvent } from '@/types/events/chart-events';
import { showProposalApprovalSuccess, showProposalApprovalError } from '@/lib/notifications/toast';
import { logger } from '@/lib/utils/logger';
import type { AnalysisRecord } from '@/types/analysis-history';

export interface UseApproveProposalReturn {
  approveProposal: (message: ProposalMessage, proposalId: string) => Promise<void | null>;
  approveAllProposals: (message: ProposalMessage) => Promise<void>;
  approveLoading: boolean;
  approveError: string | null;
}

/**
 * Hook for handling proposal approval logic
 */
export function useApproveProposal(): UseApproveProposalReturn {
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
    const proposal: ExtendedProposal = {
      ...proposalData,
      symbol: extractSymbolFromTitle(message.proposalGroup.title),
      interval: extractIntervalFromDescription(message.proposalGroup.description),
      reasoning: proposalData.reason, // Map reason to reasoning for ExtendedProposal
    } as ExtendedProposal;
    logger.info('[ApproveProposal] Approving proposal', { proposalId, type: proposal.type });

    // Validate the drawing data
    const drawingData = 'drawingData' in proposalData ? proposalData.drawingData : undefined;
    if (!drawingData) {
      throw new Error('Drawing data is required for approval');
    }
    const validatedData = validateDrawingData(drawingData);

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
        type: validatedData.type as any,
        points: validatedData.points,
        style: validatedData.style || {},
        price: validatedData.price,
        time: validatedData.time,
        levels: validatedData.levels,
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
    if (proposal.mlPrediction && proposal.mlPrediction.confidence !== undefined) {
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
          price: drawingData.points[0]?.value,
          mlPrediction: proposal.mlPrediction ? {
            successProbability: proposal.mlPrediction.confidence,
            expectedBounces: 0, // Default since it's not in the MLPrediction type
            reasoning: [] // Default since it's not in the MLPrediction type
          } : undefined,
          drawingData: {
            type: validatedData.type,
            points: validatedData.points,
            style: validatedData.style,
            metadata: validatedData.metadata ? Object.entries(validatedData.metadata).reduce((acc, [key, value]) => {
              // Ensure metadata values conform to expected types
              if (
                typeof value === 'string' || 
                typeof value === 'number' || 
                typeof value === 'boolean' ||
                (Array.isArray(value) && value.every(v => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) ||
                (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).every(v => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'))
              ) {
                acc[key] = value;
              }
              return acc;
            }, {} as Record<string, string | number | boolean | (string | number | boolean)[] | Record<string, string | number | boolean>>) : undefined,
            price: validatedData.price,
            time: validatedData.time,
            levels: validatedData.levels
          }
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
    const approvalEvent = new CustomEvent('ui:proposal-action', {
      detail: {
        action: 'approve',
        proposalId: proposalId,
        proposalGroupId: message.proposalGroup.id,
        drawingId: drawingId,
        symbol: proposal.symbol,
        interval: proposal.interval,
        timestamp: Date.now()
      }
    });
    
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
      logger.error('[ApproveProposal] Failed to approve proposal', { error });
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