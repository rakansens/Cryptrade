// Mock generateCorrelationId first
jest.mock('@/types/agent-payload', () => ({
  generateCorrelationId: jest.fn(() => `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
}));

import { traceManager, withTrace, tracedExecuteTradingAnalysis, TraceContext, TraceMetrics } from '../trace';

// Mock console.log for structured logging verification
const originalConsoleLog = console.log;
const consoleLogSpy = jest.fn();

describe('TraceManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = consoleLogSpy;
    // Clear active traces
    (traceManager as any).activeTraces.clear();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('Trace Lifecycle', () => {
    it('should start a trace with correct context', () => {
      const config = {
        sessionId: 'session-123',
        userId: 'user-456',
        agentId: 'orchestrator',
        operationType: 'agent_call' as const,
      };

      const trace = traceManager.startTrace(config);

      expect(trace).toMatchObject({
        ...config,
        correlationId: expect.stringMatching(/^corr-/),
        startTime: expect.any(Number),
      });

      // Verify structured log
      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      
      expect(logData).toMatchObject({
        level: 'INFO',
        event: 'trace_start',
        correlationId: trace.correlationId,
        sessionId: 'session-123',
        agentId: 'orchestrator',
        operationType: 'agent_call',
        timestamp: expect.any(String),
      });
    });

    it('should end a trace with success metrics', () => {
      const trace = traceManager.startTrace({
        sessionId: 'session-123',
        agentId: 'market-data',
        operationType: 'tool_execution',
      });

      const metrics: TraceMetrics = {
        latencyMs: 150,
        tokensInput: 100,
        tokensOutput: 50,
        costUsd: 0.005,
        success: true,
      };

      // Small delay to ensure duration > 0
      const startTime = Date.now();
      while (Date.now() - startTime < 10) {
        // busy wait
      }
      
      traceManager.endTrace(trace.correlationId, metrics);

      // Verify structured log
      const endLogCall = consoleLogSpy.mock.calls.find(call => 
        call[0].includes('trace_end')
      );

      expect(endLogCall).toBeDefined();
      const logData = JSON.parse(endLogCall![0]);
      
      expect(logData).toMatchObject({
        level: 'INFO',
        event: 'trace_end',
        correlationId: trace.correlationId,
        sessionId: 'session-123',
        agentId: 'market-data',
        operationType: 'tool_execution',
        tokensInput: 100,
        tokensOutput: 50,
        costUsd: 0.005,
        success: true,
        timestamp: expect.any(String),
      });
    });

    it('should end a trace with error metrics', () => {
      const trace = traceManager.startTrace({
        sessionId: 'session-789',
        agentId: 'trading-strategy',
        operationType: 'workflow_step',
      });

      const metrics: TraceMetrics = {
        latencyMs: 500,
        tokensInput: 200,
        tokensOutput: 0,
        costUsd: 0.002,
        success: false,
        errorCode: 'STRATEGY_FAILED',
      };

      traceManager.endTrace(trace.correlationId, metrics);

      // Verify error log level
      const endLogCall = consoleLogSpy.mock.calls.find(call => 
        call[0].includes('trace_end')
      );

      const logData = JSON.parse(endLogCall![0]);
      
      expect(logData).toMatchObject({
        level: 'ERROR',
        event: 'trace_end',
        success: false,
        errorCode: 'STRATEGY_FAILED',
      });
    });

    it('should handle ending non-existent trace gracefully', () => {
      const metrics: TraceMetrics = {
        latencyMs: 100,
        tokensInput: 50,
        tokensOutput: 25,
        costUsd: 0.001,
        success: true,
      };

      // Should not throw
      expect(() => traceManager.endTrace('non-existent-id', metrics)).not.toThrow();
      
      // Should not log anything for non-existent trace
      const endLogCall = consoleLogSpy.mock.calls.find(call => 
        call[0].includes('trace_end')
      );
      expect(endLogCall).toBeUndefined();
    });

    it('should remove trace from active traces after ending', () => {
      const trace = traceManager.startTrace({
        sessionId: 'session-abc',
        agentId: 'risk-management',
        operationType: 'agent_call',
      });

      expect((traceManager as any).activeTraces.has(trace.correlationId)).toBe(true);

      traceManager.endTrace(trace.correlationId, {
        latencyMs: 75,
        tokensInput: 30,
        tokensOutput: 20,
        costUsd: 0.0008,
        success: true,
      });

      expect((traceManager as any).activeTraces.has(trace.correlationId)).toBe(false);
    });
  });

  describe('withTrace Decorator', () => {
    it('should trace successful async function execution', async () => {
      const mockFn = jest.fn(async (input: { sessionId: string; data: string }) => {
        return { 
          result: 'success',
          tokensUsed: { input: 150, output: 75 }
        };
      });

      const tracedFn = withTrace('test-agent', 'agent_call', mockFn);

      const input = { sessionId: 'session-xyz', data: 'test-data' };
      const result = await tracedFn(input);

      expect(result).toEqual({ 
        result: 'success',
        tokensUsed: { input: 150, output: 75 }
      });
      expect(mockFn).toHaveBeenCalledWith(input);

      // Verify trace logs
      const startLog = consoleLogSpy.mock.calls.find(call => 
        call[0].includes('trace_start')
      );
      const endLog = consoleLogSpy.mock.calls.find(call => 
        call[0].includes('trace_end')
      );

      expect(startLog).toBeDefined();
      expect(endLog).toBeDefined();

      const endLogData = JSON.parse(endLog![0]);
      expect(endLogData).toMatchObject({
        event: 'trace_end',
        sessionId: 'session-xyz',
        agentId: 'test-agent',
        operationType: 'agent_call',
        tokensInput: 150,
        tokensOutput: 75,
        success: true,
      });
    });

    it('should trace failed async function execution', async () => {
      const mockError = new Error('Agent execution failed');
      (mockError as any).code = 'AGENT_ERROR';

      const mockFn = jest.fn(async () => {
        throw mockError;
      });

      const tracedFn = withTrace('failing-agent', 'tool_execution', mockFn);

      await expect(tracedFn({ sessionId: 'session-fail' })).rejects.toThrow('Agent execution failed');

      // Verify error trace
      const endLog = consoleLogSpy.mock.calls.find(call => 
        call[0].includes('trace_end')
      );

      const endLogData = JSON.parse(endLog![0]);
      expect(endLogData).toMatchObject({
        level: 'ERROR',
        event: 'trace_end',
        success: false,
        errorCode: 'AGENT_ERROR',
      });
    });

    it('should handle missing sessionId', async () => {
      const mockFn = jest.fn(async () => ({ result: 'ok' }));
      const tracedFn = withTrace('no-session-agent', 'workflow_step', mockFn);

      await tracedFn({});

      const startLog = consoleLogSpy.mock.calls.find(call => 
        call[0].includes('trace_start')
      );

      const startLogData = JSON.parse(startLog![0]);
      expect(startLogData.sessionId).toBe('unknown');
    });

    it('should extract token usage from result', async () => {
      const mockFn = jest.fn(async () => ({
        analysis: 'market analysis',
        tokensUsed: {
          input: 500,
          output: 250
        }
      }));

      const tracedFn = withTrace('analysis-agent', 'agent_call', mockFn);

      await tracedFn({ sessionId: 'session-tokens' });

      const endLog = consoleLogSpy.mock.calls.find(call => 
        call[0].includes('trace_end')
      );

      const endLogData = JSON.parse(endLog![0]);
      expect(endLogData.tokensInput).toBe(500);
      expect(endLogData.tokensOutput).toBe(250);
    });

    it('should handle missing token usage', async () => {
      const mockFn = jest.fn(async () => ({ result: 'no tokens' }));
      const tracedFn = withTrace('no-tokens-agent', 'tool_execution', mockFn);

      await tracedFn({ sessionId: 'session-no-tokens' });

      const endLog = consoleLogSpy.mock.calls.find(call => 
        call[0].includes('trace_end')
      );

      const endLogData = JSON.parse(endLog![0]);
      expect(endLogData.tokensInput).toBe(0);
      expect(endLogData.tokensOutput).toBe(0);
    });
  });

  describe('Cost Calculation', () => {
    it('should calculate cost for orchestrator (GPT-4)', async () => {
      const mockFn = jest.fn(async () => ({
        tokensUsed: { input: 1000, output: 500 }
      }));

      const tracedFn = withTrace('orchestrator', 'agent_call', mockFn);
      await tracedFn({ sessionId: 'cost-test' });

      const endLog = consoleLogSpy.mock.calls.find(call => 
        call[0].includes('trace_end')
      );

      const endLogData = JSON.parse(endLog![0]);
      // orchestrator: input=$0.01/1K, output=$0.03/1K
      // Cost = (1000/1000)*0.01 + (500/1000)*0.03 = 0.01 + 0.015 = 0.025
      expect(endLogData.costUsd).toBe(0.025);
    });

    it('should calculate cost for market-data (GPT-3.5)', async () => {
      const mockFn = jest.fn(async () => ({
        tokensUsed: { input: 2000, output: 1000 }
      }));

      const tracedFn = withTrace('market-data', 'tool_execution', mockFn);
      await tracedFn({ sessionId: 'cost-test-2' });

      const endLog = consoleLogSpy.mock.calls.find(call => 
        call[0].includes('trace_end')
      );

      const endLogData = JSON.parse(endLog![0]);
      // market-data: input=$0.0015/1K, output=$0.002/1K
      // Cost = (2000/1000)*0.0015 + (1000/1000)*0.002 = 0.003 + 0.002 = 0.005
      expect(endLogData.costUsd).toBe(0.005);
    });

    it('should use default pricing for unknown agents', async () => {
      const mockFn = jest.fn(async () => ({
        tokensUsed: { input: 1000, output: 1000 }
      }));

      const tracedFn = withTrace('unknown-agent', 'workflow_step', mockFn);
      await tracedFn({ sessionId: 'cost-test-3' });

      const endLog = consoleLogSpy.mock.calls.find(call => 
        call[0].includes('trace_end')
      );

      const endLogData = JSON.parse(endLog![0]);
      // Default (market-data pricing): input=$0.0015/1K, output=$0.002/1K
      // Cost = (1000/1000)*0.0015 + (1000/1000)*0.002 = 0.0015 + 0.002 = 0.0035
      expect(endLogData.costUsd).toBe(0.0035);
    });
  });

  describe('Performance Measurement', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should accurately measure execution latency', async () => {
      const mockFn = jest.fn(async () => {
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 250));
        return { result: 'done' };
      });

      const tracedFn = withTrace('timing-agent', 'agent_call', mockFn);

      const promise = tracedFn({ sessionId: 'timing-test' });
      
      // Fast-forward time
      jest.advanceTimersByTime(250);
      
      await promise;

      const endLog = consoleLogSpy.mock.calls.find(call => 
        call[0].includes('trace_end')
      );

      const endLogData = JSON.parse(endLog![0]);
      expect(endLogData.latencyMs).toBeGreaterThanOrEqual(250);
    });

    it('should handle concurrent traces', async () => {
      const mockFn = jest.fn(async (input: { sessionId: string; id: number }) => {
        await new Promise(resolve => setTimeout(resolve, input.id * 10));
        return { id: input.id, tokensUsed: { input: input.id * 10, output: input.id * 5 } };
      });

      const tracedFn = withTrace('concurrent-agent', 'agent_call', mockFn);

      // Start multiple concurrent traces
      const promises = Array.from({ length: 5 }, (_, i) => 
        tracedFn({ sessionId: `concurrent-${i}`, id: i })
      );

      // Advance timers for all
      jest.advanceTimersByTime(50);

      const results = await Promise.all(promises);

      // Verify all traces completed
      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result.id).toBe(i);
      });

      // Verify all traces were logged
      const endLogs = consoleLogSpy.mock.calls.filter(call => 
        call[0].includes('trace_end')
      );

      expect(endLogs).toHaveLength(5);
    });
  });

  describe('Traced Function Examples', () => {
    it('should trace trading analysis execution', async () => {
      const result = await tracedExecuteTradingAnalysis({ sessionId: 'trading-test' });
      
      expect(result).toEqual({ analysis: 'mock result' });

      // Verify trace was created
      const startLog = consoleLogSpy.mock.calls.find(call => 
        call[0].includes('trace_start') && call[0].includes('trading-workflow')
      );

      expect(startLog).toBeDefined();
    });
  });

  describe('Parent Span Support', () => {
    it('should support parent span ID', () => {
      const parentTrace = traceManager.startTrace({
        sessionId: 'parent-session',
        agentId: 'parent-agent',
        operationType: 'workflow_step',
      });

      const childTrace = traceManager.startTrace({
        sessionId: 'parent-session',
        agentId: 'child-agent',
        operationType: 'agent_call',
        parentSpanId: parentTrace.correlationId,
      });

      expect(childTrace.parentSpanId).toBe(parentTrace.correlationId);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle error without code', async () => {
      const mockFn = jest.fn(async () => {
        throw new Error('Generic error');
      });

      const tracedFn = withTrace('error-agent', 'tool_execution', mockFn);

      await expect(tracedFn({ sessionId: 'error-test' })).rejects.toThrow('Generic error');

      const endLog = consoleLogSpy.mock.calls.find(call => 
        call[0].includes('trace_end')
      );

      const endLogData = JSON.parse(endLog![0]);
      expect(endLogData.errorCode).toBe('UNKNOWN_ERROR');
    });

    it('should preserve original error when tracing fails', async () => {
      const originalError = new Error('Original error');
      const mockFn = jest.fn(async () => {
        throw originalError;
      });

      const tracedFn = withTrace('failing-trace-agent', 'agent_call', mockFn);

      await expect(tracedFn({ sessionId: 'trace-fail' })).rejects.toThrow(originalError);
    });
  });

  describe('Large Scale Operations', () => {
    it('should handle high-frequency trace creation', () => {
      const traces: TraceContext[] = [];
      
      // Create many traces rapidly
      for (let i = 0; i < 100; i++) {
        const trace = traceManager.startTrace({
          sessionId: `session-${i}`,
          agentId: `agent-${i % 5}`,
          operationType: i % 2 === 0 ? 'agent_call' : 'tool_execution',
        });
        traces.push(trace);
      }

      expect(traces).toHaveLength(100);
      expect((traceManager as any).activeTraces.size).toBe(100);

      // Clear console log calls from trace start
      consoleLogSpy.mockClear();

      // End all traces
      traces.forEach((trace, i) => {
        traceManager.endTrace(trace.correlationId, {
          latencyMs: i,
          tokensInput: i * 10,
          tokensOutput: i * 5,
          costUsd: i * 0.001,
          success: i % 10 !== 0,
          errorCode: i % 10 === 0 ? 'TEST_ERROR' : undefined,
        });
      });

      expect((traceManager as any).activeTraces.size).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalledTimes(100);
    });

    it('should maintain trace isolation', async () => {
      const mockFn = (id: number) => async (input: { sessionId: string }) => {
        return { 
          id, 
          sessionId: input.sessionId,
          tokensUsed: { input: id * 100, output: id * 50 }
        };
      };

      // Create traced functions with different IDs
      const tracedFns = Array.from({ length: 5 }, (_, i) => 
        withTrace(`agent-${i}`, 'agent_call', mockFn(i))
      );

      // Clear previous logs
      consoleLogSpy.mockClear();

      // Execute all concurrently
      const promises = tracedFns.map((fn, i) => 
        fn({ sessionId: `isolated-${i}` })
      );

      const allResults = await Promise.all(promises);

      // Verify each result maintains its identity
      allResults.forEach((result, i) => {
        expect(result.id).toBe(i);
        expect(result.sessionId).toBe(`isolated-${i}`);
      });

      // Verify traces are properly isolated in logs
      const endLogs = consoleLogSpy.mock.calls.filter(call => 
        call[0].includes('trace_end')
      );

      expect(endLogs).toHaveLength(5);
      
      // Verify each trace has the correct metadata
      const loggedSessions = new Set();
      const loggedAgents = new Set();
      
      endLogs.forEach(call => {
        const logData = JSON.parse(call[0]);
        loggedSessions.add(logData.sessionId);
        loggedAgents.add(logData.agentId);
      });
      
      expect(loggedSessions.size).toBe(5);
      expect(loggedAgents.size).toBe(5);
    });
  });
});