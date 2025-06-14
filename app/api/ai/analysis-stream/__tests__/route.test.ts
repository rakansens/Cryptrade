// Setup test environment before any imports
import { mockTestEnv } from '@/config/testing/setupEnvMock';

const restoreEnv = mockTestEnv();

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { 
  AnalysisProgressEvent, 
  AnalysisStepType,
  getAnalysisSteps 
} from '@/types/analysis-progress';

// Mock the proposal generation tool before it's imported
const mockProposalGenerationTool = {
  execute: jest.fn().mockResolvedValue({
    proposalGroup: {
      id: 'pg_test_123',
      proposals: [
        {
          id: 'prop_1',
          type: 'trendline',
          reasoning: 'Test proposal'
        }
      ]
    }
  })
};

jest.mock('@/lib/mastra/tools/proposal-generation.tool', () => ({
  proposalGenerationTool: mockProposalGenerationTool
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

describe('Analysis Stream API Route', () => {
  // Increase timeout for streaming tests
  jest.setTimeout(10000);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    restoreEnv();
  });

  describe('POST /api/ai/analysis-stream', () => {
    // Helper function to collect SSE events from stream
    async function collectSSEEvents(response: Response): Promise<AnalysisProgressEvent[]> {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      const events: AnalysisProgressEvent[] = [];
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data.trim()) {
                events.push(JSON.parse(data));
              }
            }
          }
        }
      } catch (error) {
        // Stream might be closed
      }
      
      return events;
    }

    it('should stream analysis progress events', async () => {
      const request = new NextRequest('http://localhost/api/ai/analysis-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'trendline',
          sessionId: 'test-stream-123'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');
      expect(response.headers.get('cache-control')).toBe('no-cache');
      expect(response.headers.get('connection')).toBe('keep-alive');

      // Collect events with timeout
      const eventsPromise = collectSSEEvents(response);
      const timeoutPromise = new Promise<AnalysisProgressEvent[]>((resolve) => 
        setTimeout(() => resolve([]), 5000)
      );
      
      const events = await Promise.race([eventsPromise, timeoutPromise]);

      // Verify we got the expected event types
      const eventTypes = events.map(e => e.type);
      expect(eventTypes).toContain('analysis:start');
      expect(eventTypes).toContain('analysis:step-start');
      expect(eventTypes).toContain('analysis:step-progress');
      expect(eventTypes).toContain('analysis:step-complete');
      expect(eventTypes).toContain('analysis:complete');

      // Verify start event
      const startEvent = events.find(e => e.type === 'analysis:start');
      expect(startEvent?.data).toMatchObject({
        totalSteps: expect.any(Number),
        analysisType: 'trendline',
        symbol: 'BTCUSDT',
        interval: '1h'
      });

      // Verify complete event
      const completeEvent = events.find(e => e.type === 'analysis:complete');
      expect(completeEvent?.data).toMatchObject({
        duration: expect.any(Number),
        proposalCount: 1,
        proposalGroupId: 'pg_test_123'
      });
    });

    it('should handle different analysis types', async () => {
      const analysisTypes: Array<'trendline' | 'support-resistance' | 'fibonacci' | 'pattern' | 'all'> = 
        ['trendline', 'support-resistance', 'fibonacci', 'pattern', 'all'];

      for (const analysisType of analysisTypes) {
        const request = new NextRequest('http://localhost/api/ai/analysis-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'ETHUSDT',
            interval: '4h',
            analysisType
          })
        });

        const response = await POST(request);
        expect(response.status).toBe(200);

        const events = await collectSSEEvents(response);
        const startEvent = events.find(e => e.type === 'analysis:start');
        
        expect(startEvent?.data.analysisType).toBe(analysisType);
        
        // Verify correct steps are included
        const expectedSteps = getAnalysisSteps(analysisType);
        expect(startEvent?.data.totalSteps).toBe(expectedSteps.length);
      }
    });

    it('should validate request parameters', async () => {
      const invalidRequests = [
        { interval: '1h', analysisType: 'trendline' }, // Missing symbol
        { symbol: 'BTCUSDT', analysisType: 'trendline' }, // Missing interval
        { symbol: 'BTCUSDT', interval: '1h', analysisType: 'invalid' }, // Invalid analysisType
        { symbol: '', interval: '1h', analysisType: 'trendline' }, // Empty symbol
      ];

      for (const invalidBody of invalidRequests) {
        const request = new NextRequest('http://localhost/api/ai/analysis-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidBody)
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data).toMatchObject({
          error: 'Invalid request',
          details: expect.any(Array)
        });
      }
    });

    it('should handle maxProposals parameter', async () => {
      const request = new NextRequest('http://localhost/api/ai/analysis-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'all',
          maxProposals: 10
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Wait for stream to complete
      await collectSSEEvents(response);

      // The proposalGenerationTool should have been called with maxProposals
      expect(mockProposalGenerationTool.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          maxProposals: 10
        })
      );
    });

    it('should stream text character by character for specific steps', async () => {
      const request = new NextRequest('http://localhost/api/ai/analysis-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'pattern'
        })
      });

      const response = await POST(request);
      const events = await collectSSEEvents(response);

      // Find events for steps that support character streaming
      const streamingSteps = ['peak-trough-detection', 'pattern-validation', 'metrics-calculation'];
      
      for (const stepType of streamingSteps) {
        const progressEvents = events.filter(e => 
          e.type === 'analysis:step-progress' && 
          e.data.step.type === stepType
        );

        if (progressEvents.length > 0) {
          // Should have multiple progress events as text streams
          expect(progressEvents.length).toBeGreaterThan(1);
          
          // Text should build up progressively
          const texts = progressEvents.map(e => e.data.step.streamingText || '');
          for (let i = 1; i < texts.length; i++) {
            expect(texts[i].length).toBeGreaterThanOrEqual(texts[i-1].length);
          }
        }
      }
    });

    it('should handle stream errors gracefully', async () => {
      // Mock tool to throw error
      mockProposalGenerationTool.execute.mockRejectedValueOnce(
        new Error('Tool execution failed')
      );

      const request = new NextRequest('http://localhost/api/ai/analysis-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'trendline'
        })
      });

      const response = await POST(request);
      const events = await collectSSEEvents(response);

      // Should still complete but with 0 proposals
      const completeEvent = events.find(e => e.type === 'analysis:complete');
      expect(completeEvent?.data.proposalCount).toBe(0);
    });

    it('should generate unique session ID if not provided', async () => {
      const request = new NextRequest('http://localhost/api/ai/analysis-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'trendline'
          // No sessionId provided
        })
      });

      const response = await POST(request);
      const events = await collectSSEEvents(response);

      // All events should have the same sessionId
      const sessionIds = new Set(events.map(e => e.sessionId));
      expect(sessionIds.size).toBe(1);
      
      const sessionId = Array.from(sessionIds)[0];
      expect(sessionId).toMatch(/^session_\d+$/);
    });
  });
});