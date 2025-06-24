/**
 * Parallel Processing Orchestrator
 * 
 * Optimized orchestrator with parallel execution capabilities
 * for complex queries to reduce latency from 5.7s to under 2s
 */

import { logger } from '@/lib/utils/logger';
import { generateCorrelationId } from '@/types/agent-payload';
import { analyzeIntent, type IntentAnalysisResult } from '../utils/intent';
import { agentSelectionTool } from '../tools/agent-selection.tool';
import { marketSnapshotTool } from '../tools/market-snapshot.tool';
import { marketDataResilientTool } from '../tools/market-data-resilient.tool';
import { useEnhancedConversationMemory, createEnhancedSession } from '@/lib/store/enhanced-conversation-memory.store';
import { raceWithCleanup } from '@/lib/utils/concurrent';
import type { OrchestratorExecutionResponse, OrchestratorRuntimeContext } from './orchestrator.agent';

// Parallel execution configuration
interface ParallelConfig {
  maxConcurrency: number;
  timeoutMs: number;
  enableBatching: boolean;
  enablePreloading: boolean;
}

const DEFAULT_PARALLEL_CONFIG: ParallelConfig = {
  maxConcurrency: 5,
  timeoutMs: 10000,
  enableBatching: true,
  enablePreloading: true,
};



/**
 * Enhanced orchestrator with parallel processing capabilities
 */
export class ParallelOrchestrator {
  private config: ParallelConfig;
  
  constructor(config: Partial<ParallelConfig> = {}) {
    this.config = { ...DEFAULT_PARALLEL_CONFIG, ...config };
  }
  
  /**
   * Execute orchestrator with parallel processing
   */
  async execute(
    userQuery: string,
    sessionId?: string,
    _runtimeContext?: OrchestratorRuntimeContext
  ): Promise<OrchestratorExecutionResponse> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId();
    
    try {
      // Phase 1: Parallel initialization
      const [sessionData, intentAnalysis] = await Promise.all([
        this.initializeSession(sessionId, correlationId),
        this.analyzeIntentParallel(userQuery, correlationId),
      ]);
      
      logger.info('[ParallelOrchestrator] Phase 1 complete', {
        correlationId,
        phase1Duration: Date.now() - startTime,
        intent: intentAnalysis.intent,
        confidence: intentAnalysis.confidence,
      });
      
      // Phase 2: Parallel data gathering (if needed)
      const contextData = await this.gatherContextParallel(
        userQuery,
        intentAnalysis,
        sessionData.sessionId,
        correlationId
      );
      
      logger.info('[ParallelOrchestrator] Phase 2 complete', {
        correlationId,
        phase2Duration: Date.now() - startTime,
        hasMemoryContext: !!contextData.memoryContext,
        hasMarketData: !!contextData.marketData,
      });
      
      // Phase 3: Parallel agent execution
      const executionResult = await this.executeAgentsParallel(
        userQuery,
        intentAnalysis,
        contextData,
        sessionData.sessionId,
        correlationId
      );
      
      const totalDuration = Date.now() - startTime;
      
      logger.info('[ParallelOrchestrator] Execution complete', {
        correlationId,
        totalDuration,
        phases: {
          initialization: sessionData.duration,
          analysis: intentAnalysis.duration || 0,
          execution: executionResult.duration || 0,
        },
      });
      
      return {
        analysis: intentAnalysis,
        executionResult: executionResult.result,
        executionTime: totalDuration,
        success: true,
        memoryContext: contextData.memoryContext,
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('[ParallelOrchestrator] Failed', {
        correlationId,
        error: String(error),
        executionTime,
      });
      
      return {
        analysis: {
          intent: 'conversational' as const,
          confidence: 0.5,
          reasoning: 'エラーフォールバック',
          analysisDepth: 'basic' as const,
        },
        executionTime,
        success: false,
      };
    }
  }
  
  /**
   * Initialize session with memory store
   */
  private async initializeSession(
    sessionId?: string,
    _correlationId?: string
  ): Promise<{ sessionId: string; duration: number }> {
    const start = Date.now();
    const memoryStore = useEnhancedConversationMemory.getState();
    
    const activeSessionId = sessionId || memoryStore.currentSessionId || 
      await createEnhancedSession(undefined, {
        maxTokens: 127000,
        excludeTools: ['marketDataTool', 'chartControlTool'],
      });
    
    return {
      sessionId: activeSessionId,
      duration: Date.now() - start,
    };
  }
  
  /**
   * Analyze intent with parallel processing
   */
  private async analyzeIntentParallel(
    userQuery: string,
    correlationId: string
  ): Promise<IntentAnalysisResult & { duration?: number }> {
    const start = Date.now();
    
    try {
      // Use existing intent analysis
      const analysis = analyzeIntent(userQuery);
      
      return {
        ...analysis,
        duration: Date.now() - start,
      };
    } catch (error) {
      logger.error('[ParallelOrchestrator] Intent analysis failed', {
        correlationId,
        error: String(error),
      });
      
      // Fallback analysis
      return {
        intent: 'conversational' as const,
        confidence: 0.5,
        reasoning: 'Analysis failed',
        analysisDepth: 'basic' as const,
        duration: Date.now() - start,
      };
    }
  }
  
  /**
   * Gather context data in parallel
   */
  private async gatherContextParallel(
    _userQuery: string,
    analysis: IntentAnalysisResult,
    sessionId: string,
    correlationId: string
  ): Promise<{
    memoryContext?: string;
    marketData?: any;
    trendingTopics?: any;
  }> {
    const operations: Array<{
      name: string;
      execute: () => Promise<any>;
      optional: boolean;
    }> = [];
    
    // Add memory recall if needed
    if (this.shouldRecallMemory(analysis)) {
      operations.push({
        name: 'memoryRecall',
        execute: async () => {
          const memoryStore = useEnhancedConversationMemory.getState();
          return memoryStore.getSessionContext(sessionId);
        },
        optional: true,
      });
    }
    
    // Add market snapshot for trading-related queries
    if (this.shouldFetchMarketData(analysis)) {
      operations.push({
        name: 'marketSnapshot',
        execute: async () => {
          try {
            const result = await (marketSnapshotTool as any).execute({ context: {} });
            return result;
          } catch (error) {
            logger.warn('[ParallelOrchestrator] Market snapshot failed', { error: String(error) });
            return null;
          }
        },
        optional: true,
      });
      
      // Also get quick price if symbol is mentioned
      if (analysis.extractedSymbol) {
        operations.push({
          name: 'quickPrice',
          execute: async () => {
            try {
              const result = await (marketDataResilientTool as any).execute({
                context: { symbol: analysis.extractedSymbol }
              });
              return result;
            } catch (error) {
              logger.warn('[ParallelOrchestrator] Quick price failed', { error: String(error) });
              return null;
            }
          },
          optional: true,
        });
      }
    }
    
    // Execute all operations in parallel
    if (operations.length === 0) {
      return {};
    }
    
    const results = await this.executeParallelOperations(operations, correlationId);
    
    // Map results
    const context: any = {};
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const opName = operations[index]?.name;
        if (opName === 'memoryRecall') {
          context.memoryContext = result.value;
        } else if (opName === 'marketSnapshot') {
          context.marketData = result.value;
        } else if (opName === 'quickPrice') {
          context.quickPrice = result.value;
        }
      }
    });
    
    return context;
  }
  
  /**
   * Execute agents in parallel when possible
   */
  private async executeAgentsParallel(
    userQuery: string,
    analysis: IntentAnalysisResult,
    contextData: any,
    sessionId: string,
    correlationId: string
  ): Promise<{ result: any; duration: number }> {
    // const start = Date.now();
    
    // For complex queries that require multiple agents
    if (this.isComplexQuery(analysis, userQuery)) {
      return this.executeComplexQueryParallel(
        userQuery,
        analysis,
        contextData,
        sessionId,
        correlationId
      );
    }
    
    // For simple queries, use single agent execution
    return this.executeSingleAgent(
      userQuery,
      analysis,
      contextData,
      sessionId,
      correlationId
    );
  }
  
  /**
   * Execute complex query with multiple agents in parallel
   */
  private async executeComplexQueryParallel(
    userQuery: string,
    analysis: IntentAnalysisResult,
    contextData: any,
    sessionId: string,
    correlationId: string
  ): Promise<{ result: any; duration: number }> {
    const start = Date.now();
    
    // Identify required agents based on query
    const requiredAgents = this.identifyRequiredAgents(userQuery, analysis);
    
    logger.info('[ParallelOrchestrator] Executing complex query', {
      correlationId,
      requiredAgents,
      queryLength: userQuery.length,
    });
    
    // Create parallel operations for each agent
    const operations = requiredAgents.map(agentType => ({
      name: agentType,
      execute: async () => {
        try {
          const result = await agentSelectionTool.execute({
            context: {
              agentType: agentType as any,
              query: userQuery,
              context: {
                ...contextData,
                extractedSymbol: analysis.extractedSymbol || 'BTCUSDT',
                analysisDepth: analysis.analysisDepth,
                sessionId,
                isProposalMode: analysis.isProposalMode,
                proposalType: analysis.proposalType,
              },
              correlationId,
            },
          } as any);
          return result;
        } catch (error) {
          logger.error('[ParallelOrchestrator] Agent execution failed', {
            agentType,
            error: String(error),
          });
          throw error;
        }
      },
      optional: false,
    }));
    
    // Execute all agents in parallel
    const results = await this.executeParallelOperations(operations, correlationId);
    
    // Aggregate results
    const aggregatedResult = this.aggregateAgentResults(results, operations);
    
    return {
      result: aggregatedResult,
      duration: Date.now() - start,
    };
  }
  
  /**
   * Execute single agent for simple queries
   */
  private async executeSingleAgent(
    userQuery: string,
    analysis: IntentAnalysisResult,
    contextData: any,
    sessionId: string,
    correlationId: string
  ): Promise<{ result: any; duration: number }> {
    const start = Date.now();
    
    // Map intent to agent type
    const agentType = this.mapIntentToAgent(analysis.intent);
    
    const result = await agentSelectionTool.execute({
      context: {
        agentType,
        query: userQuery,
        context: {
          ...contextData,
          extractedSymbol: analysis.extractedSymbol || 'BTCUSDT',
          analysisDepth: analysis.analysisDepth,
          sessionId,
          isProposalMode: analysis.isProposalMode,
          proposalType: analysis.proposalType,
        },
        correlationId,
      },
    } as any);
    
    return {
      result,
      duration: Date.now() - start,
    };
  }
  
  /**
   * Execute operations in parallel with proper error handling
   */
  private async executeParallelOperations(
    operations: Array<{
      name: string;
      execute: () => Promise<any>;
      optional: boolean;
    }>,
    correlationId: string
  ): Promise<PromiseSettledResult<any>[]> {
    logger.debug('[ParallelOrchestrator] Executing parallel operations', {
      correlationId,
      operationCount: operations.length,
      operations: operations.map(op => op.name),
    });
    
    // Use Promise.allSettled to handle partial failures
    const promises = operations.map(op => 
      raceWithCleanup([
        async (signal) => {
          const abortPromise = new Promise<never>((_, reject) => {
            signal.addEventListener('abort', () => {
              reject(new Error(`Operation ${op.name} aborted`));
            });
          });
          
          return Promise.race([op.execute(), abortPromise]);
        }
      ], {
        timeout: this.config.timeoutMs,
        onCleanup: (error) => {
          logger.warn('[ParallelOrchestrator] Operation timeout', {
            operation: op.name,
            error: error.message,
          });
        }
      })
    );
    
    const results = await Promise.allSettled(promises);
    
    // Log results
    results.forEach((result, index) => {
      const op = operations[index];
      if (result.status === 'rejected' && op && !op.optional) {
        logger.error('[ParallelOrchestrator] Required operation failed', {
          operation: op.name,
          error: result.reason,
        });
      }
    });
    
    return results;
  }
  
  /**
   * Helper methods
   */
  
  private shouldRecallMemory(analysis: IntentAnalysisResult): boolean {
    // Always recall for complex queries and analysis
    return ['trading_analysis', 'proposal_request'].includes(analysis.intent) ||
           analysis.analysisDepth === 'comprehensive';
  }
  
  private shouldFetchMarketData(analysis: IntentAnalysisResult): boolean {
    // Fetch for trading-related intents
    return ['price_inquiry', 'trading_analysis', 'proposal_request'].includes(analysis.intent) ||
           analysis.extractedSymbol !== undefined;
  }
  
  private isComplexQuery(analysis: IntentAnalysisResult, userQuery: string): boolean {
    // Complex if:
    // 1. Multiple operations requested (e.g., "分析して提案して")
    // 2. Comprehensive analysis requested
    // 3. Query contains multiple symbols
    // 4. Query length suggests complexity
    
    const multipleOperations = userQuery.includes('して') && 
      (userQuery.match(/して/g) || []).length > 1;
    
    const multipleSymbols = (userQuery.match(/[A-Z]{3,}/g) || []).length > 1;
    
    return multipleOperations ||
           analysis.analysisDepth === 'comprehensive' ||
           multipleSymbols ||
           userQuery.length > 100;
  }
  
  private identifyRequiredAgents(userQuery: string, analysis: IntentAnalysisResult): string[] {
    const agents: Set<string> = new Set();
    
    // Base agent from intent
    agents.add(this.mapIntentToAgent(analysis.intent));
    
    // Additional agents based on query content
    if (userQuery.includes('価格') || userQuery.includes('いくら')) {
      agents.add('price_inquiry');
    }
    
    if (userQuery.includes('分析') || userQuery.includes('提案')) {
      agents.add('trading_analysis');
    }
    
    if (userQuery.includes('チャート') || userQuery.includes('描画') || userQuery.includes('表示')) {
      agents.add('ui_control');
    }
    
    return Array.from(agents);
  }
  
  private mapIntentToAgent(intent: string): 'price_inquiry' | 'ui_control' | 'trading_analysis' {
    switch (intent) {
      case 'price_inquiry':
        return 'price_inquiry';
      case 'ui_control':
        return 'ui_control';
      case 'trading_analysis':
      case 'proposal_request':
        return 'trading_analysis';
      default:
        return 'trading_analysis';
    }
  }
  
  private aggregateAgentResults(
    results: PromiseSettledResult<any>[],
    operations: Array<{ name: string }>
  ): any {
    const successfulResults: any[] = [];
    const responses: string[] = [];
    let proposalGroup: any = null;
    const toolResults: any[] = [];
    
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        const agentResult = result.value;
        successfulResults.push(agentResult);
        
        // Extract response text
        if (agentResult.executionResult?.response) {
          responses.push(agentResult.executionResult.response);
        }
        
        // Extract proposal group (prefer the first one found)
        if (!proposalGroup && agentResult.executionResult?.proposalGroup) {
          proposalGroup = agentResult.executionResult.proposalGroup;
        }
        
        // Collect tool results
        if (agentResult.executionResult?.toolResults) {
          toolResults.push(...agentResult.executionResult.toolResults);
        }
      }
    });
    
    // Combine responses intelligently
    const combinedResponse = this.combineResponses(responses, operations.map(op => op.name));
    
    return {
      response: combinedResponse,
      proposalGroup,
      toolResults,
      metadata: {
        processedBy: 'parallel-orchestrator',
        agentsUsed: operations.map(op => op.name),
        successfulAgents: successfulResults.length,
        totalAgents: operations.length,
      },
    };
  }
  
  private combineResponses(responses: string[], agentTypes: string[]): string {
    if (responses.length === 0) {
      return '申し訳ございません。応答を生成できませんでした。';
    }
    
    if (responses.length === 1) {
      return responses[0] || '';
    }
    
    // Combine multiple responses intelligently
    let combined = '';
    
    // Price information first
    const priceIndex = agentTypes.findIndex(t => t === 'price_inquiry');
    if (priceIndex >= 0 && responses[priceIndex]) {
      combined += responses[priceIndex] + '\n\n';
    }
    
    // Analysis information
    const analysisIndex = agentTypes.findIndex(t => t === 'trading_analysis');
    if (analysisIndex >= 0 && responses[analysisIndex]) {
      combined += responses[analysisIndex];
    }
    
    // UI operations last
    const uiIndex = agentTypes.findIndex(t => t === 'ui_control');
    if (uiIndex >= 0 && responses[uiIndex]) {
      if (combined) combined += '\n\n';
      combined += responses[uiIndex];
    }
    
    return combined || responses.join('\n\n');
  }
}

// Export singleton instance
export const parallelOrchestrator = new ParallelOrchestrator();