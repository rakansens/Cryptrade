/**
 * Chart data utilities for cleaning and validating time series data
 */

export interface TimeSeriesData {
  time: number;
  [key: string]: number | string | boolean | null | undefined;
}

/**
 * Remove duplicate timestamps and ensure ascending order
 */
export function cleanTimeSeriesData<T extends TimeSeriesData>(
  data: T[],
  timeKey: keyof T = 'time'
): T[] {
  if (!data || data.length === 0) return [];

  // Sort by time first
  const sorted = [...data].sort((a, b) => Number(a[timeKey]) - Number(b[timeKey]));
  
  // Remove duplicates - keep the last occurrence of each timestamp
  const cleaned: T[] = [];
  const seen = new Set<number>();
  
  for (let i = sorted.length - 1; i >= 0; i--) {
    const time = Number(sorted[i][timeKey]);
    if (!seen.has(time)) {
      seen.add(time);
      cleaned.unshift(sorted[i]);
    }
  }
  
  return cleaned;
}

/**
 * Validate that data is properly ordered by time
 */
export function validateTimeSeriesOrder<T extends TimeSeriesData>(
  data: T[],
  timeKey: keyof T = 'time'
): boolean {
  if (data.length <= 1) return true;
  
  for (let i = 1; i < data.length; i++) {
    const prevTime = Number(data[i - 1][timeKey]);
    const currTime = Number(data[i][timeKey]);
    
    if (currTime <= prevTime) {
      console.warn(`Time series order violation at index ${i}: current=${currTime}, previous=${prevTime}`);
      return false;
    }
  }
  
  return true;
}

/**
 * Convert milliseconds to seconds for lightweight-charts
 */
export function convertToLightweightChartsTime(timestamp: number): number {
  // If timestamp is in milliseconds, convert to seconds
  if (timestamp > 1e12) {
    return Math.floor(timestamp / 1000);
  }
  return timestamp;
}

/**
 * Prepare data for lightweight-charts with proper time format and deduplication
 */
export function prepareLightweightChartsData<T extends TimeSeriesData>(
  data: T[],
  timeKey: keyof T = 'time'
): T[] {
  if (!data || data.length === 0) return [];

  // Clean and convert timestamps
  const processed = data.map(item => ({
    ...item,
    [timeKey]: convertToLightweightChartsTime(Number(item[timeKey]))
  }));

  // Clean duplicates and sort
  const cleaned = cleanTimeSeriesData(processed, timeKey);
  
  // Validate final result
  if (!validateTimeSeriesOrder(cleaned, timeKey)) {
    console.error('Failed to create properly ordered time series data');
  }
  
  return cleaned;
}