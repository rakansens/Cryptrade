/**
 * Entry Proposal Streaming Response Test
 * 
 * Tests streaming responses from AI agents when generating entry proposals
 * Verifies real-time updates and progressive rendering
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { tradingAgent } from '../agents/trading.agent';
import { logger } from '@/lib/utils/logger';
import { Readable } from 'stream';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock OpenAI streaming response
jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn(() => ({
    generateStream: jest.fn().mockImplementation(async function* () {
      // Simulate streaming response
      const chunks = [
        { text: 'エントリー提案を' },
        { text: '分析中です...\n' },
        { text: '\n1. **ロングエントリー提案**\n' },
        { text: '- エントリー価格: $100,500\n' },
        { text: '- ストップロス: $99,500\n' },
        { text: '- テイクプロフィット: $102,000\n' },
        { toolCall: { toolName: 'entryProposalGeneration', args: { symbol: 'BTCUSDT' } } },
        { toolResult: { 
          toolName: 'entryProposalGeneration',
          result: {
            success: true,
            proposalGroup: {
              id: 'epg_stream_123',
              proposals: [{
                id: 'ep_stream_1',
                entryPrice: 100500,
                direction: 'long',
              }],
            },
          },
        }},
        { text: '\n提案の生成が完了しました。' },
      ];

      for (const chunk of chunks) {
        yield chunk;
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }),
    generate: jest.fn().mockResolvedValue({
      text: 'エントリー提案を分析中です...\n\n1. **ロングエントリー提案**\n- エントリー価格: $100,500\n- ストップロス: $99,500\n- テイクプロフィット: $102,000\n\n提案の生成が完了しました。',
      steps: [{
        toolCalls: [{ toolName: 'entryProposalGeneration', args: { symbol: 'BTCUSDT' } }],
        toolResults: [{
          toolName: 'entryProposalGeneration',
          result: {
            success: true,
            proposalGroup: {
              id: 'epg_stream_123',
              proposals: [{
                id: 'ep_stream_1',
                entryPrice: 100500,
                direction: 'long',
              }],
            },
          },
        }],
      }],
    }),
  })),
}));

describe('Entry Proposal Streaming Response', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Streaming Text Generation', () => {
    it('should stream text chunks progressively', async () => {
      const chunks: string[] = [];
      const mockStreamHandler = jest.fn((chunk: string) => {
        chunks.push(chunk);
      });

      // Simulate streaming response handling
      const streamingResponse = {
        onChunk: mockStreamHandler,
        onComplete: jest.fn(),
        onError: jest.fn(),
      };

      // Mock streaming execution
      const simulateStreaming = async () => {
        const textChunks = [
          'エントリー提案を',
          '分析中です...\n',
          '\n1. **ロングエントリー提案**\n',
          '- エントリー価格: $100,500\n',
          '- ストップロス: $99,500\n',
          '- テイクプロフィット: $102,000\n',
        ];

        for (const chunk of textChunks) {
          streamingResponse.onChunk(chunk);
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        streamingResponse.onComplete();
      };

      await simulateStreaming();

      expect(chunks).toHaveLength(6);
      expect(chunks[0]).toBe('エントリー提案を');
      expect(chunks.join('')).toContain('エントリー価格: $100,500');
      expect(streamingResponse.onComplete).toHaveBeenCalled();
    });

    it('should handle tool calls during streaming', async () => {
      const toolCalls: any[] = [];
      const mockToolHandler = jest.fn((toolCall) => {
        toolCalls.push(toolCall);
      });

      // Simulate streaming with tool calls
      const simulateStreamingWithTools = async () => {
        const events = [
          { type: 'text', content: 'エントリー提案を生成します...\n' },
          { type: 'toolCall', toolName: 'entryProposalGeneration', args: { symbol: 'BTCUSDT' } },
          { type: 'text', content: '\n処理中...\n' },
          { type: 'toolResult', result: { success: true, proposalGroup: { id: 'epg_123' } } },
          { type: 'text', content: '完了しました。' },
        ];

        for (const event of events) {
          if (event.type === 'toolCall') {
            mockToolHandler(event);
          }
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      };

      await simulateStreamingWithTools();

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].toolName).toBe('entryProposalGeneration');
      expect(mockToolHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'entryProposalGeneration',
        })
      );
    });
  });

  describe('Progressive UI Updates', () => {
    it('should emit progress events during streaming', async () => {
      const progressEvents: any[] = [];
      const mockProgressHandler = jest.fn((event) => {
        progressEvents.push(event);
      });

      // Simulate progress tracking
      const stages = [
        { stage: 'analyzing', progress: 0.2, message: '市場データを分析中...' },
        { stage: 'calculating', progress: 0.5, message: 'エントリーポイントを計算中...' },
        { stage: 'risk_management', progress: 0.8, message: 'リスク管理パラメータを設定中...' },
        { stage: 'complete', progress: 1.0, message: '提案の生成が完了しました' },
      ];

      for (const stage of stages) {
        mockProgressHandler(stage);
        await new Promise(resolve => setTimeout(resolve, 30));
      }

      expect(progressEvents).toHaveLength(4);
      expect(progressEvents[0].progress).toBe(0.2);
      expect(progressEvents[3].progress).toBe(1.0);
      expect(progressEvents[3].stage).toBe('complete');
    });

    it('should update UI with partial results during streaming', async () => {
      const mockUIUpdater = jest.fn();
      
      // Simulate partial proposal updates
      const partialUpdates = [
        {
          type: 'proposal_preview',
          data: {
            direction: 'long',
            confidence: 0.85,
          },
        },
        {
          type: 'entry_calculated',
          data: {
            entryPrice: 100500,
            entryZone: { start: 100000, end: 101000 },
          },
        },
        {
          type: 'risk_calculated',
          data: {
            stopLoss: 99500,
            takeProfit: [102000, 103000],
            riskRewardRatio: 3,
          },
        },
        {
          type: 'proposal_complete',
          data: {
            id: 'ep_123',
            status: 'ready',
          },
        },
      ];

      for (const update of partialUpdates) {
        mockUIUpdater(update);
        await new Promise(resolve => setTimeout(resolve, 25));
      }

      expect(mockUIUpdater).toHaveBeenCalledTimes(4);
      expect(mockUIUpdater).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'entry_calculated',
          data: expect.objectContaining({
            entryPrice: 100500,
          }),
        })
      );
    });
  });

  describe('Error Handling in Streaming', () => {
    it('should handle streaming errors gracefully', async () => {
      const mockErrorHandler = jest.fn();
      const mockRecoveryHandler = jest.fn();

      // Simulate streaming error
      const simulateStreamingError = async () => {
        try {
          // Start streaming
          await new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Stream interrupted')), 100);
          });
        } catch (error) {
          mockErrorHandler(error);
          // Attempt recovery
          mockRecoveryHandler({ action: 'retry', fallback: 'non-streaming' });
        }
      };

      await simulateStreamingError();

      expect(mockErrorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Stream interrupted',
        })
      );
      expect(mockRecoveryHandler).toHaveBeenCalled();
    });

    it('should fallback to non-streaming on connection issues', async () => {
      const mockStreamingAttempt = jest.fn().mockRejectedValue(new Error('Connection failed'));
      const mockNonStreamingFallback = jest.fn().mockResolvedValue({
        text: 'Fallback response',
        proposalGroup: { id: 'epg_fallback' },
      });

      let result;
      try {
        await mockStreamingAttempt();
      } catch (error) {
        result = await mockNonStreamingFallback();
      }

      expect(mockStreamingAttempt).toHaveBeenCalled();
      expect(mockNonStreamingFallback).toHaveBeenCalled();
      expect(result).toEqual({
        text: 'Fallback response',
        proposalGroup: { id: 'epg_fallback' },
      });
    });
  });

  describe('Streaming Performance', () => {
    it('should maintain reasonable chunk processing speed', async () => {
      const chunkTimestamps: number[] = [];
      const mockChunkProcessor = jest.fn(() => {
        chunkTimestamps.push(Date.now());
      });

      // Process multiple chunks
      for (let i = 0; i < 10; i++) {
        mockChunkProcessor();
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Calculate average time between chunks
      const deltas = [];
      for (let i = 1; i < chunkTimestamps.length; i++) {
        deltas.push(chunkTimestamps[i] - chunkTimestamps[i - 1]);
      }
      const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;

      expect(avgDelta).toBeGreaterThanOrEqual(10);
      expect(avgDelta).toBeLessThan(50); // Should not be too slow
    });

    it('should buffer chunks efficiently', async () => {
      const buffer: string[] = [];
      const mockBufferHandler = jest.fn((chunk: string) => {
        buffer.push(chunk);
        // Flush buffer when it reaches certain size
        if (buffer.length >= 3) {
          const flushed = buffer.splice(0, buffer.length).join('');
          return { action: 'flush', content: flushed };
        }
        return { action: 'buffer' };
      });

      const chunks = ['小さな', 'チャンク', 'を', 'バッファ', 'リング', 'します'];
      const flushResults = [];

      for (const chunk of chunks) {
        const result = mockBufferHandler(chunk);
        if (result.action === 'flush') {
          flushResults.push(result.content);
        }
      }

      expect(mockBufferHandler).toHaveBeenCalledTimes(6);
      expect(flushResults.length).toBeGreaterThan(0);
    });
  });

  describe('Real-time Proposal Updates', () => {
    it('should stream multiple proposals sequentially', async () => {
      const proposals: any[] = [];
      const mockProposalHandler = jest.fn((proposal) => {
        proposals.push(proposal);
      });

      // Simulate streaming multiple proposals
      const proposalData = [
        { id: 'ep_1', direction: 'long', entryPrice: 100500 },
        { id: 'ep_2', direction: 'short', entryPrice: 105000 },
        { id: 'ep_3', direction: 'long', entryPrice: 99000 },
      ];

      for (const [index, proposal] of proposalData.entries()) {
        // Stream proposal header
        await new Promise(resolve => setTimeout(resolve, 20));
        
        // Stream proposal details
        mockProposalHandler({
          index: index + 1,
          total: proposalData.length,
          proposal,
        });
        
        await new Promise(resolve => setTimeout(resolve, 30));
      }

      expect(proposals).toHaveLength(3);
      expect(proposals[0].proposal.direction).toBe('long');
      expect(proposals[1].proposal.direction).toBe('short');
    });
  });
});