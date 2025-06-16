import { NextRequest, NextResponse } from 'next/server';
import { AlertService } from '@/lib/services/alert.service';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
    }
    const alerts = await AlertService.getUserAlerts(userId);
    return NextResponse.json({ alerts });
  } catch (error) {
    logger.error('[API] Failed to get alerts', { error });
    return NextResponse.json({ error: 'Failed to get alerts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId || request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
    }
    const { symbol, conditions } = body;
    const alert = await AlertService.createAlert({ userId, symbol, conditions });
    return NextResponse.json({ alert });
  } catch (error) {
    logger.error('[API] Failed to create alert', { error });
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}
