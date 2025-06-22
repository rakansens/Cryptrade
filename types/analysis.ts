export interface AnalysisResult {
  type: 'pattern' | 'indicator' | 'support_resistance' | 'trend' | 'signal';
  name: string;
  confidence: number;
  description: string;
  details?: any;
  recommendations: string[];
  timestamp: Date;
}