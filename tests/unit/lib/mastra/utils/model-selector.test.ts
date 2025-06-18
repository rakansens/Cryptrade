import {
  ModelSelector,
  ModelComplexity,
  ModelConfig,
  selectModel,
  autoSelectModel
} from '@/lib/mastra/utils/model-selector';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn((modelId: string) => ({ provider: 'openai', modelId }))
}));

jest.mock('@ai-sdk/anthropic', () => ({
  anthropic: jest.fn((modelId: string) => ({ provider: 'anthropic', modelId }))
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  }
}));

describe('ModelSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance
    (ModelSelector as any).instance = undefined;
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ModelSelector.getInstance();
      const instance2 = ModelSelector.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should initialize usage stats', () => {
      const instance = ModelSelector.getInstance();
      const stats = ModelSelector.getUsageStats();
      
      expect(stats).toEqual({
        simple: 0,
        moderate: 0,
        complex: 0,
        specialized: 0
      });
    });
  });

  describe('selectByComplexity', () => {
    it('should select GPT-4o-mini for simple tasks', () => {
      const result = ModelSelector.selectByComplexity('simple');
      
      expect(openai).toHaveBeenCalledWith('gpt-4o-mini');
      expect(result).toEqual({ provider: 'openai', modelId: 'gpt-4o-mini' });
    });

    it('should select GPT-4o-mini for moderate tasks', () => {
      const result = ModelSelector.selectByComplexity('moderate');
      
      expect(openai).toHaveBeenCalledWith('gpt-4o-mini');
      expect(result).toEqual({ provider: 'openai', modelId: 'gpt-4o-mini' });
    });

    it('should select GPT-4o for complex tasks', () => {
      const result = ModelSelector.selectByComplexity('complex');
      
      expect(openai).toHaveBeenCalledWith('gpt-4o');
      expect(result).toEqual({ provider: 'openai', modelId: 'gpt-4o' });
    });

    it('should select Claude for specialized tasks', () => {
      const result = ModelSelector.selectByComplexity('specialized');
      
      expect(anthropic).toHaveBeenCalledWith('claude-3-5-sonnet-20241022');
      expect(result).toEqual({ provider: 'anthropic', modelId: 'claude-3-5-sonnet-20241022' });
    });

    it('should log model selection', () => {
      ModelSelector.selectByComplexity('complex');
      
      expect(logger.info).toHaveBeenCalledWith(
        '[ModelSelector] Model selected',
        expect.objectContaining({
          complexity: 'complex',
          provider: 'openai',
          modelId: 'gpt-4o',
          costPerToken: 0.0025,
          usageCount: 1
        })
      );
    });

    it('should track usage statistics', () => {
      ModelSelector.selectByComplexity('simple');
      ModelSelector.selectByComplexity('simple');
      ModelSelector.selectByComplexity('complex');
      
      const stats = ModelSelector.getUsageStats();
      
      expect(stats).toEqual({
        simple: 2,
        moderate: 0,
        complex: 1,
        specialized: 0
      });
    });
  });

  describe('analyzeComplexity', () => {
    describe('simple tasks', () => {
      it('should identify price-related tasks as simple', () => {
        const testCases = [
          '価格を教えて',
          'What is the price?',
          'いくらですか？',
          'How much does it cost?',
          'Show price'
        ];

        testCases.forEach(task => {
          expect(ModelSelector.analyzeComplexity(task)).toBe('simple');
        });
      });

      it('should identify short tasks as simple', () => {
        expect(ModelSelector.analyzeComplexity('Hello')).toBe('simple');
        expect(ModelSelector.analyzeComplexity('Test')).toBe('simple');
      });
    });

    describe('specialized tasks', () => {
      it('should identify creative tasks as specialized', () => {
        const testCases = [
          'クリエイティブな提案をして',
          'Write a creative story',
          '詩を作って',
          'Compose a poem',
          'ストーリーを考えて',
          'Create a story'
        ];

        testCases.forEach(task => {
          expect(ModelSelector.analyzeComplexity(task)).toBe('specialized');
        });
      });

      it('should respect requiresNuance context', () => {
        expect(ModelSelector.analyzeComplexity('Translate this', { requiresNuance: true }))
          .toBe('specialized');
      });
    });

    describe('complex tasks', () => {
      it('should identify analysis tasks as complex', () => {
        const testCases = [
          'この市場を分析してください',
          'Perform detailed analysis',
          '戦略を立ててください',
          'Develop a strategy',
          '複雑な問題を解決して',
          'Solve this complex problem'
        ];

        testCases.forEach(task => {
          expect(ModelSelector.analyzeComplexity(task)).toBe('complex');
        });
      });

      it('should identify long tasks as complex', () => {
        const longTask = 'a'.repeat(101);
        expect(ModelSelector.analyzeComplexity(longTask)).toBe('complex');
      });

      it('should respect multiStep context', () => {
        expect(ModelSelector.analyzeComplexity('Do something', { multiStep: true }))
          .toBe('complex');
      });
    });

    describe('moderate tasks', () => {
      it('should default to moderate for unmatched tasks', () => {
        const testCases = [
          'Explain this concept to me in detail',
          'Help me understand this topic',
          'What do you think about this situation?'
        ];

        testCases.forEach(task => {
          expect(ModelSelector.analyzeComplexity(task)).toBe('moderate');
        });
      });
    });
  });

  describe('autoSelect', () => {
    it('should analyze and select appropriate model', () => {
      const result = ModelSelector.autoSelect('価格を教えて');
      
      expect(openai).toHaveBeenCalledWith('gpt-4o-mini');
      expect(result).toEqual({ provider: 'openai', modelId: 'gpt-4o-mini' });
    });

    it('should use context for model selection', () => {
      const result = ModelSelector.autoSelect('Translate this text', { requiresNuance: true });
      
      expect(anthropic).toHaveBeenCalledWith('claude-3-5-sonnet-20241022');
      expect(result).toEqual({ provider: 'anthropic', modelId: 'claude-3-5-sonnet-20241022' });
    });

    it('should handle complex task analysis', () => {
      const result = ModelSelector.autoSelect('この市場データを詳細に分析して、今後の戦略を提案してください');
      
      expect(openai).toHaveBeenCalledWith('gpt-4o');
      expect(result).toEqual({ provider: 'openai', modelId: 'gpt-4o' });
    });
  });

  describe('getUsageStats', () => {
    it('should return empty stats initially', () => {
      const stats = ModelSelector.getUsageStats();
      
      expect(stats).toEqual({
        simple: 0,
        moderate: 0,
        complex: 0,
        specialized: 0
      });
    });

    it('should return accumulated usage stats', () => {
      // Use models
      ModelSelector.selectByComplexity('simple');
      ModelSelector.selectByComplexity('simple');
      ModelSelector.selectByComplexity('complex');
      ModelSelector.selectByComplexity('specialized');
      
      const stats = ModelSelector.getUsageStats();
      
      expect(stats).toEqual({
        simple: 2,
        moderate: 0,
        complex: 1,
        specialized: 1
      });
    });
  });

  describe('estimateCost', () => {
    it('should calculate cost for simple model', () => {
      const cost = ModelSelector.estimateCost('simple', 10000);
      expect(cost).toBe(1.5); // 10000/1000 * 0.00015
    });

    it('should calculate cost for complex model', () => {
      const cost = ModelSelector.estimateCost('complex', 10000);
      expect(cost).toBe(25); // 10000/1000 * 0.0025
    });

    it('should calculate cost for specialized model', () => {
      const cost = ModelSelector.estimateCost('specialized', 10000);
      expect(cost).toBe(30); // 10000/1000 * 0.003
    });

    it('should handle fractional tokens', () => {
      const cost = ModelSelector.estimateCost('simple', 1500);
      expect(cost).toBeCloseTo(0.225, 5); // 1500/1000 * 0.00015
    });
  });

  describe('getModelConfig', () => {
    it('should return config for each complexity', () => {
      const simpleConfig = ModelSelector.getModelConfig('simple');
      expect(simpleConfig).toEqual({
        provider: 'openai',
        modelId: 'gpt-4o-mini',
        description: 'Fast and cost-effective for simple tasks',
        costPerToken: 0.00015,
        speedRating: 5,
        qualityRating: 3
      });

      const complexConfig = ModelSelector.getModelConfig('complex');
      expect(complexConfig).toEqual({
        provider: 'openai',
        modelId: 'gpt-4o',
        description: 'High performance for complex reasoning',
        costPerToken: 0.0025,
        speedRating: 3,
        qualityRating: 5
      });
    });
  });

  describe('getAllConfigs', () => {
    it('should return all model configurations', () => {
      const configs = ModelSelector.getAllConfigs();
      
      expect(Object.keys(configs)).toEqual(['simple', 'moderate', 'complex', 'specialized']);
      
      Object.values(configs).forEach(config => {
        expect(config).toHaveProperty('provider');
        expect(config).toHaveProperty('modelId');
        expect(config).toHaveProperty('description');
        expect(config).toHaveProperty('costPerToken');
        expect(config).toHaveProperty('speedRating');
        expect(config).toHaveProperty('qualityRating');
      });
    });

    it('should return a copy of configs', () => {
      const configs1 = ModelSelector.getAllConfigs();
      const configs2 = ModelSelector.getAllConfigs();
      
      expect(configs1).not.toBe(configs2);
      expect(configs1).toEqual(configs2);
    });
  });

  describe('exported convenience functions', () => {
    it('should export selectModel', () => {
      const result = selectModel('complex');
      
      expect(openai).toHaveBeenCalledWith('gpt-4o');
      expect(result).toEqual({ provider: 'openai', modelId: 'gpt-4o' });
    });

    it('should export autoSelectModel', () => {
      const result = autoSelectModel('Write a creative poem');
      
      expect(anthropic).toHaveBeenCalledWith('claude-3-5-sonnet-20241022');
      expect(result).toEqual({ provider: 'anthropic', modelId: 'claude-3-5-sonnet-20241022' });
    });
  });

  describe('edge cases', () => {
    it('should handle empty task string', () => {
      expect(ModelSelector.analyzeComplexity('')).toBe('simple');
    });

    it('should handle null/undefined context gracefully', () => {
      expect(() => ModelSelector.analyzeComplexity('test', undefined)).not.toThrow();
      expect(() => ModelSelector.autoSelect('test', undefined)).not.toThrow();
    });

    it('should handle case sensitivity in task analysis', () => {
      expect(ModelSelector.analyzeComplexity('PRICE')).toBe('simple');
      expect(ModelSelector.analyzeComplexity('ANALYSIS')).toBe('complex');
      expect(ModelSelector.analyzeComplexity('CREATIVE')).toBe('specialized');
    });

    it('should handle mixed language tasks', () => {
      expect(ModelSelector.analyzeComplexity('価格 and price 情報')).toBe('simple');
      expect(ModelSelector.analyzeComplexity('分析 and analysis required')).toBe('complex');
    });
  });
});