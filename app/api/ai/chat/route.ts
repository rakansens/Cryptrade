import { createApiHandler, createOptionsHandler } from '@/lib/api/create-api-handler';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';
import { executeImprovedOrchestrator } from '@/lib/mastra/agents/orchestrator.agent';
import type { OrchestratorResult, ExecutionResult } from '@/lib/api/types';
import { extractProposalGroup, debugProposalGroupStructure } from '@/lib/api/helpers/proposal-extractor';
import { buildChatResponse, processOrchestratorResult } from '@/lib/api/helpers/response-builder';
import { createOrchestratorErrorResponse } from '@/lib/api/helpers/error-handler';
import { registerAgentsSafely } from '@/lib/api/helpers/request-validator';

// Define request schema
const ChatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  sessionId: z.string().optional(),
  context: z.object({
    symbol: z.string().optional(),
    interval: z.string().optional(),
    analysisDepth: z.enum(['basic', 'detailed', 'comprehensive']).optional(),
  }).optional(),
});

type ChatRequest = z.infer<typeof ChatRequestSchema>;

// Create the POST handler using the factory
export const POST = createApiHandler<ChatRequest>({
  // Configure rate limiting
  rateLimitOptions: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 AI requests per minute
  },
  
  // Define request schema for validation
  schema: ChatRequestSchema,
  
  // Main handler logic
  handler: async ({ data, context }) => {
    // Register agents
    registerAgentsSafely();

    const userMessage = data.message;
    const sessionId = data.sessionId || context.sessionId || `chat-session-${Date.now()}`;

    logger.info('[AI Chat A2A] Processing request with A2A communication', {
      sessionId,
      messageLength: userMessage.length,
      a2aEnabled: true,
    });

    try {
      // 🚀 A2A通信対応Orchestrator実行
      logger.info('[AI Chat A2A] Executing A2A-powered orchestrator');
      
      const orchestratorResponse = await executeImprovedOrchestrator(
        userMessage,
        sessionId
      );

      // Convert OrchestratorExecutionResponse to OrchestratorResult
      const orchestratorResult: OrchestratorResult = {
        success: orchestratorResponse.success,
        proposalGroup: orchestratorResponse.executionResult?.proposalGroup,
        error: orchestratorResponse.executionResult?.error ? {
          code: (orchestratorResponse.executionResult.error as any).code || 'UNKNOWN_ERROR',
          message: orchestratorResponse.executionResult.error.message || 'Unknown error occurred',
          details: (orchestratorResponse.executionResult.error as any).details,
          stack: (orchestratorResponse.executionResult.error as any).stack
        } : undefined,
        metadata: orchestratorResponse.executionResult?.metadata || undefined,
        analysis: {
          intent: orchestratorResponse.analysis.intent as string,
          confidence: orchestratorResponse.analysis.confidence,
          reasoning: (orchestratorResponse.analysis as any).reasoning || '',
          analysisDepth: (orchestratorResponse.analysis as any).analysisDepth || 'basic',
          isProposalMode: (orchestratorResponse.analysis as any).isProposalMode === true,
          proposalType: (orchestratorResponse.analysis as any).proposalType,
        },
        executionTime: orchestratorResponse.executionTime,
        executionResult: orchestratorResponse.executionResult ? ({
          ...orchestratorResponse.executionResult,
          success: orchestratorResponse.executionResult.response ? true : false,
          executionResult: undefined
        } as unknown as ExecutionResult) : undefined,
        memoryContext: orchestratorResponse.memoryContext,
      };

      // Orchestratorの結果を処理
      const { message, proposalGroup: baseProposalGroup, entryProposalGroup } = processOrchestratorResult(orchestratorResult);
      let proposalGroup = baseProposalGroup;
      
      // 提案モードの場合、ProposalGroupを抽出
      if (orchestratorResult.analysis.intent === 'proposal_request' || orchestratorResult.analysis.isProposalMode === true) {
        proposalGroup = extractProposalGroup(orchestratorResult.executionResult);
        
        if (!proposalGroup) {
          debugProposalGroupStructure(orchestratorResult.executionResult);
        }
      }
      
      // レスポンスを構築
      const finalMessage = entryProposalGroup ? 'エントリー提案を生成しました。' : 
                           (proposalGroup && !message.includes('提案') ? 'トレンドラインの提案を生成しました。' : message);
      
      const responseParams: any = {
        message: finalMessage,
        orchestratorResult,
        sessionId,
      };
      
      if (entryProposalGroup || proposalGroup) {
        responseParams.proposalGroup = entryProposalGroup || proposalGroup;
      }
      
      const response = buildChatResponse(responseParams);

      logger.info('[AI Chat A2A] A2A orchestrator completed successfully', {
        intent: orchestratorResult.analysis.intent,
        confidence: orchestratorResult.analysis.confidence,
        executionTime: orchestratorResult.executionTime,
        success: orchestratorResult.success,
        hasProposalGroup: !!proposalGroup,
        hasEntryProposalGroup: !!entryProposalGroup,
      });

      return response;

    } catch (orchestratorError) {
      logger.error('[AI Chat A2A] A2A orchestrator failed', {
        error: String(orchestratorError),
        userMessage: userMessage.substring(0, 100),
      });

      // Orchestratorエラー用のフォールバックレスポンス
      return createOrchestratorErrorResponse(
        orchestratorError instanceof Error ? orchestratorError : new Error(String(orchestratorError)),
        sessionId
      );
    }
  },
});

// Create OPTIONS handler for CORS
export const OPTIONS = createOptionsHandler();