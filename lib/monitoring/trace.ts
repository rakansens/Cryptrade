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
    // TODO: Phase2で実装
    // prometheus.register.histogram('agent_latency_seconds', {
    //   name: 'agent_latency_seconds',
    //   help: 'Agent execution latency',
    //   labelNames: ['agent_id', 'operation_type', 'success'],
    //   buckets: [0.1, 0.5, 1, 2, 5, 10],
    // }).observe(
    //   { agent_id: trace.agentId, operation_type: trace.operationType, success: metrics.success },
    //   duration / 1000
    // );
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
      
      // TODO: 実際のtoken使用量を取得
      tokensInput = result.tokensUsed?.input || 0;
      tokensOutput = result.tokensUsed?.output || 0;
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
  async (input: TradingAnalysisInput): Promise<TradingAnalysisResult> => {
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