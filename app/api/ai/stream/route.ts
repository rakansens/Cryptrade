import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { mastra } from '@/lib/mastra/mastra';
import { logger } from '@/lib/utils/logger';
import { ApiError, ValidationError, AgentError } from '@/lib/errors/base-error';
import { errorHandler } from '@/lib/api/helpers/error-handler';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedInput = StreamRequestSchema.parse(body);
    
    logger.info('[AI Stream API] Processing streaming request', {
      agentId: validatedInput.agentId,
      sessionId: validatedInput.sessionId,
      messageLength: validatedInput.message.length,
    });

    // Get the requested agent
    const agent = mastra.getAgent(validatedInput.agentId);
    if (!agent) {
      throw new AgentError(
        `Agent ${validatedInput.agentId} not found`,
        validatedInput.agentId,
        { code: 'AGENT_NOT_FOUND' }
      );
    }

    // Check if agent supports streaming
    if (!agent.stream) {
      logger.warn('[AI Stream API] Agent does not support streaming, falling back to generate', {
        agentId: validatedInput.agentId,
      });
      
      // Fallback to non-streaming response
      const response = await agent.generate(validatedInput.message);
      
      // Convert to stream for consistent API
      const stream = new ReadableStream({
        start(controller) {
          const text = typeof response === 'string' ? response : response.text || String(response);
          controller.enqueue(new TextEncoder().encode(text));
          controller.close();
        },
      });
      
      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Create streaming response
    const streamResult = await agent.stream(validatedInput.message);

    // Convert the agent stream to a ReadableStream
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamResult.textStream) {
            // Handle different chunk formats from different LLM providers
            let text = '';
            
            if (typeof chunk === 'string') {
              text = chunk;
            } else if (chunk && typeof chunk === 'object') {
              const chunkObj = chunk as { content?: string; delta?: { content?: string }; text?: string };
              if (chunkObj.content) {
                text = chunkObj.content;
              } else if (chunkObj.delta?.content) {
                text = chunkObj.delta.content;
              } else if (chunkObj.text) {
                text = chunkObj.text;
              }
            }
            
            if (text) {
              controller.enqueue(new TextEncoder().encode(text));
            }
          }
          
          try {
            controller.close();
          } catch (err) {
            // Controller might already be closed
          }
        } catch (error) {
          logger.error('[AI Stream API] Streaming error', { error });
          try {
            controller.error(error);
          } catch (err) {
            // Controller might already be closed
          }
        }
      },
    });

    logger.info('[AI Stream API] Streaming response started', {
      agentId: validatedInput.agentId,
    });

    return new NextResponse(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    logger.error('[AI Stream API] Request failed', { error });
    
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        'Invalid request data',
        'body',
        error.errors,
        { data: error.errors }
      );
    }
    
    // Use the error handler for consistent error responses
    return errorHandler(error as Error, request);
  }
}

// Also support GET for testing SSE connection
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const message = searchParams.get('message');
  const agentId = searchParams.get('agentId') ?? 'tradingAgent';
  const sessionId = searchParams.get('sessionId') ?? undefined;
  const contextJson = searchParams.get('context');

  const encoder = new TextEncoder();

  // Heartbeat interval (ms)
  const HEARTBEAT_MS = 30000;

  const stream = new ReadableStream({
    async start(controller) {
      // Helper to push SSE JSON
      const pushJSON = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      // Initial handshake
      pushJSON({ type: 'connected', timestamp: Date.now() });

      // Heartbeat to keep connection alive
      const hb = setInterval(() => {
        pushJSON({ type: 'heartbeat', timestamp: Date.now() });
      }, HEARTBEAT_MS);

      // If no message, just keep alive heartbeat
      if (!message) {
        logger.warn('[AI Stream API] GET without message param');
      }

      try {
        if (message) {
          // Run agent streaming if message provided
          const agent = mastra.getAgent(agentId as 'tradingAgent' | 'priceInquiryAgent' | 'uiControlAgent' | 'orchestratorAgent');
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
        clearInterval(hb);
        controller.close();
      } catch (err) {
        clearInterval(hb);
        logger.error('[AI Stream API] GET streaming error', { error: String(err) });
        pushJSON({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}