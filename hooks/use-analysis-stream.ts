'use client';

import { useState, useCallback } from 'react';
import { useStreaming } from '@/hooks/base/use-streaming';
import { logger } from '@/lib/utils/logger';
import {
  AnalysisProgressEvent,
  AnalysisStep,
  AnalysisStepType,
} from '@/types/analysis-progress';
import { streamToLines } from '@/lib/utils/stream-utils';

interface UseAnalysisStreamOptions {
  onStepStart?: (step: AnalysisStep) => void;
  onStepProgress?: (step: AnalysisStep) => void;
  onStepComplete?: (step: AnalysisStep) => void;
  onComplete?: (data: { duration: number; proposalCount: number; proposalGroupId: string }) => void;
  onError?: (error: string) => void;
}

interface UseAnalysisStreamReturn {
  steps: AnalysisStep[];
  currentStepIndex: number;
  isAnalyzing: boolean;
  error: string | null;
  startAnalysis: (params: {
    symbol: string;
    interval: string;
    analysisType: 'trendline' | 'support-resistance' | 'fibonacci' | 'pattern' | 'all';
    maxProposals?: number;
  }) => void;
  reset: () => void;
}

export function useAnalysisStream(options: UseAnalysisStreamOptions = {}): UseAnalysisStreamReturn {
  const [steps, setSteps] = useState<AnalysisStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [sessionId, setSessionId] = useState<string>('');

  // Handle incoming events
  const handleEvent = useCallback((event: AnalysisProgressEvent) => {
    logger.debug('[Analysis Stream] Received event', { type: event.type });

    switch (event.type) {
      case 'analysis:start':
        if ('totalSteps' in event.data) {
          logger.info('[Analysis Stream] Analysis started', event.data);
        }
        break;

      case 'analysis:step-start':
        if ('step' in event.data && 'currentStepIndex' in event.data) {
          setSteps(prev => {
            const newSteps = [...prev];
            newSteps[event.data.currentStepIndex] = event.data.step;
            return newSteps;
          });
          setCurrentStepIndex(event.data.currentStepIndex);
          options.onStepStart?.(event.data.step);
        }
        break;

      case 'analysis:step-progress':
        if ('step' in event.data && 'currentStepIndex' in event.data) {
          setSteps(prev => {
            const newSteps = [...prev];
            newSteps[event.data.currentStepIndex] = event.data.step;
            return newSteps;
          });
          options.onStepProgress?.(event.data.step);
        }
        break;

      case 'analysis:step-complete':
        if ('step' in event.data && 'currentStepIndex' in event.data) {
          setSteps(prev => {
            const newSteps = [...prev];
            newSteps[event.data.currentStepIndex] = event.data.step;
            return newSteps;
          });
          options.onStepComplete?.(event.data.step);
        }
        break;

      case 'analysis:complete':
        if ('duration' in event.data && 'proposalCount' in event.data && 'proposalGroupId' in event.data) {
          options.onComplete?.(event.data);
          logger.info('[Analysis Stream] Analysis completed', event.data);
        }
        break;

      case 'analysis:error':
        if ('error' in event.data) {
          options.onError?.(event.data.error);
          logger.error('[Analysis Stream] Analysis error', event.data);
        }
        break;

      default:
        logger.warn('[Analysis Stream] Unknown event type', { type: event.type });
    }
  }, [options]);

  // Use base streaming hook
  const streaming = useStreaming<AnalysisProgressEvent>({
    endpoint: '/api/ai/analysis-stream',
    autoConnect: false,
    onMessage: handleEvent,
    onError: (error) => {
      logger.error('[Analysis Stream] Stream error', { error });
      options.onError?.(error.message);
    },
    parseResponse: (chunk: string) => {
      try {
        // The base hook already handles SSE format, but we need to parse the data
        return JSON.parse(chunk);
      } catch {
        return null;
      }
    },
  });

  // Start analysis
  const startAnalysis = useCallback(async (params: {
    symbol: string;
    interval: string;
    analysisType: 'trendline' | 'support-resistance' | 'fibonacci' | 'pattern' | 'all';
    maxProposals?: number;
  }) => {
    // Reset state
    reset();
    
    // Generate session ID
    const newSessionId = `session_${Date.now()}`;
    setSessionId(newSessionId);

    // Start streaming with body
    const body = {
      ...params,
      sessionId: newSessionId,
    };

    // Use custom fetch to handle the stream
    try {
      const response = await fetch('/api/ai/analysis-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Failed to start analysis: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Process stream lines via shared util
      try {
        for await (const line of streamToLines(response)) {
          try {
            const data = JSON.parse(line);
            handleEvent(data);
          } catch (e) {
            logger.error('[Analysis Stream] Failed to parse event', { line, error: String(e) });
          }
        }
      } catch (error) {
        logger.error('[Analysis Stream] Stream processing error', { error });
        options.onError?.(error instanceof Error ? error.message : 'Stream processing error');
      }

    } catch (error) {
      logger.error('[Analysis Stream] Failed to start analysis', { error });
      const errorMessage = error instanceof Error ? error.message : 'Failed to start analysis';
      options.onError?.(errorMessage);
    }
  }, [handleEvent, options]);

  // Reset state
  const reset = useCallback(() => {
    streaming.disconnect();
    setSteps([]);
    setCurrentStepIndex(-1);
    setSessionId('');
  }, [streaming]);

  return {
    steps,
    currentStepIndex,
    isAnalyzing: streaming.isStreaming,
    error: streaming.error ? streaming.error.message : null,
    startAnalysis,
    reset,
  };
}