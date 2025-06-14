import { z } from 'zod';

// =============================================================================
// ANALYSIS PROGRESS TYPES
// =============================================================================

// Analysis step status
export const AnalysisStepStatusSchema = z.enum(['pending', 'in-progress', 'completed', 'error']);

// Analysis step type
export const AnalysisStepTypeSchema = z.enum([
  'data-collection',
  'technical-analysis',
  'pattern-detection',
  'line-calculation',
  'reasoning-generation',
  'proposal-creation',
  // Pattern recognition specific steps
  'peak-trough-detection',
  'pattern-validation',
  'metrics-calculation',
  // Line proposal specific steps
  'touch-point-detection',
  'angle-calculation',
  'strength-evaluation'
]);

// Analysis step schema
export const AnalysisStepSchema = z.object({
  id: z.string(),
  type: AnalysisStepTypeSchema,
  title: z.string(),
  description: z.string(),
  status: AnalysisStepStatusSchema,
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  progress: z.number().min(0).max(100).optional(),
  details: z.record(z.string(), z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number(), z.boolean()])),
    z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  ])).optional(),
  error: z.string().optional(),
  // For streaming text
  streamingText: z.string().optional(),
  finalText: z.string().optional(),
});

// Analysis progress event types
export const AnalysisEventTypeSchema = z.enum([
  'analysis:start',
  'analysis:step-start',
  'analysis:step-progress',
  'analysis:step-complete',
  'analysis:step-error',
  'analysis:complete',
  'analysis:error'
]);

// Analysis progress event
export const AnalysisProgressEventSchema = z.object({
  type: AnalysisEventTypeSchema,
  sessionId: z.string(),
  timestamp: z.number(),
  data: z.union([
    // Start event data
    z.object({
      totalSteps: z.number(),
      analysisType: z.string(),
      symbol: z.string(),
      interval: z.string(),
    }),
    // Step event data
    z.object({
      step: AnalysisStepSchema,
      currentStepIndex: z.number(),
      totalSteps: z.number(),
    }),
    // Complete event data
    z.object({
      duration: z.number(),
      proposalCount: z.number(),
      proposalGroupId: z.string(),
    }),
    // Error event data
    z.object({
      error: z.string(),
      stepId: z.string().optional(),
    }),
  ]),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type AnalysisStepStatus = z.infer<typeof AnalysisStepStatusSchema>;
export type AnalysisStepType = z.infer<typeof AnalysisStepTypeSchema>;
export type AnalysisStep = z.infer<typeof AnalysisStepSchema>;
export type AnalysisEventType = z.infer<typeof AnalysisEventTypeSchema>;
export type AnalysisProgressEvent = z.infer<typeof AnalysisProgressEventSchema>;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function createAnalysisStep(
  type: AnalysisStepType,
  overrides?: Partial<AnalysisStep>
): AnalysisStep {
  const titles: Record<AnalysisStepType, string> = {
    'data-collection': 'データ収集',
    'technical-analysis': 'テクニカル分析',
    'pattern-detection': 'パターン検出',
    'line-calculation': 'ライン計算',
    'reasoning-generation': '理由生成',
    'proposal-creation': '提案作成',
    // Pattern recognition specific
    'peak-trough-detection': 'ピーク・トラフ検出',
    'pattern-validation': 'パターン検証',
    'metrics-calculation': 'メトリクス計算',
    // Line proposal specific
    'touch-point-detection': 'タッチポイント検出',
    'angle-calculation': '角度計算',
    'strength-evaluation': '強度評価',
  };

  const descriptions: Record<AnalysisStepType, string> = {
    'data-collection': '市場データを取得しています...',
    'technical-analysis': '価格動向を分析しています...',
    'pattern-detection': 'チャートパターンを検出しています...',
    'line-calculation': 'サポート・レジスタンスを計算しています...',
    'reasoning-generation': '分析理由を生成しています...',
    'proposal-creation': '描画提案を作成しています...',
    // Pattern recognition specific
    'peak-trough-detection': 'チャート上の重要なピークとトラフを特定しています...',
    'pattern-validation': '検出されたパターンの妥当性を検証しています...',
    'metrics-calculation': 'パターンのメトリクスを計算しています...',
    // Line proposal specific
    'touch-point-detection': 'ラインのタッチポイントを検出しています...',
    'angle-calculation': 'トレンドラインの角度を計算しています...',
    'strength-evaluation': 'ラインの強度を評価しています...',
  };

  return {
    id: `step_${type}_${Date.now()}`,
    type,
    title: titles[type],
    description: descriptions[type],
    status: 'pending',
    ...overrides,
  };
}

// Helper to get analysis steps based on analysis type
export function getAnalysisSteps(analysisType: string): AnalysisStepType[] {
  switch (analysisType) {
    case 'pattern':
      return [
        'data-collection',
        'technical-analysis',
        'peak-trough-detection',
        'pattern-validation',
        'metrics-calculation',
        'reasoning-generation',
        'proposal-creation'
      ];
    case 'trendline':
    case 'support-resistance':
      return [
        'data-collection',
        'technical-analysis',
        'touch-point-detection',
        'angle-calculation',
        'strength-evaluation',
        'reasoning-generation',
        'proposal-creation'
      ];
    default:
      return [
        'data-collection',
        'technical-analysis',
        'pattern-detection',
        'line-calculation',
        'reasoning-generation',
        'proposal-creation'
      ];
  }
}

export function calculateStepDuration(step: AnalysisStep): number {
  if (step.startTime && step.endTime) {
    return step.endTime - step.startTime;
  }
  return 0;
}