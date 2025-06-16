import { generateCorrelationId } from '@/types/agent-payload';

/**
 * Agent間通信の監視・トレース機能
 * 
 * Prometheus metrics + 構造化ログでマルチエージェント可視化
 */

// トレース情報の型定義
export interface TraceContext {
  correlationId: string;
  sessionId: string;
  userId?: string;
  agentId: string;
  operationType: 'agent_call' | 'tool_execution' | 'workflow_step';
  startTime: number;
  parentSpanId?: string;
}

export interface TraceMetrics {
  latencyMs: number;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
  success: boolean;
  errorCode?: string;
}

// グローバルトレースマネージャー
class TraceManager {
  private activeTraces = new Map<string, TraceContext>();
  
  startTrace(config: Omit<TraceContext, 'correlationId' | 'startTime'>): TraceContext {
    const trace: TraceContext = {
      ...config,
      correlationId: generateCorrelationId(),
      startTime: Date.now(),
    };
    
    this.activeTraces.set(trace.correlationId, trace);
    
    // 構造化ログ出力
    console.log(JSON.stringify({
      level: 'INFO',
      event: 'trace_start',
      correlationId: trace.correlationId,
      sessionId: trace.sessionId,
      agentId: trace.agentId,
      operationType: trace.operationType,
      timestamp: new Date().toISOString(),
    }));
    
    return trace;
  }
  
  endTrace(correlationId: string, metrics: TraceMetrics) {
    const trace = this.activeTraces.get(correlationId);
    if (!trace) return;
    
    const duration = Date.now() - trace.startTime;
    
    // Prometheus metrics (将来実装)
    this.recordPrometheusMetrics(trace, metrics, duration);
    
    // 構造化ログ出力
    console.log(JSON.stringify({
      level: metrics.success ? 'INFO' : 'ERROR',
      event: 'trace_end',
      correlationId,
      sessionId: trace.sessionId,
      agentId: trace.agentId,
      operationType: trace.operationType,
      latencyMs: duration,
      tokensInput: metrics.tokensInput,
      tokensOutput: metrics.tokensOutput,
      costUsd: metrics.costUsd,
      success: metrics.success,
      errorCode: metrics.errorCode,
      timestamp: new Date().toISOString(),
    }));
    
    this.activeTraces.delete(correlationId);
  }
  
  private recordPrometheusMetrics(trace: TraceContext, metrics: TraceMetrics, duration: number) {
    try {
      // Import Prometheus metrics
      const { metrics: prometheusMetrics } = require('./prometheus');
      
      // Record agent latency
      prometheusMetrics.agentLatency.observe(
        {
          agent_id: trace.agentId,
          operation_type: trace.operationType,
          success: String(metrics.success)
        },
        duration / 1000 // Convert to seconds
      );
      
      // Record token usage
      if (metrics.tokensUsed > 0) {
        prometheusMetrics.agentTokenUsage.inc(
          {
            agent_id: trace.agentId,
            operation_type: trace.operationType
          },
          metrics.tokensUsed
        );
      }
      
      // Record errors
      if (!metrics.success && metrics.errorType) {
        prometheusMetrics.agentErrors.inc({
          agent_id: trace.agentId,
          error_type: metrics.errorType
        });
      }
      
      // Also log metrics for observability
      logger.info('[TraceManager] Metrics recorded', {
        metric_type: 'agent_latency',
        agent_id: trace.agentId,
        operation_type: trace.operationType,
        success: metrics.success,
        duration_ms: duration,
        duration_seconds: duration / 1000,
        tokens_used: metrics.tokensUsed,
        error_type: metrics.errorType,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('[TraceManager] Failed to record Prometheus metrics', { error });
      
      // Fallback to logging only
      logger.info('[TraceManager] Metrics recorded (fallback)', {
        agent_id: trace.agentId,
        operation_type: trace.operationType,
        success: metrics.success,
        duration_ms: duration,
        tokens_used: metrics.tokensUsed,
        error_type: metrics.errorType
      });
    }
  }
}

export const traceManager = new TraceManager();

// Agent実行用のパラメータ型定義
export interface TraceableParams {
  sessionId?: string;
  [key: string]: unknown;
}

// トレース結果の型定義
export interface TraceableResult {
  tokensUsed?: {
    input: number;
    output: number;
  };
  [key: string]: unknown;
}

// Agent実行用デコレーター
export function withTrace<T extends TraceableParams[], R extends TraceableResult>(
  agentId: string,
  operationType: TraceContext['operationType'],
  fn: (...args: T) => Promise<R>
) {
  return async function tracedFunction(...args: T): Promise<R> {
    const sessionId = args[0]?.sessionId || 'unknown';
    
    const trace = traceManager.startTrace({
      sessionId,
      agentId,
      operationType,
    });
    
    const startTime = Date.now();
    let tokensInput = 0;
    let tokensOutput = 0;
    let costUsd = 0;
    
    try {
      const result = await fn(...args);
      
      // Extract token usage from result
      if (result.tokensUsed) {
        tokensInput = result.tokensUsed.input || 0;
        tokensOutput = result.tokensUsed.output || 0;
      } else if ('usage' in result && typeof result.usage === 'object') {
        // Alternative format from some AI providers
        const usage = result.usage as any;
        tokensInput = usage.prompt_tokens || usage.input_tokens || 0;
        tokensOutput = usage.completion_tokens || usage.output_tokens || 0;
      }
      
      // Estimate cost based on token usage (GPT-4o pricing as example)
      // Input: $2.50 per 1M tokens, Output: $10.00 per 1M tokens
      costUsd = (tokensInput * 0.0000025) + (tokensOutput * 0.00001);
      costUsd = calculateCost(agentId, tokensInput, tokensOutput);
      
      traceManager.endTrace(trace.correlationId, {
        latencyMs: Date.now() - startTime,
        tokensInput,
        tokensOutput,
        costUsd,
        success: true,
      });
      
      return result;
    } catch (error) {
      traceManager.endTrace(trace.correlationId, {
        latencyMs: Date.now() - startTime,
        tokensInput,
        tokensOutput,
        costUsd,
        success: false,
        errorCode: (error as Error & { code?: string })?.code || 'UNKNOWN_ERROR',
      });
      
      throw error;
    }
  };
}

// コスト計算ヘルパー
function calculateCost(agentId: string, tokensInput: number, tokensOutput: number): number {
  // モデル別料金設定
  const pricing = {
    'orchestrator': { input: 0.01, output: 0.03 },    // GPT-4
    'market-data': { input: 0.0015, output: 0.002 },  // GPT-3.5
    'trading-strategy': { input: 0.01, output: 0.03 }, // GPT-4
    'risk-management': { input: 0.0015, output: 0.002 }, // GPT-3.5
  };
  
  const rates = pricing[agentId as keyof typeof pricing] || pricing['market-data'];
  
  return (tokensInput / 1000) * rates.input + (tokensOutput / 1000) * rates.output;
}

// トレーディング分析の入力型
export interface TradingAnalysisInput extends TraceableParams {
  symbol: string;
  timeframe: string;
  indicators?: string[];
}

// トレーディング分析の結果型
export interface TradingAnalysisResult extends TraceableResult {
  analysis: string;
  confidence?: number;
  signals?: Array<{
    type: 'buy' | 'sell';
    strength: number;
  }>;
}

// 使用例
export const tracedExecuteTradingAnalysis = withTrace(
  'trading-workflow', 
  'workflow_step', 
  async (_input: TradingAnalysisInput): Promise<TradingAnalysisResult> => {
    // 既存のexecuteTradingAnalysis実装
    return { analysis: 'mock result' };
  }
);

// ログ分析クエリ例 (将来のGrafana/ELK用)
export const LOG_QUERIES = {
  // エージェント別レイテンシ分析
  AGENT_LATENCY: `
    SELECT agentId, AVG(latencyMs) as avg_latency, COUNT(*) as requests
    FROM logs 
    WHERE event = 'trace_end' AND timestamp > NOW() - INTERVAL 1 DAY
    GROUP BY agentId
  `,
  
  // コスト分析
  DAILY_COST: `
    SELECT DATE(timestamp) as date, SUM(costUsd) as daily_cost
    FROM logs
    WHERE event = 'trace_end' AND timestamp > NOW() - INTERVAL 7 DAY
    GROUP BY DATE(timestamp)
  `,
  
  // エラー率分析
  ERROR_RATE: `
    SELECT agentId, 
           SUM(CASE WHEN success = false THEN 1 ELSE 0 END) / COUNT(*) * 100 as error_rate
    FROM logs
    WHERE event = 'trace_end' AND timestamp > NOW() - INTERVAL 1 HOUR
    GROUP BY agentId
  `,
};