/**
 * Date Formatting Utilities
 * 
 * Unified date formatting functions to replace duplicate implementations
 * across the codebase
 */

export interface DateFormatOptions {
  /** Show minutes/hours for recent timestamps */
  showDetailedRecent?: boolean;
  /** Locale for date formatting */
  locale?: string;
  /** Custom thresholds for different time periods */
  thresholds?: {
    minutes?: number;
    hours?: number;
    days?: number;
    weeks?: number;
  };
}

/**
 * Default formatting options
 */
const DEFAULT_OPTIONS: Required<DateFormatOptions> = {
  showDetailedRecent: false,
  locale: 'ja-JP',
  thresholds: {
    minutes: 60,
    hours: 24,
    days: 2,
    weeks: 7,
  },
};

/**
 * Format timestamp as relative date/time
 * 
 * @param timestamp - Unix timestamp in milliseconds
 * @param options - Formatting options
 * @returns Formatted date string
 */
export function formatRelativeDate(
  timestamp: number,
  options: DateFormatOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = diffInMs / (1000 * 60);
  const diffInHours = diffInMs / (1000 * 60 * 60);
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

  // Show detailed recent timestamps if enabled
  if (opts.showDetailedRecent) {
    if (diffInMinutes < 1) {
      return '今';
    } else if (diffInMinutes < (opts.thresholds.minutes ?? 60)) {
      return `${Math.round(diffInMinutes)}分前`;
    } else if (diffInHours < (opts.thresholds.hours ?? 24)) {
      return `${Math.round(diffInHours)}時間前`;
    }
  }

  // Standard relative formatting
  if (diffInHours < (opts.thresholds.hours ?? 24)) {
    return '今日';
  } else if (diffInDays < (opts.thresholds.days ?? 2)) {
    return '昨日';
  } else if (diffInDays < (opts.thresholds.weeks ?? 7)) {
    return '今週';
  } else {
    return date.toLocaleDateString(opts.locale, { 
      month: 'short', 
      day: 'numeric' 
    });
  }
}

/**
 * Format date for chat sidebar (simple relative format)
 * 
 * Compatible with existing ChatSidebar.tsx implementation
 */
export function formatChatDate(timestamp: number): string {
  return formatRelativeDate(timestamp, {
    showDetailedRecent: false,
  });
}

/**
 * Format date for analysis records (detailed recent format)
 * 
 * Compatible with existing AnalysisRecordItem.tsx implementation
 */
export function formatAnalysisDate(timestamp: number): string {
  return formatRelativeDate(timestamp, {
    showDetailedRecent: true,
  });
}

/**
 * Format absolute date/time
 * 
 * @param timestamp - Unix timestamp in milliseconds
 * @param options - Intl.DateTimeFormatOptions
 * @param locale - Locale string
 * @returns Formatted absolute date string
 */
export function formatAbsoluteDate(
  timestamp: number,
  options: Intl.DateTimeFormatOptions = {},
  locale: string = 'ja-JP'
): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(locale, options);
}

/**
 * Format absolute date/time with time
 * 
 * @param timestamp - Unix timestamp in milliseconds
 * @param locale - Locale string
 * @returns Formatted absolute date and time string
 */
export function formatDateTime(
  timestamp: number,
  locale: string = 'ja-JP'
): string {
  const date = new Date(timestamp);
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Check if two timestamps are on the same day
 */
export function isSameDay(timestamp1: number, timestamp2: number): boolean {
  const date1 = new Date(timestamp1);
  const date2 = new Date(timestamp2);
  
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Get time difference in human readable format
 */
export function getTimeDifference(
  timestamp1: number,
  timestamp2: number = Date.now()
): string {
  const diffInMs = Math.abs(timestamp2 - timestamp1);
  const diffInMinutes = diffInMs / (1000 * 60);
  const diffInHours = diffInMs / (1000 * 60 * 60);
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

  if (diffInMinutes < 1) {
    return '1分未満';
  } else if (diffInMinutes < 60) {
    return `${Math.round(diffInMinutes)}分`;
  } else if (diffInHours < 24) {
    return `${Math.round(diffInHours)}時間`;
  } else {
    return `${Math.round(diffInDays)}日`;
  }
}

// Legacy exports for backward compatibility
export const formatDate = formatChatDate;
export const defaultFormatDate = formatAnalysisDate;