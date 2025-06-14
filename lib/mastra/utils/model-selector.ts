import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { logger } from '@/lib/utils/logger';

/**
 * Model Selector Utility
 * 
 * タスクの複雑さに基づいて最適なAIモデルを選択するユーティリティ
 * - 簡単なタスク: 高速で低コストなモデル (GPT-4o-mini)
 * - 複雑なタスク: 高性能モデル (GPT-4o)
 * - 特殊なタスク: 専門モデル (Claude-3.5-sonnet)
 */

export type ModelComplexity = 'simple' | 'moderate' | 'complex' | 'specialized';

export interface ModelConfig {
  provider: 'openai' | 'anthropic';
  modelId: string;
  description: string;
  costPerToken: number; // USD per 1K tokens
  speedRating: number; // 1-5, 5 being fastest
  qualityRating: number; // 1-5, 5 being highest quality
}

const MODEL_CONFIGS: Record<ModelComplexity, ModelConfig> = {
  simple: {
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    description: 'Fast and cost-effective for simple tasks',
    costPerToken: 0.00015,
    speedRating: 5,
    qualityRating: 3,
  },
  moderate: {
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    description: 'Balanced performance for moderate tasks',
    costPerToken: 0.00015,
    speedRating: 5,
    qualityRating: 3,
  },
  complex: {
    provider: 'openai',
    modelId: 'gpt-4o',
    description: 'High performance for complex reasoning',
    costPerToken: 0.0025,
    speedRating: 3,
    qualityRating: 5,
  },
  specialized: {
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    description: 'Specialized for creative and nuanced tasks',
    costPerToken: 0.003,
    speedRating: 3,
    qualityRating: 5,
  },
};

export class ModelSelector {
  private static instance: ModelSelector;
  private usageStats: Map<ModelComplexity, number> = new Map();

  private constructor() {
    // Initialize usage stats
    Object.keys(MODEL_CONFIGS).forEach(complexity => {
      this.usageStats.set(complexity as ModelComplexity, 0);
    });
  }

  static getInstance(): ModelSelector {
    if (!ModelSelector.instance) {
      ModelSelector.instance = new ModelSelector();
    }
    return ModelSelector.instance;
  }

  /**
   * タスクの複雑さに基づいてモデルを選択
   */
  static selectByComplexity(complexity: ModelComplexity): ReturnType<typeof openai> | ReturnType<typeof anthropic> {
    const instance = ModelSelector.getInstance();
    const config = MODEL_CONFIGS[complexity];
    
    // Update usage stats
    instance.usageStats.set(complexity, (instance.usageStats.get(complexity) || 0) + 1);
    
    logger.info('[ModelSelector] Model selected', {
      complexity,
      provider: config.provider,
      modelId: config.modelId,
      costPerToken: config.costPerToken,
      usageCount: instance.usageStats.get(complexity),
    });

    // Return the appropriate model instance
    if (config.provider === 'openai') {
      return openai(config.modelId);
    } else if (config.provider === 'anthropic') {
      return anthropic(config.modelId);
    }
    
    // Fallback to default
    return openai('gpt-4o-mini');
  }

  /**
   * タスクの内容から複雑さを自動判定
   */
  static analyzeComplexity(task: string, context?: Record<string, unknown>): ModelComplexity {
    const taskLower = task.toLowerCase();
    
    // Simple tasks
    if (
      taskLower.includes('価格') || 
      taskLower.includes('price') ||
      taskLower.includes('いくら') ||
      taskLower.includes('how much') ||
      taskLower.length < 20
    ) {
      return 'simple';
    }
    
    // Specialized tasks
    if (
      taskLower.includes('クリエイティブ') ||
      taskLower.includes('creative') ||
      taskLower.includes('詩') ||
      taskLower.includes('poem') ||
      taskLower.includes('ストーリー') ||
      taskLower.includes('story') ||
      context?.requiresNuance
    ) {
      return 'specialized';
    }
    
    // Complex tasks
    if (
      taskLower.includes('分析') ||
      taskLower.includes('analysis') ||
      taskLower.includes('戦略') ||
      taskLower.includes('strategy') ||
      taskLower.includes('複雑') ||
      taskLower.includes('complex') ||
      taskLower.length > 100 ||
      context?.multiStep
    ) {
      return 'complex';
    }
    
    // Default to moderate
    return 'moderate';
  }

  /**
   * 自動選択: タスクを分析して最適なモデルを選択
   */
  static autoSelect(task: string, context?: Record<string, unknown>): ReturnType<typeof openai> | ReturnType<typeof anthropic> {
    const complexity = ModelSelector.analyzeComplexity(task, context);
    return ModelSelector.selectByComplexity(complexity);
  }

  /**
   * モデル使用統計を取得
   */
  static getUsageStats(): Record<ModelComplexity, number> {
    const instance = ModelSelector.getInstance();
    const stats: Record<ModelComplexity, number> = {} as Record<ModelComplexity, number>;
    
    instance.usageStats.forEach((count, complexity) => {
      stats[complexity] = count;
    });
    
    return stats;
  }

  /**
   * 推定コストを計算
   */
  static estimateCost(complexity: ModelComplexity, estimatedTokens: number): number {
    const config = MODEL_CONFIGS[complexity];
    return (estimatedTokens / 1000) * config.costPerToken;
  }

  /**
   * モデル設定を取得
   */
  static getModelConfig(complexity: ModelComplexity): ModelConfig {
    return MODEL_CONFIGS[complexity];
  }

  /**
   * 全モデル設定を取得
   */
  static getAllConfigs(): Record<ModelComplexity, ModelConfig> {
    return { ...MODEL_CONFIGS };
  }
}

// Export for convenience
export const selectModel = ModelSelector.selectByComplexity;
export const autoSelectModel = ModelSelector.autoSelect;