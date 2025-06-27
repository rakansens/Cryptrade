/**
 * TypeDefinitions - Phase 2 TDD Green phase implementation
 * 責務: 型定義、バリデーション、デフォルト値管理
 */

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

export class TypeDefinitions {

  validateOrchestratorContext(context: OrchestratorAgentContext): boolean {
    if (!context || Object.keys(context).length === 0) {
      return true;
    }

    if (context.queryComplexity && !['simple', 'complex'].includes(context.queryComplexity)) {
      return false;
    }

    if (context.userTier && !['free', 'premium'].includes(context.userTier)) {
      return false;
    }

    if (context.userLevel && !['beginner', 'intermediate', 'expert'].includes(context.userLevel)) {
      return false;
    }

    if (context.marketStatus && !['open', 'closed'].includes(context.marketStatus)) {
      return false;
    }

    if (context.isProposalMode !== undefined && typeof context.isProposalMode !== 'boolean') {
      return false;
    }

    if (context.marketContext) {
      const { condition, volatility } = context.marketContext;
      if (condition && !['volatile', 'stable'].includes(condition)) {
        return false;
      }
      if (volatility && !['high', 'low'].includes(volatility)) {
        return false;
      }
    }

    return true;
  }

  validateExecutionResult(result: ExecutionResult): boolean {
    if (!result || typeof result.success !== 'boolean') {
      return false;
    }

    if (!result.success && !result.error) {
      return false;
    }

    if (result.success && result.analysis) {
      const analysis = result.analysis;
      if (!analysis.intent || !analysis.reasoning || typeof analysis.confidence !== 'number') {
        return false;
      }

      if (analysis.confidence < 0 || analysis.confidence > 1) {
        return false;
      }

      if (!['basic', 'detailed', 'comprehensive'].includes(analysis.analysisDepth)) {
        return false;
      }
    }

    return true;
  }

  createDefaultContext(): OrchestratorAgentContext {
    return {
      queryComplexity: 'simple',
      userTier: 'free',
      isProposalMode: false,
      userLevel: 'beginner',
      marketStatus: 'closed',
      language: 'ja'
    };
  }

  createDefaultExecutionResult(executionTime: number = 1000): any {
    return {
      success: true,
      text: 'Default execution completed',
      analysis: {
        intent: 'conversational',
        confidence: 0.5,
        reasoning: 'デフォルト実行結果',
        analysisDepth: 'basic'
      },
      metadata: {
        executionTime,
        selectedAgent: 'default_agent',
        modelUsed: 'gpt-4o-mini'
      }
    };
  }

  mergeContexts(base: OrchestratorAgentContext, override: Partial<OrchestratorAgentContext>): OrchestratorAgentContext {
    const merged = { ...base, ...override };

    if (base.marketContext && override.marketContext) {
      merged.marketContext = {
        ...base.marketContext,
        ...override.marketContext
      };
    }

    return merged;
  }

  extractAnalysisResult(response: ExecutionResponse): ExtendedIntentAnalysisResult | null {
    if (!response.analysis) {
      return null;
    }

    return {
      intent: response.analysis.intent,
      confidence: response.analysis.confidence,
      reasoning: response.analysis.reasoning,
      analysisDepth: response.analysis.analysisDepth,
      userLevel: response.analysis.userLevel,
      marketContext: response.analysis.marketContext,
      extractedSymbol: response.analysis.extractedSymbol,
      isProposalMode: response.analysis.isProposalMode,
      proposalType: (response.analysis as any).proposalType
    };
  }

  validateExecutionResponse(response: ExecutionResponse): boolean {
    if (!response || !response.text) {
      return false;
    }

    // 分析結果がある場合の検証
    if (response.analysis) {
      const analysis = response.analysis;
      if (!analysis.intent || typeof analysis.confidence !== 'number') {
        return false;
      }

      if (analysis.confidence < 0 || analysis.confidence > 1) {
        return false;
      }
    }

    // メタデータがある場合の検証
    if (response.metadata) {
      const metadata = response.metadata;
      if (typeof metadata.executionTime !== 'number' ||
          !metadata.selectedAgent ||
          !metadata.modelUsed) {
        return false;
      }
    }

    return true;
  }

  validateRuntimeContext(context: RuntimeContext): boolean {
    if (!context) {
      return true; // nullやundefinedは有効
    }

    if (context.userLevel && !['beginner', 'intermediate', 'expert'].includes(context.userLevel)) {
      return false;
    }

    if (context.marketStatus && !['open', 'closed'].includes(context.marketStatus)) {
      return false;
    }

    return true;
  }
}