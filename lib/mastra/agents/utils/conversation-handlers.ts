// Conversation Handler Utilities for Orchestrator Agent
// 🟢 Green phase implementation - handleConversation function

/**
 * Handle conversation processing and AI response generation
 * Extracted from orchestrator.agent.ts (lines 728-829)
 */
export async function handleConversation(
  mockResult: any,
  sessionId: string
): Promise<{ response: string; metadata: any }> {
  console.log('🗣️ Processing conversation:', { mockResult, sessionId });
  
  try {
    const metadata = {
      sessionId,
      timestamp: new Date().toISOString(),
      processedBy: 'conversation-handler'
    };

    // Handle error cases
    if (mockResult.object === 'error' || !mockResult.response) {
      return {
        response: 'エラーが発生しましたが、処理を継続します。',
        metadata: { ...metadata, ...mockResult.metadata, error: true }
      };
    }

    // Extract response text
    let responseText = mockResult.response;
    if (typeof responseText !== 'string') {
      responseText = String(responseText);
    }

    // Clean and process response
    const cleanedResponse = responseText.trim();
    
    return {
      response: cleanedResponse,
      metadata: { ...metadata, ...mockResult.metadata }
    };
    
  } catch (error) {
    console.error('❌ Conversation handling failed:', error);
    return {
      response: 'システムエラーが発生しました。',
      metadata: {
        sessionId,
        timestamp: new Date().toISOString(),
        processedBy: 'conversation-handler',
        error: true,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Generate AI response for conversation
 * Internal helper function for conversation processing
 */
// async function generateConversationResponse(
//   userQuery: string
// ): Promise<string> {
//
//   // Check for simple greetings
//   if (/^(こんにちは|hello|hi|おはよう|こんばんは)$/i.test(userQuery.trim())) {
//     return "こんにちは！暗号通貨に関するご質問やチャート分析のご依頼がございましたら、お気軽にお声かけください。";
//   }
//
//   // Check for help requests
//   if (/^(ヘルプ|help|使い方|機能)$/i.test(userQuery.trim())) {
//     return `以下のような機能をご利用いただけます：
//
// 🔍 **価格照会**: 「BTCの価格は？」
// 📊 **チャート表示**: 「ETHのチャートを表示して」
// 📈 **市場分析**: 「DOGEの分析をお願いします」
// 💡 **投資提案**: 「エントリーポイントを教えて」
//
// 何かご質問がございましたら、お気軽にお声かけください。`;
//   }
//
//   // Check for price inquiries
//   if (/\b(価格|いくら|price)\b/i.test(userQuery)) {
//     const symbol = extractCryptoSymbol(userQuery);
//     if (symbol) {
//       return `${symbol}の最新価格情報を取得しています。しばらくお待ちください...`;
//     } else {
//       return "価格照会をご希望の暗号通貨名をお教えください（例：BTC、ETH、DOGE）";
//     }
//   }
//
//   // Check for chart requests
//   if (/\b(チャート|chart|グラフ|表示)\b/i.test(userQuery)) {
//     const symbol = extractCryptoSymbol(userQuery);
//     if (symbol) {
//       return `${symbol}のチャートを表示します。分析結果も含めてご提供いたします。`;
//     } else {
//       return "チャート表示をご希望の暗号通貨名をお教えください（例：BTC、ETH、DOGE）";
//     }
//   }
//
//   // Generic response for other queries
//   return `ご質問を承りました：「${userQuery}」
//
// 現在この内容について分析中です。より具体的なご要望がございましたら、以下のような形でお聞かせください：
// - 「BTCの価格を教えて」
// - 「ETHのチャートを表示して」
// - 「DOGEの分析をお願いします」`;
// }

/**
 * Extract cryptocurrency symbol from user query
 * Helper function for conversation processing
 */
// function extractCryptoSymbol(query: string): string | null {
//   const cryptoPatterns = [
//     /\b(BTC|bitcoin|ビットコイン)\b/i,
//     /\b(ETH|ethereum|イーサリアム)\b/i,
//     /\b(DOGE|dogecoin|ドージコイン)\b/i,
//     /\b(ADA|cardano|カルダノ)\b/i,
//     /\b(SOL|solana|ソラナ)\b/i,
//   ];
//
//   const symbolMap: Record<string, string> = {
//     'bitcoin': 'BTC',
//     'ビットコイン': 'BTC',
//     'ethereum': 'ETH',
//     'イーサリアム': 'ETH',
//     'dogecoin': 'DOGE',
//     'ドージコイン': 'DOGE',
//     'cardano': 'ADA',
//     'カルダノ': 'ADA',
//     'solana': 'SOL',
//     'ソラナ': 'SOL',
//   };
//
//   for (const pattern of cryptoPatterns) {
//     const match = query.match(pattern);
//     if (match && match[1]) {
//       const matched = match[1].toLowerCase();
//       return symbolMap[matched] || matched.toUpperCase();
//     }
//   }
//
//   return null;
// }