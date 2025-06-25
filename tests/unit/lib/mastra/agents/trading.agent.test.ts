import { openai } from '@ai-sdk/openai';

// Mock dependencies first
jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn((model: string) => ({
    id: model,
    provider: 'openai'
  }))
}));

// Mock tools
jest.mock('@/lib/mastra/tools/market-data-resilient.tool', () => ({
  marketDataResilientTool: { name: 'marketDataResilientTool', execute: jest.fn() }
}));

jest.mock('@/lib/mastra/tools/chart-data-analysis.tool', () => ({
  chartDataAnalysisTool: { name: 'chartDataAnalysisTool', execute: jest.fn() }
}));

jest.mock('@/lib/mastra/tools/enhanced-line-analysis.tool', () => ({
  enhancedLineAnalysisTool: { name: 'enhancedLineAnalysisTool', execute: jest.fn() }
}));

jest.mock('@/lib/mastra/tools/proposal-generation.tool', () => ({
  proposalGenerationTool: { name: 'proposalGenerationTool', execute: jest.fn() }
}));

jest.mock('@/lib/mastra/tools/entry-proposal-generation', () => ({
  entryProposalGenerationTool: { name: 'entryProposalGenerationTool', execute: jest.fn() }
}));

// Store captured config
let capturedConfig: any = null;

jest.mock('@mastra/core', () => ({
  Agent: jest.fn().mockImplementation((config) => {
    capturedConfig = config;
    return {
      name: config.name,
      model: config.model,
      instructions: config.instructions,
      tools: config.tools,
      generate: jest.fn()
    };
  })
}));

// Import after mocks
import { tradingAgent, type TradingAgentContext } from '@/lib/mastra/agents/trading.agent';
import { Agent } from '@mastra/core';

describe.skip('TradingAgent Configuration', () => {
  // Get the config once
  const agentConfig = (Agent as jest.Mock).mock.calls[0]?.[0] || capturedConfig;

  describe('Basic Configuration', () => {
    it('should be created with correct name', () => {
      expect(Agent).toHaveBeenCalled();
      expect(agentConfig).toBeDefined();
      expect(agentConfig.name).toBe('cryptrade-trading-assistant');
    });

    it('should have all required tools', () => {
      expect(agentConfig.tools).toBeDefined();
      expect(Object.keys(agentConfig.tools)).toEqual([
        'marketData',
        'proposalGeneration',
        'entryProposalGeneration',
        'chartAnalysis',
        'enhancedLineAnalysis'
      ]);
    });
  });

  describe('Dynamic Model Selection', () => {
    const modelFn = agentConfig?.model;

    it('should have a model function', () => {
      expect(typeof modelFn).toBe('function');
    });

    it('should select gpt-4o for proposal mode', () => {
      jest.clearAllMocks();
      const model = modelFn({ isProposalMode: true });
      expect(openai).toHaveBeenCalledWith('gpt-4o');
      expect(model.id).toBe('gpt-4o');
    });

    it('should select gpt-4o for comprehensive analysis', () => {
      jest.clearAllMocks();
      const model = modelFn({ analysisType: 'comprehensive' });
      expect(openai).toHaveBeenCalledWith('gpt-4o');
      expect(model.id).toBe('gpt-4o');
    });

    it('should select gpt-4o-mini for high volatility', () => {
      jest.clearAllMocks();
      const model = modelFn({ marketVolatility: 'high' });
      expect(openai).toHaveBeenCalledWith('gpt-4o-mini');
      expect(model.id).toBe('gpt-4o-mini');
    });

    it('should select gpt-4o-mini for expert users', () => {
      jest.clearAllMocks();
      const model = modelFn({ userLevel: 'expert' });
      expect(openai).toHaveBeenCalledWith('gpt-4o-mini');
      expect(model.id).toBe('gpt-4o-mini');
    });

    it('should select gpt-3.5-turbo for standard conditions', () => {
      jest.clearAllMocks();
      const model = modelFn({
        userLevel: 'intermediate',
        marketVolatility: 'normal',
        analysisType: 'basic'
      });
      expect(openai).toHaveBeenCalledWith('gpt-3.5-turbo');
      expect(model.id).toBe('gpt-3.5-turbo');
    });
  });

  describe('Dynamic Instructions', () => {
    const instructionsFn = agentConfig?.instructions;

    it('should have an instructions function', () => {
      expect(typeof instructionsFn).toBe('function');
    });

    it('should generate beginner instructions', () => {
      const instructions = instructionsFn({
        userLevel: 'beginner',
        language: 'ja'
      });
      
      expect(instructions).toContain('Beginner-Specific Guidelines');
      expect(instructions).toContain('Use simple, non-technical language');
      expect(instructions).toContain('初心者の方は、まず少額から始めることをお勧めします');
    });

    it('should generate expert instructions', () => {
      const instructions = instructionsFn({
        userLevel: 'expert',
        language: 'ja'
      });
      
      expect(instructions).toContain('Expert-Specific Guidelines');
      expect(instructions).toContain('Deep technical analysis');
      expect(instructions).toContain('4H TFでのブルフラッグ形成');
    });

    it('should include high volatility warnings', () => {
      const instructions = instructionsFn({
        marketVolatility: 'high',
        language: 'ja'
      });
      
      expect(instructions).toContain('High Volatility Market');
      expect(instructions).toContain('⚠️ 現在市場は非常にボラティリティが高い状態です');
    });

    it('should adapt to trading styles', () => {
      const conservative = instructionsFn({ tradingStyle: 'conservative' });
      expect(conservative).toContain('Conservative Trading Style');
      expect(conservative).toContain('capital preservation');

      const aggressive = instructionsFn({ tradingStyle: 'aggressive' });
      expect(aggressive).toContain('Aggressive Trading Style');
      expect(aggressive).toContain('Leverage considerations');
    });

    it('should handle proposal modes', () => {
      const entryProposal = instructionsFn({
        isProposalMode: true,
        proposalType: 'entry'
      });
      expect(entryProposal).toContain('ENTRY PROPOSAL MODE ACTIVE');

      const standardProposal = instructionsFn({
        isProposalMode: true,
        proposalType: 'trendline'
      });
      expect(standardProposal).toContain('PROPOSAL MODE ACTIVE');
    });

    it('should support different languages', () => {
      const japanese = instructionsFn({ language: 'ja' });
      expect(japanese).toContain('Japanese');
      expect(japanese).toContain('こんにちは！今日の市場は活気がありますね');

      const english = instructionsFn({ language: 'en' });
      expect(english).toContain('English');
    });

    it('should include core functionality', () => {
      const instructions = instructionsFn({});
      expect(instructions).toContain('Real-time market data analysis');
      expect(instructions).toContain('Technical analysis using RSI, MACD');
      expect(instructions).toContain('For Greetings & Casual Conversation');
      expect(instructions).toContain('For Market Analysis & Trading Questions');
    });
  });

  describe('Complex Context Combinations', () => {
    const instructionsFn = agentConfig?.instructions;

    it('should handle beginner in high volatility', () => {
      const instructions = instructionsFn({
        userLevel: 'beginner',
        marketVolatility: 'high',
        tradingStyle: 'conservative',
        language: 'ja'
      });

      expect(instructions).toContain('Beginner-Specific Guidelines');
      expect(instructions).toContain('High Volatility Market');
      expect(instructions).toContain('Conservative Trading Style');
    });

    it('should handle expert with aggressive style', () => {
      const instructions = instructionsFn({
        userLevel: 'expert',
        marketVolatility: 'low',
        tradingStyle: 'aggressive',
        language: 'en'
      });

      expect(instructions).toContain('Expert-Specific Guidelines');
      expect(instructions).toContain('Low Volatility Market');
      expect(instructions).toContain('Aggressive Trading Style');
    });
  });

  describe('Tool Integration', () => {
    it('should integrate all required tools', () => {
      const tools = agentConfig?.tools;
      
      expect(tools).toBeDefined();
      expect(tools.marketData).toBeDefined();
      expect(tools.proposalGeneration).toBeDefined();
      expect(tools.entryProposalGeneration).toBeDefined();
      expect(tools.chartAnalysis).toBeDefined();
      expect(tools.enhancedLineAnalysis).toBeDefined();
    });
  });
});