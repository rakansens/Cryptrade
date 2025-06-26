// Phase 2 TDD: 🟢 Green フェーズ - TypeDefinitions分離用テスト
// 型定義管理ロジックの分離テスト

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TypeDefinitions } from '@/lib/mastra/agents/core/type-definitions';

// テスト対象の型定義
interface OrchestratorAgentContext {
  queryComplexity?: string;
  userTier?: string;
  isProposalMode?: boolean;
  userLevel?: string;
  marketStatus?: string;
  language?: string;
  runtimeContext?: any;
  sessionId?: string;
  marketContext?: {
    condition: 'volatile' | 'stable';
    volatility: 'high' | 'low';
  };
}

interface ExtendedIntentAnalysisResult {
  intent: string;
  confidence: number;
  reasoning: string;
  analysisDepth: string;
  userLevel?: string;
  marketContext?: {
    condition: 'volatile' | 'stable';
    volatility: 'high' | 'low';
  };
  extractedSymbol?: string;
  isProposalMode?: boolean;
  proposalType?: string;
}

interface ExecutionResult {
  success: boolean;
  analysis?: ExtendedIntentAnalysisResult;
  text?: string;
  metadata?: {
    executionTime: number;
    selectedAgent: string;
    modelUsed: string;
  };
  error?: string;
}

interface ExecutionResponse {
  text: string;
  analysis?: ExtendedIntentAnalysisResult;
  metadata?: {
    executionTime: number;
    selectedAgent: string;
    modelUsed: string;
  };
}

interface RuntimeContext {
  sessionId?: string;
  userLevel?: 'beginner' | 'intermediate' | 'expert';
  marketStatus?: 'open' | 'closed';
}

describe('TypeDefinitions - Phase 2 TDD', () => {
  let typeDefinitions: TypeDefinitions;

  beforeEach(() => {
    typeDefinitions = new TypeDefinitions();
  });

  describe('OrchestratorAgentContext バリデーション', () => {
    it('should validate valid orchestrator context', () => {
      const validContext = {
        queryComplexity: 'simple',
        userTier: 'premium',
        isProposalMode: false,
        userLevel: 'intermediate',
        marketStatus: 'open',
        language: 'ja',
        sessionId: 'test-session-001',
        marketContext: {
          condition: 'stable' as const,
          volatility: 'low' as const,
        },
      };

      const result = typeDefinitions.validateOrchestratorContext(validContext);

      expect(result).toBe(true);
    });

    it('should reject invalid orchestrator context', () => {
      const invalidContext = {
        queryComplexity: 'invalid',
        userTier: 123, // 数値は無効
        isProposalMode: 'not-boolean',
        marketContext: {
          condition: 'invalid-condition',
        },
      };

      const result = typeDefinitions.validateOrchestratorContext(invalidContext);

      expect(result).toBe(false);
    });

    it('should handle empty context gracefully', () => {
      const emptyContext = {};

      const result = typeDefinitions.validateOrchestratorContext(emptyContext);

      expect(result).toBe(true); // 空のコンテキストは有効
    });

    it('should validate market context structure', () => {
      const contextWithMarket = {
        userLevel: 'expert',
        marketContext: {
          condition: 'volatile' as const,
          volatility: 'high' as const,
        },
      };

      const result = typeDefinitions.validateOrchestratorContext(contextWithMarket);

      expect(result).toBe(true);
    });
  });

  describe('ExecutionResult バリデーション', () => {
    it('should validate complete execution result', () => {
      const validResult = {
        success: true,
        analysis: {
          intent: 'trading_analysis',
          confidence: 0.9,
          reasoning: 'Valid analysis',
          analysisDepth: 'detailed'
        },
        text: 'Test response',
        metadata: {
          executionTime: 1000,
          selectedAgent: 'test-agent',
          modelUsed: 'gpt-4o'
        }
      };

      const result = typeDefinitions.validateExecutionResult(validResult);

      expect(result).toBe(true);
    });

    it('should validate minimal execution result', () => {
      const minimalResult = {
        success: true,
        text: 'Minimal response'
      };

      const result = typeDefinitions.validateExecutionResult(minimalResult);

      expect(result).toBe(true);
    });

    it('should reject invalid execution result', () => {
      const invalidResult = {
        success: 'not-boolean', // booleanでない
        text: 123, // 文字列でない
      };

      const result = typeDefinitions.validateExecutionResult(invalidResult);

      expect(result).toBe(false);
    });

    it('should handle error in execution result', () => {
      const resultWithError = {
        success: false,
        error: 'Test error message'
      };

      const result = typeDefinitions.validateExecutionResult(resultWithError);

      expect(result).toBe(true);
    });
  });

  describe('ExecutionResponse バリデーション', () => {
    it('should validate complete execution response', () => {
      const validResponse = {
        text: 'Analysis complete',
        analysis: {
          intent: 'trading_analysis',
          confidence: 0.9,
          reasoning: 'User requested trading analysis',
          analysisDepth: 'detailed',
          userLevel: 'expert',
          extractedSymbol: 'BTCUSDT',
          isProposalMode: false,
        },
        metadata: {
          executionTime: 1500,
          selectedAgent: 'trading-agent',
          modelUsed: 'gpt-4o'
        }
      };

      const result = typeDefinitions.validateExecutionResponse(validResponse);

      expect(result).toBe(true);
    });

    it('should validate minimal execution response', () => {
      const minimalResponse = {
        text: 'Simple greeting response'
      };

      const result = typeDefinitions.validateExecutionResponse(minimalResponse);

      expect(result).toBe(true);
    });

    it('should reject invalid execution response', () => {
      const invalidResponse = {
        text: 123, // 文字列でない
        analysis: 'not-an-object',
      };

      const result = typeDefinitions.validateExecutionResponse(invalidResponse);

      expect(result).toBe(false);
    });
  });

  describe('RuntimeContext バリデーション', () => {
    it('should validate valid runtime context', () => {
      const validRuntimeContext = {
        sessionId: 'session-123',
        userLevel: 'expert' as const,
        marketStatus: 'open' as const,
      };

      const result = typeDefinitions.validateRuntimeContext(validRuntimeContext);

      expect(result).toBe(true);
    });

    it('should reject invalid enum values', () => {
      const invalidRuntimeContext = {
        userLevel: 'invalid-level',
        marketStatus: 'invalid-status',
      };

      const result = typeDefinitions.validateRuntimeContext(invalidRuntimeContext);

      expect(result).toBe(false);
    });
  });

  describe('デフォルト値生成', () => {
    it('should create default orchestrator context', () => {
      const defaultContext = typeDefinitions.createDefaultContext();

      expect(defaultContext).toBeDefined();
      expect(defaultContext.queryComplexity).toBe('simple');
      expect(defaultContext.userTier).toBe('free');
      expect(defaultContext.isProposalMode).toBe(false);
      expect(defaultContext.userLevel).toBe('beginner');
      expect(defaultContext.marketStatus).toBe('closed');
      expect(defaultContext.language).toBe('ja');
    });

    it('should create default execution result', () => {
      const defaultResult = typeDefinitions.createDefaultExecutionResult();

      expect(defaultResult).toBeDefined();
      expect(defaultResult.success).toBe(true);
      expect(defaultResult.text).toBeDefined();
      expect(defaultResult.metadata).toBeDefined();
      expect(defaultResult.analysis).toBeDefined();
    });
  });

  describe('コンテキスト操作', () => {
    it('should merge contexts correctly', () => {
      const baseContext: OrchestratorAgentContext = {
        queryComplexity: 'simple',
        userTier: 'free',
        userLevel: 'beginner',
      };

      const overrideContext: Partial<OrchestratorAgentContext> = {
        userTier: 'premium',
        isProposalMode: true,
      };

      const mergedContext = typeDefinitions.mergeContexts(baseContext, overrideContext);

      expect(mergedContext.queryComplexity).toBe('simple'); // 元の値維持
      expect(mergedContext.userTier).toBe('premium'); // 上書き
      expect(mergedContext.userLevel).toBe('beginner'); // 元の値維持
      expect(mergedContext.isProposalMode).toBe(true); // 新規追加
    });

    it('should handle deep merge for market context', () => {
      const baseContext: OrchestratorAgentContext = {
        userLevel: 'intermediate',
        marketContext: {
          condition: 'stable',
          volatility: 'low',
        },
      };

      const overrideContext: Partial<OrchestratorAgentContext> = {
        marketContext: {
          condition: 'volatile',
          volatility: 'high',
        },
      };

      const mergedContext = typeDefinitions.mergeContexts(baseContext, overrideContext);

      expect(mergedContext.marketContext?.condition).toBe('volatile');
      expect(mergedContext.marketContext?.volatility).toBe('high');
    });
  });

  describe('データ抽出', () => {
    it('should extract analysis result from execution response', () => {
      const response: ExecutionResponse = {
        text: 'BTC price response',
        analysis: {
          intent: 'price_inquiry',
          confidence: 0.95,
          reasoning: 'User asked for BTC price',
          analysisDepth: 'basic',
          extractedSymbol: 'BTCUSDT',
        }
      };

      const analysis = typeDefinitions.extractAnalysisResult(response);

      expect(analysis?.intent).toBe('price_inquiry');
      expect(analysis?.confidence).toBe(0.95);
      expect(analysis?.extractedSymbol).toBe('BTCUSDT');
    });

    it('should handle analysis result with market context', () => {
      const response: ExecutionResponse = {
        text: 'Trading analysis response',
        analysis: {
          intent: 'trading_analysis',
          confidence: 0.85,
          reasoning: 'Complex trading analysis requested',
          analysisDepth: 'comprehensive',
          userLevel: 'expert',
          marketContext: {
            condition: 'volatile',
            volatility: 'high',
          },
          isProposalMode: true,
          proposalType: 'trendline',
        }
      };

      const analysis = typeDefinitions.extractAnalysisResult(response);

      expect(analysis?.userLevel).toBe('expert');
      expect(analysis?.marketContext?.condition).toBe('volatile');
      expect(analysis?.isProposalMode).toBe(true);
      expect(analysis?.proposalType).toBe('trendline');
    });
  });
});