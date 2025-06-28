/**
 * Mock implementation for alerts API route
 * Simulates the GET and POST endpoints for alerts
 * Returns proper NextResponse objects to match API behavior
 */

import { NextResponse } from 'next/server';

export const GET = jest.fn().mockImplementation(() => {
  return NextResponse.json(
    { success: true, data: { alerts: [] }, timestamp: new Date().toISOString() },
    { status: 200 }
  );
});

export const POST = jest.fn().mockImplementation(() => {
  return NextResponse.json(
    { success: true, data: { alert: {} }, timestamp: new Date().toISOString() },
    { status: 200 }
  );
});