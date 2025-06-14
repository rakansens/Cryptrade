/**
 * Type definitions for log viewer
 */

import type { LogLevel } from '@/lib/logging';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  component?: string;
  context?: Record<string, unknown>;
  error?: string | Error | Record<string, unknown>;
}

export interface LogFilters {
  level?: LogLevel;
  component?: string;
  search?: string;
  startTime?: number;
  endTime?: number;
}

export interface LogPagination {
  page: number;
  limit: number;
}

export interface LogExportOptions {
  format: 'json' | 'csv';
  filters?: LogFilters;
}

// Type guard for LogEntry
export function isLogEntry(value: unknown): value is LogEntry {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.timestamp === 'number' &&
    typeof obj.level === 'string' &&
    typeof obj.message === 'string'
  );
}

// Helper to format error for display
export function formatLogError(error: LogEntry['error']): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    return JSON.stringify(error, null, 2);
  }
  return String(error);
}