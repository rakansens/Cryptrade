import { NextRequest, NextResponse } from 'next/server';
import { getUIEventBus, uiEventBus, UIEventPayload } from '@/lib/server/uiEventBus';
import { logger } from '@/lib/utils/logger';
import { ValidationError } from '@/lib/errors/base-error';
import { errorHandler } from '@/lib/api/helpers/error-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/ui-events - SSE Stream（常にストリームを返す）
 */
export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: UIEventPayload) => {
        try {
          controller.enqueue(
            `event: ui-event\ndata: ${JSON.stringify(payload)}\n\n`
          );
        } catch (error) {
          console.error('[STREAM] Error enqueueing:', error);
          // Remove listener if controller is closed
          uiEventBus.off('ui-event', send);
        }
      };

      // 初回ping
      send({ event: 'ping', data: { timestamp: Date.now() } } as UIEventPayload);

      // EventBus → SSE
      uiEventBus.on('ui-event', send);

      // Cleanup on stream close
      const cleanup = () => {
        uiEventBus.off('ui-event', send);
      };
      
      // Handle various close scenarios
      controller.signal?.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}

/**
 * POST /api/ui-events - イベント送信
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, data } = body;

    if (!event || !data) {
      throw new ValidationError(
        'Missing required fields: event, data',
        'body',
        { event, data }
      );
    }

    logger.debug('[UI-Events] Emitting event', { event });

    // UIイベントバスにイベントを送信
    const eventBus = getUIEventBus();
    eventBus.emit('ui-event', { event, data });

    logger.debug('[UI-Events] Event emitted successfully', { event });

    return NextResponse.json({
      success: true,
      event,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return errorHandler(error as Error, request);
  }
}