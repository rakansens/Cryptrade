'use client'

import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { ProgressIndicator } from '@/components/shared/ui/ProgressIndicator'
import { cn } from '@/lib/utils'
import { StreamingMLAnalyzer } from '@/lib/ml/streaming-ml-analyzer'
import type { StreamingMLUpdate, MLPrediction } from '@/lib/ml/line-validation-types'
import type { DetectedLine } from '@/lib/analysis/types'
import type { PriceData } from '@/types/market'
import { logger } from '@/lib/utils/logger'

interface MLAnalysisProgressProps {
  line: DetectedLine
  priceData: PriceData[]
  symbol: string
  currentPrice: number
  onComplete?: (prediction: MLPrediction) => void
  className?: string
}

export function MLAnalysisProgress({
  line,
  priceData,
  symbol,
  currentPrice,
  onComplete,
  className
}: MLAnalysisProgressProps) {
  const [status, setStatus] = useState<StreamingMLUpdate>({
    stage: 'collecting',
    progress: 0,
    currentStep: '初期化中...'
  })
  const [prediction, setPrediction] = useState<MLPrediction | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const analyzer = new StreamingMLAnalyzer()
    let isCancelled = false

    const runAnalysis = async () => {
      try {
        const generator = analyzer.analyzeLineWithProgress(
          line,
          priceData,
          symbol,
          currentPrice
        )

        for await (const update of generator) {
          if (isCancelled) break
          setStatus(update)
          
          // Get the returned prediction when complete
          if (update.stage === 'complete') {
            const finalPrediction = await generator.return(undefined)
            if (finalPrediction.value) {
              setPrediction(finalPrediction.value)
              onComplete?.(finalPrediction.value)
            }
          }
        }
      } catch (err) {
        logger.error('[MLAnalysisProgress] Analysis error', err)
        setError('ML分析中にエラーが発生しました')
      }
    }

    runAnalysis()

    return () => {
      isCancelled = true
    }
  }, [line, priceData, symbol, currentPrice, onComplete])

  const getStageTitle = () => {
    switch (status.stage) {
      case 'collecting': return 'データ収集中'
      case 'extracting': return '特徴抽出中'
      case 'predicting': return '予測実行中'
      case 'analyzing': return '分析実行中'
      case 'complete': return '分析完了'
      default: return '機械学習分析'
    }
  }

  const getProgressBarClass = () => {
    switch (status.stage) {
      case 'collecting': 
        return 'bg-gradient-to-r from-[hsl(var(--color-info))] to-[hsl(var(--color-accent))]'
      case 'extracting': 
        return 'bg-gradient-to-r from-[hsl(var(--color-accent))] to-purple-500'
      case 'predicting': 
        return 'bg-gradient-to-r from-purple-500 to-indigo-500'
      case 'analyzing': 
        return 'bg-gradient-to-r from-indigo-500 to-cyan-500'
      case 'complete': 
        return prediction && prediction.successProbability > 0.7 
          ? 'bg-gradient-to-r from-[hsl(var(--color-profit))] to-green-500'
          : 'bg-gradient-to-r from-yellow-500 to-orange-500'
      default: 
        return 'bg-gradient-to-r from-[hsl(var(--color-accent))] to-[hsl(var(--color-profit))]'
    }
  }

  if (error) {
    return (
      <div className={cn("premium-glass border border-[hsl(var(--color-loss)/0.3)] rounded-lg p-[var(--space-md)]", className)}>
        <div className="flex items-center gap-[var(--space-sm)]">
          <AlertCircle className="w-5 h-5 text-[hsl(var(--color-loss))]" />
          <span className="text-[hsl(var(--color-loss))]">{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("premium-glass border border-[hsl(var(--border))] rounded-lg p-[var(--space-md)] space-y-[var(--space-md)]", className)}>
      {/* Main Progress Indicator */}
      <ProgressIndicator
        title={getStageTitle()}
        subtitle={status.currentStep}
        value={status.progress}
        isProcessing={status.stage !== 'complete'}
        barClass={getProgressBarClass()}
        rightSlot={status.stage === 'complete' && prediction ? (
          <span className={cn(
            "text-[var(--font-sm)] font-medium",
            prediction.successProbability > 0.7 ? "text-[hsl(var(--color-profit))]" : 
            prediction.successProbability > 0.5 ? "text-yellow-500" : "text-[hsl(var(--color-loss))]"
          )}>
            {Math.round(prediction.successProbability * 100)}%
          </span>
        ) : null}
      />

      {/* Feature Details */}
      {status.details?.importantFeatures && status.details.importantFeatures.length > 0 && (
        <div className="space-y-[var(--space-sm)]">
          <div className="text-[var(--font-xs)] font-medium text-[hsl(var(--text-muted))] uppercase tracking-wider">
            検出された重要な特徴
          </div>
          <div className="grid grid-cols-2 gap-[var(--space-xs)]">
            {status.details.importantFeatures.map((feature, idx) => (
              <div 
                key={idx}
                className="text-[var(--font-xs)] px-[var(--space-xs)] py-[var(--space-xs)] bg-[hsl(var(--color-secondary)/0.3)] rounded border border-[hsl(var(--border))]"
              >
                {feature}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preliminary Score */}
      {status.details?.preliminaryScore !== undefined && (
        <div className="flex items-center justify-between pt-[var(--space-sm)] border-t border-[hsl(var(--border))]">
          <span className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">信頼度スコア</span>
          <div className="flex items-center gap-[var(--space-sm)]">
            <ProgressIndicator
              title=""
              value={status.details.preliminaryScore * 100}
              className="w-24"
              barClass={cn(
                status.details.preliminaryScore > 0.7 
                  ? "bg-[hsl(var(--color-profit))]" 
                  : status.details.preliminaryScore > 0.5 
                  ? "bg-yellow-500" 
                  : "bg-[hsl(var(--color-loss))]"
              )}
              rightSlot={
                <span className={cn(
                  "text-[var(--font-sm)] font-medium",
                  status.details.preliminaryScore > 0.7 
                    ? "text-[hsl(var(--color-profit))]" 
                    : status.details.preliminaryScore > 0.5 
                    ? "text-yellow-500" 
                    : "text-[hsl(var(--color-loss))]"
                )}>
                  {Math.round(status.details.preliminaryScore * 100)}%
                </span>
              }
            />
          </div>
        </div>
      )}

      {/* Processing Time */}
      {status.details?.processingTime && (
        <div className="text-[var(--font-xs)] text-[hsl(var(--text-muted))] text-right">
          処理時間: {(status.details.processingTime / 1000).toFixed(1)}秒
        </div>
      )}

      {/* Final Prediction Results */}
      {prediction && status.stage === 'complete' && (
        <div className="p-[var(--space-md)] bg-[hsl(var(--color-secondary)/0.3)] rounded-lg border border-[hsl(var(--border))] space-y-[var(--space-md)]">
          <div className="flex items-center justify-between">
            <span className="text-[var(--font-sm)] font-medium text-[hsl(var(--text-primary))]">成功確率</span>
            <span className={cn(
              "text-[var(--font-lg)] font-bold",
              prediction.successProbability > 0.7 ? "text-[hsl(var(--color-profit))]" : 
              prediction.successProbability > 0.5 ? "text-yellow-500" : "text-[hsl(var(--color-loss))]"
            )}>
              {Math.round(prediction.successProbability * 100)}%
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-[var(--font-sm)] text-[hsl(var(--text-muted))]">予想反発回数</span>
            <span className="text-[var(--font-sm)] font-medium text-[hsl(var(--text-primary))]">
              {prediction.expectedBounces}回
            </span>
          </div>

          {prediction.reasoning && prediction.reasoning.length > 0 && (
            <div className="pt-[var(--space-sm)] border-t border-[hsl(var(--border))]">
              <div className="text-[var(--font-xs)] font-medium text-[hsl(var(--text-muted))] mb-[var(--space-sm)]">分析根拠</div>
              <div className="space-y-[var(--space-xs)]">
                {prediction.reasoning.slice(0, 3).map((reason, idx) => (
                  <div key={idx} className="flex items-start gap-[var(--space-xs)]">
                    <div className={cn(
                      "w-1 h-1 rounded-full mt-1.5 flex-shrink-0",
                      reason.impact === 'positive' ? "bg-[hsl(var(--color-profit))]" :
                      reason.impact === 'negative' ? "bg-[hsl(var(--color-loss))]" : "bg-[hsl(var(--text-muted))]"
                    )} />
                    <div className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
                      {reason.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}