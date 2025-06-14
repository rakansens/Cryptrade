'use client';

// ================================================================
// [2025-06-11] 🐛 StrictMode 二重実行対策
// - hasAutoStartedRef を導入し、autoStart 時の startAnalysis 二重呼び出しを防止
// ================================================================

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, Circle, Loader2, XCircle } from 'lucide-react';
import { ProgressIndicator } from '@/components/shared/ui/ProgressIndicator';
import { AnalysisStep, AnalysisStepStatus, calculateStepDuration } from '@/types/analysis-progress';
import { useAnalysisStream } from '@/hooks/use-analysis-stream';
import { LinearProgress } from '@/components/shared/ui/LinearProgress';

interface AnalysisProgressProps {
  symbol: string;
  interval: string;
  analysisType: 'trendline' | 'support-resistance' | 'fibonacci' | 'pattern' | 'all';
  maxProposals?: number;
  onComplete?: (data: { proposalGroupId: string; proposalCount: number }) => void;
  autoStart?: boolean;
  className?: string;
}

export function AnalysisProgress({
  symbol,
  interval,
  analysisType,
  maxProposals = 5,
  onComplete,
  autoStart = true,
  className = '',
}: AnalysisProgressProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  // React StrictMode の二重マウントで startAnalysis が二重実行されるのを防ぐ
  const hasAutoStartedRef = React.useRef(false);

  const {
    steps,
    currentStepIndex,
    isAnalyzing,
    error,
    startAnalysis,
    reset,
  } = useAnalysisStream({
    onStepComplete: (step) => {
      setCompletedSteps(prev => new Set(prev).add(step.id));
    },
    onComplete: (data) => {
      onComplete?.(data);
      // Auto-collapse after completion
      setTimeout(() => setIsExpanded(false), 2000);
    },
  });

  // Auto-start analysis on mount if enabled
  useEffect(() => {
    if (autoStart && !hasAutoStartedRef.current && symbol && interval && analysisType) {
      hasAutoStartedRef.current = true; // 二重実行を防止
      startAnalysis({ symbol, interval, analysisType, maxProposals });
    }
  }, [autoStart, symbol, interval, analysisType, maxProposals, startAnalysis]);

  // Get status icon
  const getStatusIcon = (step: AnalysisStep, index: number) => {
    if (step.status === 'completed') {
      return <CheckCircle className="w-4 h-4 text-[hsl(var(--color-profit))]" />;
    }
    if (step.status === 'error') {
      return <XCircle className="w-4 h-4 text-[hsl(var(--color-loss))]" />;
    }
    if (step.status === 'in-progress') {
      return <Loader2 className="w-4 h-4 text-[hsl(var(--color-info))] animate-spin" />;
    }
    return <Circle className="w-4 h-4 text-[hsl(var(--text-muted))]" />;
  };

  // Get step style based on status
  const getStepStyle = (step: AnalysisStep, index: number) => {
    if (step.status === 'completed') {
      return 'bg-[hsl(var(--color-profit)/0.1)] border-[hsl(var(--color-profit)/0.3)]';
    }
    if (step.status === 'error') {
      return 'bg-[hsl(var(--color-loss)/0.1)] border-[hsl(var(--color-loss)/0.3)]';
    }
    if (step.status === 'in-progress') {
      return 'bg-[hsl(var(--color-info)/0.1)] border-[hsl(var(--color-info)/0.3)]';
    }
    return 'opacity-50';
  };

  // Calculate overall progress
  const overallProgress = steps.length > 0
    ? (completedSteps.size / steps.length) * 100
    : 0;

  if (!isAnalyzing && steps.length === 0 && !error) {
    return null;
  }

  return (
    <div className={`premium-glass border border-[hsl(var(--border))] rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-[var(--space-md)] py-[var(--space-sm)] flex items-center justify-between hover:bg-[hsl(var(--color-secondary)/0.3)] transition-colors"
      >
        {/* Chevron toggle icon */}
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-[hsl(var(--text-muted))]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[hsl(var(--text-muted))]" />
        )}
        {/* Shared ProgressIndicator */}
        <ProgressIndicator
          title={isAnalyzing ? 'AI分析中...' : error ? '分析エラー' : '分析完了'}
          value={overallProgress}
          isProcessing={isAnalyzing}
          className="flex-1"
        />
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-[var(--space-md)] pb-[var(--space-md)] space-y-[var(--space-xs)]">
          {error && (
            <div className="p-[var(--space-sm)] bg-[hsl(var(--color-loss)/0.1)] border border-[hsl(var(--color-loss)/0.3)] rounded-lg">
              <p className="text-[var(--font-xs)] text-[hsl(var(--color-loss))]">
                エラー: {error}
              </p>
            </div>
          )}

          {/* Steps */}
          <div className="space-y-[var(--space-xs)]">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`p-[var(--space-sm)] border rounded-lg transition-all duration-300 ${getStepStyle(step, index)}`}
              >
                <div className="flex items-start gap-[var(--space-sm)]">
                  {getStatusIcon(step, index)}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-[var(--font-xs)] font-medium text-[hsl(var(--text-primary))]">
                        {step.title}
                      </h4>
                      {step.status === 'completed' && step.startTime && step.endTime && (
                        <span className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
                          {(calculateStepDuration(step) / 1000).toFixed(1)}秒
                        </span>
                      )}
                    </div>
                    <p className="text-[var(--font-xs)] text-[hsl(var(--text-secondary))]">
                      {step.description}
                    </p>

                    {/* Streaming text display */}
                    {step.streamingText && (
                      <div className="mt-2 p-2 bg-[hsl(var(--color-secondary)/0.3)] rounded text-[var(--font-xs)] font-mono">
                        <pre className="whitespace-pre-wrap text-[hsl(var(--text-primary))]">
                          {step.streamingText}
                          {step.status === 'in-progress' && (
                            <span className="inline-block w-2 h-3 bg-[hsl(var(--color-accent))] animate-pulse ml-1" />
                          )}
                        </pre>
                      </div>
                    )}

                    {/* Progress bar for in-progress steps without streaming text */}
                    {step.status === 'in-progress' && step.progress !== undefined && !step.streamingText && (
                      <div className="mt-2 w-full h-1 bg-[hsl(var(--color-secondary))] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[hsl(var(--color-info))] transition-all duration-300"
                          style={{ width: `${step.progress}%` }}
                        />
                      </div>
                    )}

                    {/* Details for completed steps */}
                    {step.status === 'completed' && step.details && !step.finalText && (
                      <div className="mt-2 text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
                        {step.type === 'data-collection' && step.details.dataPoints && (
                          <span>{step.details.dataPoints}個のデータポイントを収集</span>
                        )}
                        {step.type === 'technical-analysis' && step.details.indicators && (
                          <span>指標: {(step.details.indicators as string[]).join(', ')}</span>
                        )}
                        {step.type === 'pattern-detection' && step.details.patternsFound !== undefined && (
                          <span>{step.details.patternsFound}個のパターンを検出</span>
                        )}
                        {step.type === 'line-calculation' && step.details.linesCalculated && (
                          <span>{step.details.linesCalculated}本のラインを計算</span>
                        )}
                        {step.type === 'proposal-creation' && step.details.proposalsCreated !== undefined && (
                          <span>{step.details.proposalsCreated}個の提案を作成</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          {!isAnalyzing && (error || steps.length > 0) && (
            <div className="flex justify-end gap-[var(--space-sm)] mt-[var(--space-md)]">
              <button
                onClick={reset}
                className="text-[var(--font-xs)] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))] transition-colors"
              >
                リセット
              </button>
              {error && (
                <button
                  onClick={() => startAnalysis({ symbol, interval, analysisType, maxProposals })}
                  className="px-[var(--space-sm)] py-[var(--space-xs)] text-[var(--font-xs)] bg-[hsl(var(--color-accent))] text-white rounded hover:bg-[hsl(var(--color-accent-hover))] transition-colors"
                >
                  再試行
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}