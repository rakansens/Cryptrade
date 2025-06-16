import { NextRequest } from 'next/server';
import { ChatDatabaseService } from '@/lib/services/database/chat.service';
import { z } from 'zod';
import { createApiSuccessResponse, handleApiError, parseRequestBody } from '@/app/api/utils/responses';

// Request validation schema
const createSessionSchema = z.object({
  userId: z.string().optional(),
  title: z.string().min(1).max(255),
});

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || undefined;
    const sessions = await ChatDatabaseService.getUserSessions(userId);
    
    return createApiSuccessResponse({ sessions });
  } catch (error) {
    return handleApiError(error, 'Failed to get sessions');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await parseRequestBody(request, createSessionSchema);
    if (error) return error;
    
    const { userId, title } = data;
    const session = await ChatDatabaseService.createSession(userId, title);
    
    return createApiSuccessResponse({ session });
  } catch (error) {
    return handleApiError(error, 'Failed to create session');
  }
}