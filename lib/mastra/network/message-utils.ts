import { logger } from '@/lib/utils/logger';
import {
  AGENT_IDS,
  SUPPORTED_SYMBOLS,
  isProposalContext,
  isConversationalContext,
  type A2AMessage,
  type ProcessQueryParams,
  type AgentContext,
} from '@/types';

/**
 * Format an A2A message into a prompt suitable for the target agent.
 */
export function formatMessageForAgent(message: A2AMessage): string {
  if (message.method === 'process_query' && message.params && 'query' in message.params) {
    const params = message.params as ProcessQueryParams;
    const query = params.query;
    const context: AgentContext = params.context || {} as AgentContext;

    let symbol = 'BTCUSDT';
    const queryUpper = query.toUpperCase();
    for (const s of SUPPORTED_SYMBOLS) {
      if (queryUpper.includes(s)) {
        symbol = `${s}USDT`;
        break;
      }
    }

    if (message.target === AGENT_IDS.TRADING_ANALYSIS && isProposalContext(context)) {
      logger.info('[AgentNetwork] Formatting message for proposal mode', {
        target: message.target,
        extractedSymbol: context.extractedSymbol,
        proposalType: context.proposalType,
        isEntryProposal: context.isEntryProposal,
      });

      if (context.proposalType === 'entry' || context.isEntryProposal) {
        return `
ユーザーのリクエスト: "${query}"

## エントリー提案モードの実行
以下のパラメータを使用してentryProposalGenerationを実行してください:

entryProposalGeneration({
  symbol: "${context.extractedSymbol || symbol}",
  interval: "${context.interval || '1h'}",
  strategyPreference: "dayTrading",
  riskPercentage: 1,
  maxProposals: 3
})

必須: 上記のツールを必ず実行し、proposalGroupを返してください。
        `.trim();
      }

      return `
ユーザーのリクエスト: "${query}"

## 提案モードの実行
以下のパラメータを使用してproposalGenerationを実行してください:

proposalGeneration({
  symbol: "${context.extractedSymbol || symbol}",
  interval: "${context.interval || '1h'}",
  analysisType: "${context.proposalType || 'trendline'}",
  maxProposals: 5
})

必須: 上記のツールを必ず実行し、proposalGroupを返してください。
      `.trim();
    }

    if (message.target === AGENT_IDS.CONVERSATIONAL && isConversationalContext(context)) {
      logger.info('[AgentNetwork] Formatting message for conversational mode', {
        target: message.target,
        conversationMode: context.conversationMode,
        emotionalTone: context.emotionalTone,
        relationshipLevel: context.relationshipLevel,
      });

      return `
ユーザーからのメッセージ: "${query}"

## コンテキスト情報:
- 会話モード: ${context.conversationMode || 'casual'}
- 感情トーン: ${context.emotionalTone || 'neutral'}
- 関係性レベル: ${context.relationshipLevel || 'new'}
- 最近の話題: ${context.memoryContext ? '会話履歴あり' : 'なし'}

## 応答ガイドライン:
1. 自然で親しみやすい口調で返答してください
2. ユーザーの感情に共感し、寄り添ってください
3. 適度に市場の話題を織り交ぜてください（押し付けずに）
4. 関係性レベルに応じて距離感を調整してください
5. 必要に応じてmarketSnapshotやtrendingTopicsツールを使用してください

重要: 定型文ではなく、文脈に応じた自然な応答を生成してください。
      `.trim();
    }

    if (message.target === AGENT_IDS.PRICE_INQUIRY) {
      return `
ユーザーの質問: "${query}"

対象シンボル: ${symbol}

## 実行手順（必須）:
1. まず最初に、marketDataResilientToolを使って価格データを取得する
   実行: marketDataResilientTool({ symbol: "${symbol}" })

2. ツールから返されたデータを確認する：
   - currentPrice（現在価格）
   - priceChangePercent24h（24時間変化率）

3. 取得したデータを使って応答する：
   "${symbol.replace('USDT', '')}の現在価格は $[currentPrice] です。24時間変化率は [priceChangePercent24h]% です。"

## 絶対ルール:
- ツールを使わずに価格を答えない
- 取得したcurrentPriceをそのまま使う（架空の価格は厳禁）
- 価格は必ず$表記（円換算しない）
      `.trim();
    }
  }

  return `
Agent-to-Agent Message:
From: ${message.source}
Method: ${message.method}
${message.params ? `Parameters: ${JSON.stringify(message.params, null, 2)}` : ''}

Please process this request and provide an appropriate response.
Use available tools when necessary to fulfill the request.
  `.trim();
}
