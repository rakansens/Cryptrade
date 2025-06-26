import { NextRequest } from 'next/server';
import { ChatDatabaseService } from '@/lib/services/database/chat.service';
import { z } from 'zod';
import { createApiSuccessResponse, createApiErrorResponse, parseRequestBody } from '@/app/api/utils/responses';
import { getServerSession } from '@/lib/auth/server';

// Request validation schema
const createSessionSchema = z.object({
  userId: z.string().optional(),
  title: z.string().min(1).max(255),
});

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session) {
      return createApiErrorResponse('Unauthorized - Please login', 401);
    }

    const userId = session.user?.id || request.headers.get('x-user-id') || undefined;
    const sessions = await ChatDatabaseService.getUserSessions(userId);
    
    return createApiSuccessResponse({ sessions });
  } catch (error) {
    return createApiErrorResponse(error instanceof Error ? error.message : 'Failed to get sessions', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session) {
      return createApiErrorResponse('Unauthorized - Please login', 401);
    }

    const { data, error } = await parseRequestBody(request, createSessionSchema);
    if (error) return error;
    
    const { userId, title } = data;
    // Use authenticated user's ID if userId not provided
    const sessionUserId = userId || session.user?.id;
    const dbSession = await ChatDatabaseService.createSession(sessionUserId, title);
    
    return createApiSuccessResponse({ session: dbSession });
  } catch (error) {
    return createApiErrorResponse(error instanceof Error ? error.message : 'Failed to create session', 500);
  }
}