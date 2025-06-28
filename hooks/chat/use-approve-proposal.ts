'use client';

import { useCallback } from 'react';
import { useAnalysisActions } from '@/store/analysis-history.store';
import { useChat } from '@/store/chat.store';
import { useAddApprovedDrawing } from '@/store/proposal-approval.store';
import { useAsyncState } from '@/hooks/base/use-async-state';
import { validateDrawingData } from '@/schema/drawing';
import { type ProposalMessage } from '@/types/proposals';
import type { ExtendedProposal } from '@/types/proposals';
import { createChartEvent } from '@/types/events/chart-events';
import { showProposalApprovalSuccess, showProposalApprovalError } from '@/lib/notifications/toast';
import type { AnalysisRecord } from '@/types/analysis-history';
import { useChatProposalBase } from '@/hooks/shared/useChatProposalBase';

export interface UseApproveProposalReturn {
  approveProposal: (message: ProposalMessage, proposalId: string) => Promise<void>;
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
  
  const proposalBase = useChatProposalBase({
    hookName: 'useApproveProposal',
    defaultSymbol: 'BTCUSDT',
    logLevel: 'info'
  });

  const approveAsync = useCallback(async (message: ProposalMessage, proposalId: string): Promise<void> => {
    // 基本バリデーション（基盤使用）
    const validation = proposalBase.validateProposalRequest(message, proposalId, true);
    if (!validation.success) {
      throw new Error(validation.error || 'Validation failed');
    }

    // セッションIDチェック
    if (!currentSessionId) {
      proposalBase.handleProposalError(
        new Error('Session ID is required'),
        validation.context!,
        'Proposal approval'
      );
      throw new Error('Session ID is required');
    }

    const { context } = validation;
    const proposalData = proposalBase.getProposalData(message, proposalId)!;

    // 拡張提案オブジェクト構築
    const proposal: ExtendedProposal = {
      ...proposalData,
      symbol: context!.symbol,
      interval: context!.interval!,
      reasoning: proposalData.reason, // Map reason to reasoning for ExtendedProposal
    } as ExtendedProposal;
    
    proposalBase.safeLog('info', 'Approving proposal', { 
      proposalId, 
      type: proposal.type,
      context 
    });

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
          proposalGroup: context!.proposalGroupId,
          approvedAt: new Date().toISOString()
        }
      });
    }

    // Dispatch the drawing creation event directly to the window
    if (typeof window !== 'undefined') {
      window.dispatchEvent(chartEvent);
      proposalBase.safeLog('info', 'Drawing added to chart', { 
        eventType: chartEvent.type, 
        drawingId,
        context 
      });
    } else {
      // If on server, publish through SSE (基盤のPublisher使用チェック)
      if (proposalBase.hasPublisher) {
        // 基盤内部でpublishしてもらう（一時的にカスタムイベントとして）
        const customEvent = new CustomEvent('chart:event', { detail: chartEvent });
        proposalBase.publishProposalEvent('approve', context!, { 
          chartEvent: customEvent,
          drawingId 
        });
      } else {
        proposalBase.safeLog('warn', 'Cannot publish chart event - no publisher available', {
          eventType: chartEvent.type,
          drawingId
        });
      }
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
      proposalBase.safeLog('info', 'Analysis record created', { 
        proposalId,
        context,
        recordType: analysisRecord.type 
      });
    }

    // イベント発行（基盤使用）
    proposalBase.publishProposalEvent('approve', context!, { drawingId });

    // 成功通知
    showProposalApprovalSuccess(proposal.symbol, proposal.type || validatedData.type);

  }, [proposalBase, currentSessionId, addAnalysisRecord, addApprovedDrawing]);

  const {
    execute: approveProposal,
    loading: approveLoading,
    error: approveError,
  } = useAsyncState(async (message: ProposalMessage, proposalId: string) => {
    try {
      await approveAsync(message, proposalId);
    } catch (error) {
      // 基盤のエラーハンドリング使用
      const validation = proposalBase.validateProposalRequest(message, proposalId, false);
      if (validation.success && validation.context) {
        proposalBase.handleProposalError(error, validation.context, 'Proposal approval');
      } else {
        proposalBase.safeLog('error', 'Failed to approve proposal', { 
          error: error instanceof Error ? error.message : String(error),
          proposalId 
        });
      }
      showProposalApprovalError(error as Error);
      throw error;
    }
  });

  const approveAllProposals = useCallback(async (message: ProposalMessage) => {
    // 一括処理（基盤使用）
    await proposalBase.processBatchProposals(message, approveProposal, 'approve');
  }, [proposalBase, approveProposal]);

  return {
    approveProposal,
    approveAllProposals,
    approveLoading,
    approveError,
  };
}