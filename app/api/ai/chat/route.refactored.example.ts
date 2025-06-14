/**
 * Example: Refactored AI Chat API using the new API handler factory
 * 
 * This demonstrates how to migrate existing API routes to use the new
 * createApiHandler factory pattern, reducing boilerplate and improving consistency.
 */

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
      // Execute A2A-powered orchestrator
      logger.info('[AI Chat A2A] Executing A2A-powered orchestrator');
      
      const orchestratorResult = await executeImprovedOrchestrator(
        userMessage,
        sessionId,
        runtimeContext
      );

      // Process orchestrator result
      const { message, proposalGroup: baseProposalGroup } = processOrchestratorResult(orchestratorResult);
      let proposalGroup = baseProposalGroup;
      
      // Extract proposal group if in proposal mode
      if (orchestratorResult.analysis.intent === 'proposal_request' || orchestratorResult.analysis.isProposalMode) {
        proposalGroup = extractProposalGroup(orchestratorResult.executionResult);
        
        if (!proposalGroup) {
          debugProposalGroupStructure(orchestratorResult.executionResult);
        }
      }
      
      // Build response
      const response = buildChatResponse({
        message: proposalGroup && !message.includes('提案') ? 'トレンドラインの提案を生成しました。' : message,
        orchestratorResult,
        proposalGroup,
        sessionId,
      });

      logger.info('[AI Chat A2A] A2A orchestrator completed successfully', {
        intent: orchestratorResult.analysis.intent,
        confidence: orchestratorResult.analysis.confidence,
        executionTime: orchestratorResult.executionTime,
        success: orchestratorResult.success,
        hasProposalGroup: !!proposalGroup,
      });

      return response;

    } catch (orchestratorError) {
      logger.error('[AI Chat A2A] A2A orchestrator failed', {
        error: String(orchestratorError),
        userMessage: userMessage.substring(0, 100),
      });

      // Return orchestrator error response
      return createOrchestratorErrorResponse(
        orchestratorError instanceof Error ? orchestratorError : new Error(String(orchestratorError)),
        sessionId
      );
    }
  },
});

// Create OPTIONS handler for CORS
export const OPTIONS = createOptionsHandler();

/**
 * Benefits of this refactoring:
 * 
 * 1. **Reduced Boilerplate**: 
 *    - No manual middleware application
 *    - No manual error handling
 *    - No manual response building
 * 
 * 2. **Automatic Features**:
 *    - Request validation with Zod schema
 *    - Consistent error responses
 *    - Request/response logging
 *    - Performance tracking
 *    - CORS handling
 * 
 * 3. **Type Safety**:
 *    - Full TypeScript support
 *    - Inferred types from schema
 *    - Type-safe handler parameters
 * 
 * 4. **Consistency**:
 *    - All API routes follow same pattern
 *    - Standardized error handling
 *    - Unified logging format
 */