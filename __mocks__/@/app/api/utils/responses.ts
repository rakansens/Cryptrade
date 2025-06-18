import { NextResponse } from 'next/server';

export function createApiSuccessResponse(data: any, status = 200) {
  return NextResponse.json({
    success: true,
    ...data,
    timestamp: new Date().toISOString(),
  }, { status });
}

export function createApiErrorResponse(error: string | Error, status = 500, details?: any) {
  const errorMessage = error instanceof Error ? error.message : error;
  return NextResponse.json({
    error: errorMessage,
    details,
    timestamp: new Date().toISOString(),
  }, { status });
}

export async function parseRequestBody(request: any, schema: any) {
  try {
    const body = await request.json();
    const result = schema.parse(body);
    return { data: result, error: null };
  } catch (error) {
    return { 
      data: null, 
      error: createApiErrorResponse(error instanceof Error ? error.message : 'Invalid request body', 400) 
    };
  }
}

export function handleApiError(error: any, message: string) {
  return createApiErrorResponse(error instanceof Error ? error : new Error(message), 500);
}