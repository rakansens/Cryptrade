import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { DbStats } from '@/types/database.types';

export async function GET() {
  try {
    const [sessions, messages, users, drawings, analyses] = await Promise.all([
      prisma.conversationSession.count(),
      prisma.conversationMessage.count(),
      prisma.user.count(),
      prisma.chartDrawing.count(),
      prisma.analysisRecord.count(),
    ]);

    const stats: DbStats = {
      sessions,
      messages,
      users,
      drawings,
      analyses,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to get DB stats:', error);
    return NextResponse.json(
      { error: 'Failed to get database statistics' },
      { status: 500 }
    );
  }
}