import { NextRequest, NextResponse } from 'next/server';
import { createApiMiddleware } from '@/lib/api/middleware';

// Create the API middleware instance
const apiMiddleware = createApiMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
});

export async function middleware(request: NextRequest) {
  // Only apply middleware to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const response = await apiMiddleware(request);
    if (response) {
      return response;
    }
  }

  // Allow request to proceed
  return NextResponse.next();
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Exclude static files and images
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};