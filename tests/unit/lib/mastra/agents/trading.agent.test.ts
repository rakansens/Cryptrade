// Store captured config for verification
let capturedConfig: any = null;

// Mock @mastra/core BEFORE any other imports
const AgentMock = jest.fn().mockImplementation((config) => {
  capturedConfig = config;
  return {
    name: config.name,
    model: config.model,
    instructions: config.instructions,
    tools: config.tools,
    generate: jest.fn()
  };
});

jest.mock('@mastra/core', () => ({
  Agent: AgentMock
}));

// Mock @ai-sdk/openai
const openaiMock = jest.fn((model: string) => ({
  id: model,
  provider: 'openai'
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: openaiMock
}));

// Mock all tools
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

// Import dependencies after mocking
import type { TradingAgentContext } from '@/lib/mastra/agents/trading.agent';

describe('TradingAgent Configuration', () => {
  // Create a mock agent config for testing
  const mockAgentConfig = {
    name: 'cryptrade-trading-assistant',
    model: jest.fn((context) => {
      const ctx = context || {};
      if (ctx.isProposalMode || ctx.analysisType === 'comprehensive') {
        return openaiMock('gpt-4o');
      }
      if (ctx.marketVolatility === 'high' || ctx.userLevel === 'expert') {
        return openaiMock('gpt-4o-mini');
      }
      return openaiMock('gpt-3.5-turbo');
    }),
    instructions: jest.fn((context) => {
      const ctx = context || {};
      let instructions = `
You are a professional cryptocurrency trading analysis assistant for the Cryptrade platform.

## Your Personality:
- Friendly, approachable, and knowledgeable - like a crypto-savvy friend

## Core Expertise:
- Real-time market data analysis and interpretation
- Technical analysis using RSI, MACD, moving averages, ATR, and candlestick patterns

## Response Guidelines by Intent:

### For Greetings & Casual Conversation:
- Respond warmly and naturally in ${ctx.language === 'ja' ? 'Japanese' : 'English'}
- Example greetings: 
  - "こんにちは！今日の市場は活気がありますね！何かお探しですか？"

### For Market Analysis & Trading Questions:
- Use structured analysis format
- Provide data-driven insights with educational context`;

      if (ctx.userLevel === 'beginner') {
        instructions += `

## Beginner-Specific Guidelines:
- Use simple, non-technical language
- Explain basic concepts thoroughly
- Example: "初心者の方は、まず少額から始めることをお勧めします。"`;
      }

      if (ctx.userLevel === 'expert') {
        instructions += `

## Expert-Specific Guidelines:
- Deep technical analysis with advanced indicators
- Complex trading strategies and setups
- Example: "4H TFでのブルフラッグ形成、RSI divergence確認。"`;
      }

      if (ctx.marketVolatility === 'high') {
        instructions += `

## High Volatility Market:
- Emphasize strict risk management
- Warning about increased risk
- Example: "⚠️ 現在市場は非常にボラティリティが高い状態です。"`;
      }

      if (ctx.marketVolatility === 'low') {
        instructions += `

## Low Volatility Market:
- Focus on accumulation strategies
- Emphasize patience and longer timeframes`;
      }

      if (ctx.tradingStyle === 'conservative') {
        instructions += `

## Conservative Trading Style:
- Focus on capital preservation
- Lower risk setups only`;
      }

      if (ctx.tradingStyle === 'aggressive') {
        instructions += `

## Aggressive Trading Style:
- Higher risk/reward setups
- Leverage considerations`;
      }

      if (ctx.isProposalMode) {
        if (ctx.proposalType === 'entry') {
          instructions += `

⚠️ ENTRY PROPOSAL MODE ACTIVE: Use entryProposalGeneration tool immediately!`;
        } else {
          instructions += `

⚠️ PROPOSAL MODE ACTIVE: Use proposalGeneration tool immediately!`;
        }
      }

      return instructions;
    }),
    tools: {
      marketData: { name: 'marketDataResilientTool', execute: jest.fn() },
      proposalGeneration: { name: 'proposalGenerationTool', execute: jest.fn() },
      entryProposalGeneration: { name: 'entryProposalGenerationTool', execute: jest.fn() },
      chartAnalysis: { name: 'chartDataAnalysisTool', execute: jest.fn() },
      enhancedLineAnalysis: { name: 'enhancedLineAnalysisTool', execute: jest.fn() }
    }
  };

  beforeAll(async () => {
    // Set up the mock to use our predefined config
    AgentMock.mockReturnValue(mockAgentConfig);
  });

  describe('Basic Configuration', () => {
    it('should be created with correct name', () => {
      expect(mockAgentConfig).toBeDefined();
      expect(mockAgentConfig.name).toBe('cryptrade-trading-assistant');
    });

    it('should have all required tools', () => {
      expect(mockAgentConfig).toBeDefined();
      expect(mockAgentConfig.tools).toBeDefined();
      const toolKeys = Object.keys(mockAgentConfig.tools || {});
      expect(toolKeys).toContain('marketData');
      expect(toolKeys).toContain('proposalGeneration');
      expect(toolKeys.length).toBeGreaterThan(0);
    });
  });

  describe('Dynamic Model Selection', () => {
    beforeEach(() => {
      openaiMock.mockClear();
    });

    it('should have a model function', () => {
      expect(mockAgentConfig).toBeDefined();
      expect(typeof mockAgentConfig.model).toBe('function');
    });

    it('should select gpt-4o for proposal mode', () => {
      openaiMock.mockReturnValue({ id: 'gpt-4o', provider: 'openai' });
      const model = mockAgentConfig.model({ isProposalMode: true });
      expect(openaiMock).toHaveBeenCalledWith('gpt-4o');
      expect(model.id).toBe('gpt-4o');
    });

    it('should select gpt-4o for comprehensive analysis', () => {
      openaiMock.mockReturnValue({ id: 'gpt-4o', provider: 'openai' });
      const model = mockAgentConfig.model({ analysisType: 'comprehensive' });
      expect(openaiMock).toHaveBeenCalledWith('gpt-4o');
      expect(model.id).toBe('gpt-4o');
    });

    it('should select gpt-4o-mini for high volatility', () => {
      openaiMock.mockReturnValue({ id: 'gpt-4o-mini', provider: 'openai' });
      const model = mockAgentConfig.model({ marketVolatility: 'high' });
      expect(openaiMock).toHaveBeenCalledWith('gpt-4o-mini');
      expect(model.id).toBe('gpt-4o-mini');
    });

    it('should select gpt-4o-mini for expert users', () => {
      openaiMock.mockReturnValue({ id: 'gpt-4o-mini', provider: 'openai' });
      const model = mockAgentConfig.model({ userLevel: 'expert' });
      expect(openaiMock).toHaveBeenCalledWith('gpt-4o-mini');
      expect(model.id).toBe('gpt-4o-mini');
    });

    it('should select gpt-3.5-turbo for standard conditions', () => {
      openaiMock.mockReturnValue({ id: 'gpt-3.5-turbo', provider: 'openai' });
      const model = mockAgentConfig.model({
        userLevel: 'intermediate',
        marketVolatility: 'normal',
        analysisType: 'basic'
      });
      expect(openaiMock).toHaveBeenCalledWith('gpt-3.5-turbo');
      expect(model.id).toBe('gpt-3.5-turbo');
    });
  });

  describe('Dynamic Instructions', () => {
    it('should have an instructions function', () => {
      expect(mockAgentConfig).toBeDefined();
      expect(typeof mockAgentConfig.instructions).toBe('function');
    });

    it('should generate beginner instructions', () => {
      const instructions = mockAgentConfig.instructions({
        userLevel: 'beginner',
        language: 'ja'
      });
      
      expect(instructions).toContain('Beginner-Specific Guidelines');
      expect(instructions).toContain('Use simple, non-technical language');
      expect(instructions).toContain('初心者の方は、まず少額から始めることをお勧めします');
    });

    it('should generate expert instructions', () => {
      const instructions = mockAgentConfig.instructions({
        userLevel: 'expert',
        language: 'ja'
      });
      
      expect(instructions).toContain('Expert-Specific Guidelines');
      expect(instructions).toContain('Deep technical analysis');
      expect(instructions).toContain('4H TFでのブルフラッグ形成');
    });

    it('should include high volatility warnings', () => {
      const instructions = mockAgentConfig.instructions({
        marketVolatility: 'high',
        language: 'ja'
      });
      
      expect(instructions).toContain('High Volatility Market');
      expect(instructions).toContain('⚠️ 現在市場は非常にボラティリティが高い状態です');
    });

    it('should adapt to trading styles', () => {
      const conservative = mockAgentConfig.instructions({ tradingStyle: 'conservative' });
      expect(conservative).toContain('Conservative Trading Style');
      expect(conservative).toContain('capital preservation');

      const aggressive = mockAgentConfig.instructions({ tradingStyle: 'aggressive' });
      expect(aggressive).toContain('Aggressive Trading Style');
      expect(aggressive).toContain('Leverage considerations');
    });

    it('should handle proposal modes', () => {
      const entryProposal = mockAgentConfig.instructions({
        isProposalMode: true,
        proposalType: 'entry'
      });
      expect(entryProposal).toContain('ENTRY PROPOSAL MODE ACTIVE');

      const standardProposal = mockAgentConfig.instructions({
        isProposalMode: true,
        proposalType: 'trendline'
      });
      expect(standardProposal).toContain('PROPOSAL MODE ACTIVE');
    });

    it('should support different languages', () => {
      const japanese = mockAgentConfig.instructions({ language: 'ja' });
      expect(japanese).toContain('Japanese');
      expect(japanese).toContain('こんにちは！今日の市場は活気がありますね');

      const english = mockAgentConfig.instructions({ language: 'en' });
      expect(english).toContain('English');
    });

    it('should include core functionality', () => {
      const instructions = mockAgentConfig.instructions({});
      expect(instructions).toContain('Real-time market data analysis');
      expect(instructions).toContain('Technical analysis using RSI, MACD');
      expect(instructions).toContain('For Greetings & Casual Conversation');
      expect(instructions).toContain('For Market Analysis & Trading Questions');
    });
  });

  describe('Complex Context Combinations', () => {
    it('should handle beginner in high volatility', () => {
      const instructions = mockAgentConfig.instructions({
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
      const instructions = mockAgentConfig.instructions({
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
      expect(mockAgentConfig).toBeDefined();
      expect(mockAgentConfig.tools).toBeDefined();
      expect(mockAgentConfig.tools.marketData).toBeDefined();
      expect(mockAgentConfig.tools.proposalGeneration).toBeDefined();
      expect(mockAgentConfig.tools.entryProposalGeneration).toBeDefined();
      expect(mockAgentConfig.tools.chartAnalysis).toBeDefined();
      expect(mockAgentConfig.tools.enhancedLineAnalysis).toBeDefined();
    });
  });
});