import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { createApiMiddleware } from '@/lib/api/middleware';
import { generateNonce, applyCSPHeaders } from '@/lib/security/csp';
import { env } from '@/config/env';

// Create the API middleware instance
const apiMiddleware = createApiMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
});

// Public routes that don't require authentication
const publicRoutes = [
  '/login',
  '/signup',
  '/reset-password',
  '/',
  '/api/binance', // Public API endpoints
  '/api/chart/sessions/default/drawings', // Allow chart APIs for non-authenticated users
  '/api/chart/sessions/default/patterns',
  '/api/ui-events',
  '/api/events',
];

// Check if path is public
const isPublicRoute = (pathname: string) => {
  return publicRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
};

export async function middleware(request: NextRequest) {
  // Generate nonce for CSP
  const nonce = generateNonce();
  
  // Create response with nonce in headers for use in the app
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  
  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  
  const pathname = request.nextUrl.pathname;

  // Apply API middleware to API routes
  if (pathname.startsWith('/api/')) {
    const apiResponse = await apiMiddleware(request);
    if (apiResponse) {
      return apiResponse;
    }
  }

  // Create Supabase client (Edge Runtime compatible)
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({
            name,
            value,
            ...options,
            sameSite: 'lax',
            secure: env.NODE_ENV === 'production',
          });
        },
        remove(name: string, options: any) {
          response.cookies.delete({
            name,
            ...options,
          });
        },
      },
    }
  );

  // Check authentication for protected routes
  const { data: { session } } = await supabase.auth.getSession();

  // If no session and trying to access protected route, redirect to login
  if (!session && !isPublicRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // If session exists and trying to access auth pages, redirect to dashboard
  if (session && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Apply CSP headers to the response
  const isDevelopment = env.NODE_ENV === 'development';
  response = applyCSPHeaders(response, nonce, isDevelopment);
  
  return response;
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    // Match all routes except static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};