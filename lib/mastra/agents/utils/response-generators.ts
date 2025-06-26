// Response Generator Utilities for Orchestrator Agent
// 🟢 Green phase implementation - generateFallbackResponse function

/**
 * Generate a fallback response when agent execution fails
 * Extracted from orchestrator.agent.ts (lines 834-916)
 */
export async function generateFallbackResponse(
  intent: string,
  userQuery: string,
  extractedSymbol?: string
): Promise<{ response: string; metadata: any }> {
  console.log('🚨 Generating fallback response for:', { intent, userQuery, extractedSymbol });
  
  const metadata = {
    processedBy: 'fallback',
    intent,
    extractedSymbol,
    timestamp: new Date().toISOString()
  };

  // Handle price inquiry intent
  if (intent === 'price_inquiry') {
    return {
      response: `申し訳ございませんが、現在価格情報を取得できません。しばらくしてから再度お試しください。\n\n**対象シンボル**: ${extractedSymbol || '不明'}`,
      metadata
    };
  }
  
  // Handle chart-related queries
  if (intent === 'ui_control' || /チャート|chart|グラフ|表示/i.test(userQuery)) {
    return {
      response: `チャート表示に関するご要望を承りました。現在システムに問題が発生しており、チャート機能をご利用いただけません。\n\n**対処方法**:\n1. ページを再読み込みしてください\n2. しばらく時間を置いてから再度お試しください\n3. 問題が継続する場合はサポートまでお問い合わせください`,
      metadata
    };
  }
  
  // Handle analysis requests
  if (intent === 'trading_analysis' || /分析|analysis|解析|予測/i.test(userQuery)) {
    return {
      response: `市場分析に関するご質問をいただきありがとうございます。現在分析エンジンに問題が発生しており、詳細な分析結果をご提供できません。\n\n**一般的なアドバイス**:\n- 市場の変動には十分ご注意ください\n- 複数の情報源を参照することをお勧めします\n- リスク管理を最優先に投資判断を行ってください`,
      metadata
    };
  }
  
  // Generic fallback response for unknown intents
  return {
    response: `申し訳ございませんが、現在システムに問題が発生しており、ご質問にお答えできません。\n\n**ご不便をおかけして申し訳ございません**\n\n以下をお試しください：\n1. 質問内容を簡潔に言い換えてみてください\n2. しばらく時間を置いてから再度お試しください\n3. 問題が継続する場合は、サポートチームまでお問い合わせください\n\n**質問内容**: ${userQuery}`,
    metadata
  };
}