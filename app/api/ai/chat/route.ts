import { createApiHandler, createOptionsHandler } from '@/lib/api/create-api-handler';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';
import { executeImprovedOrchestrator } from '@/lib/mastra/agents/orchestrator.agent';
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
    const runtimeContext = data.context || {};

    logger.info('[AI Chat A2A] Processing request with A2A communication', {
      sessionId,
      messageLength: userMessage.length,
      a2aEnabled: true,
    });

    try {
      // 🚀 A2A通信対応Orchestrator実行
      logger.info('[AI Chat A2A] Executing A2A-powered orchestrator');
      
      const orchestratorResult = await executeImprovedOrchestrator(
        userMessage,
        sessionId,
        runtimeContext
      );

      // Orchestratorの結果を処理
      const { message, proposalGroup: baseProposalGroup, entryProposalGroup } = processOrchestratorResult(orchestratorResult);
      let proposalGroup = baseProposalGroup;
      
      // 提案モードの場合、ProposalGroupを抽出
      if (orchestratorResult.analysis.intent === 'proposal_request' || orchestratorResult.analysis.isProposalMode) {
        proposalGroup = extractProposalGroup(orchestratorResult.executionResult);
        
        if (!proposalGroup) {
          debugProposalGroupStructure(orchestratorResult.executionResult);
        }
      }
      
      // レスポンスを構築
      const finalMessage = entryProposalGroup ? 'エントリー提案を生成しました。' : 
                           (proposalGroup && !message.includes('提案') ? 'トレンドラインの提案を生成しました。' : message);
      
      const response = buildChatResponse({
        message: finalMessage,
        orchestratorResult,
        proposalGroup: entryProposalGroup || proposalGroup,
        sessionId,
      });

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