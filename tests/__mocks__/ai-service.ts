/**
 * AI サービスのモック実装
 */

import { 
  mockTradingProposal, 
  mockDrawingProposal, 
  mockIndicatorAnalysis,
  mockMarketSentiment 
} from '../__fixtures__/ai/proposal-responses';

export class MockAIService {
  private responseDelay: number = 100;
  private shouldFail: boolean = false;
  private customResponses: Map<string, any> = new Map();

  // Analysis methods
  async analyzeTradingOpportunity(params: any) {
    if (this.shouldFail) {
      throw new Error('AI service temporarily unavailable');
    }

    await this.simulateDelay();
    
    const customResponse = this.customResponses.get('tradingProposal');
    return customResponse || mockTradingProposal;
  }

  async generateDrawingProposal(params: any) {
    if (this.shouldFail) {
      throw new Error('AI service temporarily unavailable');
    }

    await this.simulateDelay();
    
    const customResponse = this.customResponses.get('drawingProposal');
    return customResponse || mockDrawingProposal;
  }

  async analyzeIndicators(params: any) {
    if (this.shouldFail) {
      throw new Error('AI service temporarily unavailable');
    }

    await this.simulateDelay();
    
    const customResponse = this.customResponses.get('indicatorAnalysis');
    return customResponse || mockIndicatorAnalysis;
  }

  async getMarketSentiment(symbol: string) {
    if (this.shouldFail) {
      throw new Error('AI service temporarily unavailable');
    }

    await this.simulateDelay();
    
    const customResponse = this.customResponses.get('marketSentiment');
    return customResponse || mockMarketSentiment;
  }

  // Streaming chat simulation
  async *streamChat(messages: any[], onProgress?: (progress: number) => void) {
    if (this.shouldFail) {
      throw new Error('AI service temporarily unavailable');
    }

    const response = 'これは模擬的なAIレスポンスです。市場は現在上昇トレンドにあり、主要なサポートレベルは47,500ドルです。';
    const chunks = this.chunkResponse(response, 10);
    
    for (let i = 0; i < chunks.length; i++) {
      await this.simulateDelay(50);
      if (onProgress) {
        onProgress((i + 1) / chunks.length * 100);
      }
      yield chunks[i];
    }
  }

  // Test helper methods
  setResponseDelay(ms: number) {
    this.responseDelay = ms;
  }

  setShouldFail(shouldFail: boolean) {
    this.shouldFail = shouldFail;
  }

  setCustomResponse(type: string, response: any) {
    this.customResponses.set(type, response);
  }

  clearCustomResponses() {
    this.customResponses.clear();
  }

  // Private helpers
  private async simulateDelay(ms?: number) {
    return new Promise(resolve => setTimeout(resolve, ms || this.responseDelay));
  }

  private chunkResponse(response: string, chunkSize: number): string[] {
    const chunks = [];
    for (let i = 0; i < response.length; i += chunkSize) {
      chunks.push(response.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

// Mock OpenAI client
export class MockOpenAIClient {
  chat = {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'Mock AI response',
            role: 'assistant'
          }
        }]
      })
    }
  };

  embeddings = {
    create: jest.fn().mockResolvedValue({
      data: [{
        embedding: Array(1536).fill(0).map(() => Math.random())
      }]
    })
  };
}

// Mock Anthropic client
export class MockAnthropicClient {
  messages = {
    create: jest.fn().mockResolvedValue({
      content: [{
        type: 'text',
        text: 'Mock Anthropic response'
      }]
    })
  };

  async *stream(params: any) {
    const response = 'Streaming response from Anthropic';
    for (const char of response) {
      await new Promise(resolve => setTimeout(resolve, 10));
      yield {
        type: 'content_block_delta',
        delta: { text: char }
      };
    }
  }
}

export const mockAIService = new MockAIService();