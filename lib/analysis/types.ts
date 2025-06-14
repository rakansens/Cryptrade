// Analysis types for line detection and validation

export interface TouchPoint {
  time: number;     // Unix timestamp in seconds
  value: number;    // Price value
  index?: number;   // Candle index
}

export interface DetectedLine {
  type: 'support' | 'resistance' | 'trendline' | 'horizontal' | 'vertical';
  price?: number;                // For horizontal lines
  touchPoints: TouchPoint[];     // Points where price touched the line
  confidence: number;            // 0-1 confidence score
  rSquared?: number;            // R-squared value for line fit
  timeframe: string;            // Timeframe this was detected on
  startTime?: number;           // Start time of the line
  endTime?: number;             // End time of the line
  slope?: number;               // Slope for trendlines
  intercept?: number;           // Y-intercept for trendlines
}