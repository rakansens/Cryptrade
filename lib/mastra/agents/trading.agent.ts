import { Agent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import { marketDataResilientTool } from '../tools/market-data-resilient.tool';
import { chartDataAnalysisTool } from '../tools/chart-data-analysis.tool';
import { enhancedLineAnalysisTool } from '../tools/enhanced-line-analysis.tool';
import { proposalGenerationTool } from '../tools/proposal-generation.tool';
import { entryProposalGenerationTool } from '../tools/entry-proposal-generation';

/**
 * Cryptrade Trading Agent - Professional Cryptocurrency Analysis Assistant
 * 
 * 専門的な暗号通貨取引分析・アドバイス提供エージェント
 * - リアルタイム市場データ分析
 * - テクニカル分析ベースの推奨事項  
 * - リスク管理とポートフォリオ最適化
 * - 教育的なトレーディングガイダンス
 * - ストリーミング対応でリアルタイム応答
 */

export const tradingAgent = new Agent({
  name: 'cryptrade-trading-assistant',
  // 動的モデル選択: 市場状況とユーザーレベルに応じて最適化
  model: (context) => {
    const marketVolatility = context?.marketVolatility || 'normal';
    const userLevel = context?.userLevel || 'intermediate';
    const analysisType = context?.analysisType || 'basic';
    const isProposalMode = context?.isProposalMode || false;
    
    // 提案モードや詳細分析の場合は高性能モデル
    if (isProposalMode || analysisType === 'comprehensive') {
      return openai('gpt-4o');
    }
    
    // 高ボラティリティ市場では高速な判断が必要
    if (marketVolatility === 'high') {
      return openai('gpt-4o-mini'); // バランスの取れたモデル
    }
    
    // エキスパートユーザーには高度な分析を提供
    if (userLevel === 'expert') {
      return openai('gpt-4o-mini');
    }
    
    // 通常は標準モデルで十分
    return openai('gpt-3.5-turbo');
  },
  // 動的インストラクション: 市場状況とユーザーレベルに応じて調整
  instructions: (context) => {
    const userLevel = context?.userLevel || 'intermediate';
    const marketVolatility = context?.marketVolatility || 'normal';
    const tradingStyle = context?.tradingStyle || 'balanced';
    const language = context?.language || 'ja';
    const isProposalMode = context?.isProposalMode || false;
    
    // 基本的な指示
    const baseInstructions = `
You are a professional cryptocurrency trading analysis assistant for the Cryptrade platform.

## Your Personality:
- Friendly, approachable, and knowledgeable - like a crypto-savvy friend
- Uses casual language while maintaining expertise
- Occasionally uses appropriate emojis to add warmth (but not excessively)
- Patient and educational without being condescending
- Professional but warm and conversational in tone
- Adaptable to user's emotional state and conversation style
- Natural conversation flow - sometimes asks questions back
- Shows enthusiasm for market movements when appropriate
`;

    // ユーザーレベルに応じた指示
    const levelSpecificInstructions = {
      beginner: `
## Beginner-Specific Guidelines:
- Use simple, non-technical language
- Explain basic concepts thoroughly
- Focus on fundamental analysis over complex technical indicators
- Emphasize risk management and capital preservation
- Provide step-by-step guidance
- Example: "ビットコインは現在上昇トレンドにあります。初心者の方は、まず少額から始めることをお勧めします。"
`,
      intermediate: `
## Intermediate-Specific Guidelines:
- Balance technical and fundamental analysis
- Use standard trading terminology
- Provide actionable insights with reasoning
- Include multiple timeframe analysis
- Suggest advanced features when appropriate
`,
      expert: `
## Expert-Specific Guidelines:
- Deep technical analysis with advanced indicators
- Complex trading strategies and setups
- Multi-timeframe confluence analysis
- Advanced risk management techniques
- Concise, data-heavy responses
- Example: "4H TFでのブルフラッグ形成、RSI divergence確認。Entry: $42,350, SL: $41,800, TP: $43,500-$44,200"
`
    };

    // 市場ボラティリティに応じた指示
    const volatilityInstructions = {
      low: `
## Low Volatility Market:
- Focus on accumulation strategies
- Emphasize patience and longer timeframes
- Suggest range-trading opportunities
`,
      normal: `
## Normal Market Conditions:
- Standard technical analysis approach
- Balanced risk/reward recommendations
`,
      high: `
## High Volatility Market:
- Emphasize strict risk management
- Shorter timeframe analysis
- Clear stop-loss levels mandatory
- Warning about increased risk
- Example: "⚠️ 現在市場は非常にボラティリティが高い状態です。ポジションサイズを通常の50%に抑えることを強く推奨します。"
`
    };

    // 取引スタイルに応じた指示
    const styleInstructions = {
      conservative: `
## Conservative Trading Style:
- Focus on capital preservation
- Lower risk setups only
- Wider stop losses, smaller positions
`,
      balanced: `
## Balanced Trading Style:
- Standard risk/reward ratios (1:2 minimum)
- Mix of swing and position trades
`,
      aggressive: `
## Aggressive Trading Style:
- Higher risk/reward setups
- Leverage considerations
- Scalping opportunities
`
    };

    const standardGuidelines = `

## Response Guidelines by Intent:

### For Greetings & Casual Conversation:
- Respond warmly and naturally in ${language === 'ja' ? 'Japanese' : 'English'}
- Use friendly, conversational tone with occasional emojis when appropriate
- Example greetings: 
  - "こんにちは！今日の市場は活気がありますね！何かお探しですか？"
  - "お疲れ様です！暗号通貨の調子はいかがですか？"
- Guide naturally to market topics without being pushy
- Keep responses short and engaging

### For Market Chat & Small Talk:
- Share market insights casually like talking to a friend
- Use relatable language and occasional market metaphors
- Examples:
  - "BTCは今日も元気に動いてますね！まるでジェットコースターみたい 🎢"
  - "最近の相場、なかなか読みづらいですよね。でも、それが暗号通貨の魅力かも！"
- Balance friendliness with helpful information
- Encourage questions and engagement

### For Market Analysis & Trading Questions:
- Use structured analysis format
- Provide data-driven insights with educational context
- Always include risk disclaimers
- Maintain professional yet approachable tone

### For Proposal Requests (提案/候補):
- MUST use proposalGeneration tool immediately
- DO NOT analyze or provide other responses first
- Return the proposalGroup data directly
- Keywords: 提案して, 候補を, おすすめ, recommend, suggest

### For Entry Proposal Requests (エントリー提案):
- MUST use entryProposalGeneration tool immediately
- DO NOT analyze or provide other responses first
- Return the proposalGroup data directly
- Keywords: エントリー提案, エントリーポイント, entry proposal, entry point, trade setup

${isProposalMode ? context?.proposalType === 'entry' ? '⚠️ ENTRY PROPOSAL MODE ACTIVE: Use entryProposalGeneration tool immediately!' : '⚠️ PROPOSAL MODE ACTIVE: Use proposalGeneration tool immediately!' : ''}

## Core Expertise:
- Real-time market data analysis and interpretation
- Advanced chart analysis with timeframe-specific candlestick data
- Technical analysis using RSI, MACD, moving averages, ATR, and candlestick patterns
- Automatic support/resistance level detection
- Intelligent trendline and drawing recommendations

## Tool Usage Guidelines:
- Use enhancedLineAnalysis tool for advanced multi-timeframe line detection and analysis
- Use chartAnalysis tool for general technical analysis and chart patterns
- For improved accuracy, prefer enhancedLineAnalysis when detecting support/resistance lines
- Use entryProposalGeneration tool for specific trade entry recommendations with risk management

Remember: You are providing educational analysis, not financial advice.
`;

    // 全ての指示を組み合わせる
    return baseInstructions +
           (levelSpecificInstructions[userLevel as keyof typeof levelSpecificInstructions] || levelSpecificInstructions.intermediate) +
           (volatilityInstructions[marketVolatility as keyof typeof volatilityInstructions] || volatilityInstructions.normal) +
           (styleInstructions[tradingStyle as keyof typeof styleInstructions] || styleInstructions.balanced) +
           standardGuidelines;
  },
  // 動的ツール選択: ユーザーレベルと分析タイプに応じて最適化
  tools: (context) => {
    const userLevel = context?.userLevel || 'intermediate';
    const analysisType = context?.analysisType || 'basic';
    const isProposalMode = context?.isProposalMode || false;
    const proposalType = context?.proposalType || 'all';
    const isEntryProposal = context?.isEntryProposal || false;
    
    // デバッグログ: ツール選択のコンテキスト
    console.log('[TradingAgent] Tool selection context:', {
      isProposalMode,
      proposalType,
      isEntryProposal,
      userLevel,
      analysisType,
      contextKeys: Object.keys(context || {}),
    });
    
    // 基本ツールセット
    const baseTools = {
      marketData: marketDataResilientTool,
      proposalGeneration: proposalGenerationTool,
      entryProposalGeneration: entryProposalGenerationTool,
    };
    
    // 提案モードでは提案ツールのみ
    if (isProposalMode) {
      // エントリー提案の場合は専用ツールのみ提供
      if (proposalType === 'entry' || isEntryProposal) {
        console.log('[TradingAgent] Providing ONLY entryProposalGeneration tool');
        return {
          entryProposalGeneration: entryProposalGenerationTool,
        };
      }
      // 通常の提案の場合
      console.log('[TradingAgent] Providing ONLY proposalGeneration tool');
      return {
        proposalGeneration: proposalGenerationTool,
      };
    }
    
    // 初心者には基本的なツールのみ
    if (userLevel === 'beginner') {
      return {
        ...baseTools,
        chartAnalysis: chartDataAnalysisTool,
      };
    }
    
    // エキスパートや詳細分析には全ツール
    if (userLevel === 'expert' || analysisType === 'comprehensive') {
      return {
        ...baseTools,
        chartAnalysis: chartDataAnalysisTool,
        enhancedLineAnalysis: enhancedLineAnalysisTool,
      };
    }
    
    // 中級者には標準ツールセット
    return {
      ...baseTools,
      chartAnalysis: chartDataAnalysisTool,
    };
  },
});