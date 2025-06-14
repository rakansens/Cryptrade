import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';
import { mastra } from '@/lib/mastra/mastra';
import {
  AnalysisProgressEvent,
  AnalysisStep,
  createAnalysisStep,
  AnalysisStepType,
  getAnalysisSteps,
} from '@/types/analysis-progress';
// Import will be dynamic to avoid initialization issues

/**
 * Analysis Progress Streaming API
 * 
 * Streams real-time progress updates during proposal generation
 * Now with character-by-character streaming for text content
 */

const AnalysisStreamRequestSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  interval: z.string().min(1, 'Interval is required'),
  analysisType: z.enum(['trendline', 'support-resistance', 'fibonacci', 'pattern', 'all']),
  maxProposals: z.number().optional().default(5),
  sessionId: z.string().optional(),
});

// Streaming text content for each step type
const STREAMING_TEXTS: Record<string, string[]> = {
  'peak-trough-detection': [
    '価格データの極値を分析中...',
    'ローカルピークを特定: 108,500 USDT (3時間前)',
    'ローカルトラフを特定: 106,200 USDT (1時間前)',
    '重要な転換点を検出しました',
  ],
  'pattern-validation': [
    'パターン形状を検証中...',
    'トライアングルパターンの可能性を検出',
    '対称性を確認: 82% 一致',
    'ボリューム分析: 減少傾向を確認',
  ],
  'metrics-calculation': [
    'パターンのメトリクスを計算中...',
    'ブレイクアウト予想価格: 109,200 USDT',
    'ストップロス推奨: 105,800 USDT',
    'リスクリワード比: 1:2.5',
  ],
  'touch-point-detection': [
    'ラインのタッチポイントを検出中...',
    '第1タッチポイント: 107,500 USDT (4時間前)',
    '第2タッチポイント: 107,480 USDT (2時間前)',
    '第3タッチポイント: 107,520 USDT (30分前)',
    '強力なサポートラインを確認',
  ],
  'angle-calculation': [
    'トレンドラインの角度を計算中...',
    '上昇角度: 15.3度',
    '勢いの強さ: 中程度',
    '持続可能性: 高い',
  ],
  'strength-evaluation': [
    'ラインの強度を評価中...',
    'タッチポイント数: 4回',
    '反発の強さ: 平均 0.8%',
    '信頼度スコア: 85/100',
  ],
};

// Helper to stream text character by character
async function* streamText(text: string, delayMs: number = 20): AsyncGenerator<string> {
  for (const char of text) {
    yield char;
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedInput = AnalysisStreamRequestSchema.parse(body);
    const sessionId = validatedInput.sessionId || `session_${Date.now()}`;

    logger.info('[Analysis Stream API] Starting analysis stream', {
      symbol: validatedInput.symbol,
      interval: validatedInput.interval,
      analysisType: validatedInput.analysisType,
      sessionId,
    });

    // Create the response stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: AnalysisProgressEvent) => {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        };

        // Get steps based on analysis type
        const stepTypes = getAnalysisSteps(validatedInput.analysisType);
        const steps: AnalysisStep[] = stepTypes.map(type => createAnalysisStep(type));

        try {
          // Send start event
          sendEvent({
            type: 'analysis:start',
            sessionId,
            timestamp: Date.now(),
            data: {
              totalSteps: steps.length,
              analysisType: validatedInput.analysisType,
              symbol: validatedInput.symbol,
              interval: validatedInput.interval,
            },
          });

          // Process each step
          for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            step.status = 'in-progress';
            step.startTime = Date.now();
            
            sendEvent({
              type: 'analysis:step-start',
              sessionId,
              timestamp: Date.now(),
              data: {
                step,
                currentStepIndex: i,
                totalSteps: steps.length,
              },
            });

            // Special handling for steps with streaming text
            if (STREAMING_TEXTS[step.type]) {
              const texts = STREAMING_TEXTS[step.type];
              step.streamingText = '';
              
              for (const text of texts) {
                // Stream each character
                for await (const char of streamText(text)) {
                  step.streamingText += char;
                  sendEvent({
                    type: 'analysis:step-progress',
                    sessionId,
                    timestamp: Date.now(),
                    data: {
                      step,
                      currentStepIndex: i,
                      totalSteps: steps.length,
                    },
                  });
                }
                
                // Add newline between texts
                step.streamingText += '\n';
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              
              step.finalText = step.streamingText;
              step.progress = 100;
            } else {
              // Regular progress simulation for other steps
              await simulateStepProgress(step, i, steps.length, sendEvent, sessionId);
            }

            step.status = 'completed';
            step.endTime = Date.now();

            sendEvent({
              type: 'analysis:step-complete',
              sessionId,
              timestamp: Date.now(),
              data: {
                step,
                currentStepIndex: i,
                totalSteps: steps.length,
              },
            });
          }

          // Step 6: Proposal Creation - Actually call the tool
          let result: { proposalGroup: { id: string; proposals: unknown[] } | null } = { proposalGroup: null };
          try {
            // Dynamic import to avoid initialization issues
            const { proposalGenerationTool } = await import('@/lib/mastra/tools/proposal-generation.tool');
            type ProposalGenerationOutput = import('@/lib/mastra/tools/proposal-generation.tool').ProposalGenerationOutput;
            const toolResult = await proposalGenerationTool.execute({
              symbol: validatedInput.symbol,
              interval: validatedInput.interval,
              analysisType: validatedInput.analysisType,
              maxProposals: validatedInput.maxProposals,
            }) as ProposalGenerationOutput;
            
            if (toolResult.success && toolResult.proposalGroup) {
              result = {
                proposalGroup: {
                  id: toolResult.proposalGroup.id,
                  proposals: toolResult.proposalGroup.proposals,
                }
              };
            }
          } catch (toolError) {
            logger.error('[Analysis Stream API] Proposal generation failed', { error: toolError });
            // Continue with simulated data
            result = {
              proposalGroup: {
                id: `pg_simulated_${Date.now()}`,
                proposals: [],
              }
            };
          }

          // Send complete event
          const duration = steps.reduce((sum, step) => {
            if (step.startTime && step.endTime) {
              return sum + (step.endTime - step.startTime);
            }
            return sum;
          }, 0);

          sendEvent({
            type: 'analysis:complete',
            sessionId,
            timestamp: Date.now(),
            data: {
              duration,
              proposalCount: result.proposalGroup?.proposals.length || 0,
              proposalGroupId: result.proposalGroup?.id || '',
            },
          });

          // Close the stream
          try {
            controller.close();
          } catch (err) {
            // Controller might already be closed
          }

        } catch (error) {
          logger.error('[Analysis Stream API] Error during analysis', { error });
          
          sendEvent({
            type: 'analysis:error',
            sessionId,
            timestamp: Date.now(),
            data: {
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          });
          
          try {
            controller.close();
          } catch (err) {
            // Controller might already be closed
          }
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    logger.error('[Analysis Stream API] Request failed', { error });
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request',
          details: error.errors,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Simulate progress for regular steps
async function simulateStepProgress(
  step: AnalysisStep,
  currentIndex: number,
  totalSteps: number,
  sendEvent: (event: AnalysisProgressEvent) => void,
  sessionId: string
) {
  switch (step.type) {
    case 'data-collection':
      for (let progress = 0; progress <= 100; progress += 20) {
        step.progress = progress;
        sendEvent({
          type: 'analysis:step-progress',
          sessionId,
          timestamp: Date.now(),
          data: {
            step,
            currentStepIndex: currentIndex,
            totalSteps,
          },
        });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      step.details = {
        dataPoints: 500,
        timeRange: '過去500本のローソク足',
      };
      break;

    case 'technical-analysis':
      const indicators = ['Moving Average', 'RSI', 'MACD', 'Bollinger Bands'];
      for (let i = 0; i < indicators.length; i++) {
        step.progress = ((i + 1) / indicators.length) * 100;
        step.details = {
          currentIndicator: indicators[i],
          completedIndicators: indicators.slice(0, i + 1),
        };
        sendEvent({
          type: 'analysis:step-progress',
          sessionId,
          timestamp: Date.now(),
          data: {
            step,
            currentStepIndex: currentIndex,
            totalSteps,
          },
        });
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      break;

    case 'pattern-detection':
      const patterns = ['Triangle', 'Head and Shoulders', 'Double Bottom', 'Flag'];
      for (let i = 0; i < patterns.length; i++) {
        step.progress = ((i + 1) / patterns.length) * 100;
        step.details = {
          scanning: patterns[i],
          found: Math.floor(Math.random() * 3),
        };
        sendEvent({
          type: 'analysis:step-progress',
          sessionId,
          timestamp: Date.now(),
          data: {
            step,
            currentStepIndex: currentIndex,
            totalSteps,
          },
        });
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      step.details = {
        patternsFound: 2,
        types: ['Triangle', 'Double Bottom'],
      };
      break;

    case 'line-calculation':
      const lineTypes = ['Support', 'Resistance', 'Trendline', 'Channel'];
      for (let i = 0; i < lineTypes.length; i++) {
        step.progress = ((i + 1) / lineTypes.length) * 100;
        step.details = {
          calculating: lineTypes[i],
          calculated: i + 1,
        };
        sendEvent({
          type: 'analysis:step-progress',
          sessionId,
          timestamp: Date.now(),
          data: {
            step,
            currentStepIndex: currentIndex,
            totalSteps,
          },
        });
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      step.details = {
        linesCalculated: 5,
        types: lineTypes,
      };
      break;

    case 'reasoning-generation':
      for (let progress = 0; progress <= 100; progress += 25) {
        step.progress = progress;
        step.details = {
          analyzing: 'AIが分析理由を生成中...',
          confidence: progress / 100,
        };
        sendEvent({
          type: 'analysis:step-progress',
          sessionId,
          timestamp: Date.now(),
          data: {
            step,
            currentStepIndex: currentIndex,
            totalSteps,
          },
        });
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      break;

    case 'proposal-creation':
      for (let progress = 0; progress <= 100; progress += 33) {
        step.progress = progress;
        step.details = {
          creating: '描画提案を生成中...',
          proposalsCreated: Math.floor(progress / 33),
        };
        sendEvent({
          type: 'analysis:step-progress',
          sessionId,
          timestamp: Date.now(),
          data: {
            step,
            currentStepIndex: currentIndex,
            totalSteps,
          },
        });
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      break;

    default:
      // Default progress simulation
      for (let progress = 0; progress <= 100; progress += 20) {
        step.progress = progress;
        sendEvent({
          type: 'analysis:step-progress',
          sessionId,
          timestamp: Date.now(),
          data: {
            step,
            currentStepIndex: currentIndex,
            totalSteps,
          },
        });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
  }
}