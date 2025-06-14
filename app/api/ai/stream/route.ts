import { z } from 'zod';
import { mastra } from '@/lib/mastra/mastra';
import { logger } from '@/lib/utils/logger';
import { ValidationError, AgentError } from '@/lib/errors/base-error';
import { createSSEHandler, createSSEOptionsHandler } from '@/lib/api/create-sse-handler';

/**
 * AI Chat Streaming API - Server-Sent Events (SSE) for real-time responses
 *
 * Supports streaming responses from Mastra agents for better UX
 */

const StreamRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  agentId: z.enum(['tradingAgent', 'priceInquiryAgent', 'uiControlAgent', 'orchestratorAgent']).optional().default('tradingAgent'),
  sessionId: z.string().optional(),
  context: z.object({
    symbol: z.string().optional(),
    analysisDepth: z.enum(['basic', 'detailed', 'comprehensive']).optional(),
  }).optional(),
});

export const POST = createSSEHandler({
  handler: {
    async onConnect({ request, stream }) {
      try {
        const body = await request.json();
        const validatedInput = StreamRequestSchema.parse(body);

        logger.info('[AI Stream API] Processing streaming request', {
          agentId: validatedInput.agentId,
          sessionId: validatedInput.sessionId,
          messageLength: validatedInput.message.length,
        });

        const agent = mastra.getAgent(validatedInput.agentId);
        if (!agent) {
          throw new AgentError(
            `Agent ${validatedInput.agentId} not found`,
            validatedInput.agentId,
            { code: 'AGENT_NOT_FOUND' }
          );
        }

        if (!agent.stream) {
          logger.warn('[AI Stream API] Agent does not support streaming, falling back to generate', {
            agentId: validatedInput.agentId,
          });

          const response = await agent.generate(validatedInput.message);
          const text = typeof response === 'string' ? response : response.text || String(response);
          stream.write({ data: text });
          stream.close();
          return;
        }

        const streamResult = await agent.stream(validatedInput.message);
        for await (const chunk of streamResult.textStream) {
          let text = '';
          if (typeof chunk === 'string') {
            text = chunk;
          } else if (chunk && typeof chunk === 'object') {
            const chunkObj = chunk as { content?: string; delta?: { content?: string }; text?: string };
            text = chunkObj.content ?? chunkObj.delta?.content ?? chunkObj.text ?? '';
          }
          if (text) {
            stream.write({ data: { type: 'chunk', text } });
          }
        }
        stream.write({ data: { type: 'end' } });
        stream.close();
      } catch (error) {
        logger.error('[AI Stream API] Request failed', { error });
        if (error instanceof z.ZodError) {
          stream.write({ data: { error: 'Invalid request data', details: error.errors } });
        } else if (error instanceof AgentError || error instanceof ValidationError) {
          stream.write({ data: { error: error.message } });
        } else {
          stream.write({ data: { error: (error as Error).message } });
        }
        stream.close();
      }
    }
  },
  cors: { origin: '*' },
  heartbeat: { enabled: true, interval: 30000 }
});

export const GET = createSSEHandler({
  handler: {
    async onConnect({ request, stream }) {
      const { searchParams } = new URL(request.url);
      const message = searchParams.get('message');
      const agentId = (searchParams.get('agentId') ?? 'tradingAgent') as 'tradingAgent' | 'priceInquiryAgent' | 'uiControlAgent' | 'orchestratorAgent';
      const sessionId = searchParams.get('sessionId') ?? undefined;
      const contextJson = searchParams.get('context');

      const pushJSON = (payload: Record<string, unknown>) => {
        stream.write({ data: payload });
      };

      if (!message) {
        logger.warn('[AI Stream API] GET without message param');
      }

      try {
        if (message) {
          const agent = mastra.getAgent(agentId);
          if (!agent?.stream) {
            throw new AgentError('Agent not found or does not support streaming', agentId);
          }
          const ctx = contextJson ? JSON.parse(contextJson) : undefined;
          const streamResult = await agent.stream(message, { sessionId, context: ctx });
          for await (const chunk of streamResult.textStream) {
            let text = '';
            if (typeof chunk === 'string') {
              text = chunk;
            } else if (chunk && typeof chunk === 'object') {
              const c = chunk as { content?: string; delta?: { content?: string }; text?: string };
              text = c.content ?? c.delta?.content ?? c.text ?? '';
            }
            if (text) {
              pushJSON({ type: 'chunk', text });
            }
          }
        }
        pushJSON({ type: 'end' });
        stream.close();
      } catch (err) {
        logger.error('[AI Stream API] GET streaming error', { error: String(err) });
        pushJSON({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
        stream.close();
      }
    }
  },
  heartbeat: { enabled: true, interval: 30000 },
  cors: { origin: '*' }
});

export const OPTIONS = createSSEOptionsHandler({ origin: '*' });
