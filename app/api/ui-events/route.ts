import { NextRequest, NextResponse } from 'next/server';
import { getUIEventBus, uiEventBus, UIEventPayload } from '@/lib/server/uiEventBus';
import { logger } from '@/lib/utils/logger';
import { ValidationError } from '@/lib/errors/base-error';
import { errorHandler } from '@/lib/api/helpers/error-handler';
import { createSSEHandler, createSSEOptionsHandler } from '@/lib/api/create-sse-handler';
import { z } from 'zod';

// Request validation schema
const uiEventSchema = z.object({
  event: z.string().min(1),
  data: z.record(z.unknown()),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/ui-events - SSE Stream（常にストリームを返す）
 */
export const GET = createSSEHandler({
  handler: {
    onConnect({ stream }) {
      const send = (payload: UIEventPayload) => {
        stream.write({ event: 'ui-event', data: payload });
      };

      // 初回ping
      send({ event: 'ping', data: { timestamp: Date.now() } } as UIEventPayload);

      uiEventBus.on('ui-event', send);

      off = () => uiEventBus.off('ui-event', send);
    },
    onDisconnect() {
      off();
    }
  },
  cors: { origin: '*', credentials: true }
});

// Holder for disconnect cleanup
let off: () => void = () => {};

export const OPTIONS = createSSEOptionsHandler({ origin: '*', credentials: true });

/**
 * POST /api/ui-events - イベント送信
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = uiEventSchema.safeParse(body);
    if (!validationResult.success) {
      throw new ValidationError(
        'Invalid request data',
        'body',
        validationResult.error.flatten()
      );
    }
    
    const { event, data } = validationResult.data;

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
    return errorHandler(error as Error, request as any);
  }
}
