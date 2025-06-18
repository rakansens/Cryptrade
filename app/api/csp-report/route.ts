import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/config/env';

// Helper function for optional env vars not in schema
function getEnvVar(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

/**
 * CSP Violation Report Endpoint
 * 
 * This endpoint receives CSP violation reports from browsers
 * and logs them for monitoring and debugging purposes
 */

interface CSPReport {
  'csp-report': {
    'document-uri': string;
    'referrer'?: string;
    'violated-directive': string;
    'effective-directive': string;
    'original-policy': string;
    'disposition': string;
    'blocked-uri': string;
    'line-number'?: number;
    'column-number'?: number;
    'source-file'?: string;
    'status-code': number;
    'script-sample'?: string;
  };
}

// Store for recent violations (in production, use a proper logging service)
const recentViolations: Array<{
  timestamp: string;
  report: CSPReport['csp-report'];
  userAgent?: string;
  ip?: string;
}> = [];

const MAX_VIOLATIONS_STORED = 100;

export async function POST(request: NextRequest) {
  try {
    // Parse the CSP report
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/csp-report')) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      );
    }

    const report: CSPReport = await request.json();
    
    if (!report?.['csp-report']) {
      return NextResponse.json(
        { error: 'Invalid CSP report format' },
        { status: 400 }
      );
    }

    const violation = report['csp-report'];
    
    // Log the violation
    const logEntry = {
      timestamp: new Date().toISOString(),
      report: violation,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
    };

    // In production, send to logging service (e.g., Sentry, LogRocket)
    if (env.NODE_ENV === 'production') {
      console.error('[CSP Violation]', JSON.stringify(logEntry, null, 2));
      
      // Send to Sentry if configured
      if (env.SENTRY_DSN) {
        try {
          // Import dynamically to avoid issues if Sentry is not configured
          const Sentry = await import('@sentry/nextjs');
          Sentry.captureMessage('CSP Violation', {
            level: 'warning',
            extra: logEntry,
            tags: {
              type: 'csp-violation',
              directive: violation['violated-directive'],
              blockedUri: violation['blocked-uri'],
            },
          });
        } catch (error) {
          console.error('Failed to send CSP violation to Sentry:', error);
        }
      }
    } else {
      // In development, just log to console
      console.warn('[CSP Violation]', logEntry);
    }

    // Store recent violations for debugging
    recentViolations.unshift(logEntry);
    if (recentViolations.length > MAX_VIOLATIONS_STORED) {
      recentViolations.pop();
    }

    // Return 204 No Content as per CSP reporting spec
    return new NextResponse(null, { status: 204 });
    
  } catch (error) {
    console.error('Error processing CSP report:', error);
    return NextResponse.json(
      { error: 'Failed to process CSP report' },
      { status: 500 }
    );
  }
}

// GET endpoint for debugging (only in development)
export async function GET(request: NextRequest) {
  if (env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    );
  }

  // Check for admin token in development
  const token = request.headers.get('x-admin-token');
  const adminToken = getEnvVar('ADMIN_TOKEN');
  if (token !== adminToken && adminToken) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    violations: recentViolations,
    count: recentViolations.length,
    maxStored: MAX_VIOLATIONS_STORED,
  });
}