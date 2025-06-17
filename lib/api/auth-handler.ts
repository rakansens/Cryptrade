import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/server';
import { logger } from '@/lib/utils/logger';

export interface AuthenticatedRequest extends NextRequest {
  userId?: string;
  session?: any;
}

/**
 * Wraps an API route handler with authentication
 */
export function withAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const session = await getServerSession();
      
      if (!session || !session.user || !session.user.id) {
        return NextResponse.json(
          { error: 'Unauthorized - Please login' },
          { status: 401 }
        );
      }

      // Add session info to request
      (req as AuthenticatedRequest).userId = session.user.id;
      (req as AuthenticatedRequest).session = session;

      // Call the actual handler
      return await handler(req as AuthenticatedRequest);
    } catch (error) {
      logger.error('Auth middleware error', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Optional auth wrapper - allows both authenticated and unauthenticated requests
 */
export function withOptionalAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const session = await getServerSession();
      
      if (session && session.user && session.user.id) {
        (req as AuthenticatedRequest).userId = session.user.id;
        (req as AuthenticatedRequest).session = session;
      }

      return await handler(req as AuthenticatedRequest);
    } catch (error) {
      logger.error('Optional auth middleware error', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}