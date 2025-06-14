/**
 * Unified Intent Analysis System
 * 
 * 統一された意図分析ロジック
 * classifyUserIntent と analyzeUserIntent を統合
 */

export type UserIntent = 
  | 'price_inquiry'      // 価格照会
  | 'ui_control'         // UI操作・描画
  | 'trading_analysis'   // 取引分析
  | 'conversational'     // 一般会話
  | 'greeting'          // 挨拶
  | 'help_request'      // ヘルプ
  | 'proposal_request'   // 提案リクエスト
  | 'market_chat'       // 市場雑談
  | 'small_talk';       // 雑談

export interface IntentAnalysisResult {
  intent: UserIntent;
  confidence: number;
  extractedSymbol?: string;
  reasoning: string;
  analysisDepth: 'basic' | 'detailed' | 'comprehensive';
  requiresWorkflow?: boolean;
  suggestedResponse?: string;
  isProposalMode?: boolean;  // 提案モードかどうか
  proposalType?: 'trendline' | 'support-resistance' | 'fibonacci' | 'pattern' | 'all' | 'entry';  // 提案タイプ
  conversationMode?: 'formal' | 'casual' | 'friendly';  // 会話モード
  emotionalTone?: 'positive' | 'neutral' | 'concerned' | 'excited';  // 感情トーン
  isEntryProposal?: boolean;  // エントリー提案かどうか
}

/**
 * 統一された意図分析関数
 * Orchestratorとその他のコンポーネントで共通利用
 */
export function analyzeIntent(userQuery: string): IntentAnalysisResult {
  const queryLower = userQuery.toLowerCase().trim();
  
  // 0. 短すぎる入力のチェック（特定のキーワードは除外）
  const shortInputExceptions = /^(hi|ok|はい|いえ|yes|no|分析|価格|値段)$/i;
  if (userQuery.trim().length <= 2 && !shortInputExceptions.test(userQuery.trim())) {
    return {
      intent: 'conversational',
      confidence: 0.5,
      reasoning: '短い入力のため詳細不明',
      analysisDepth: 'basic',
      requiresWorkflow: true,
      suggestedResponse: '申し訳ございませんが、もう少し詳しく教えていただけますか？'
    };
  }
  
  // 1. エントリー提案の判定を最優先（価格照会より先にチェック）
  const entryProposalKeywords = ['エントリー提案', 'エントリーポイント', 'エントリー', 'entry', '売買', 'トレード', 'ポジション', 'テイクプロフィット', 'ストップロス'];
  const hasEntryKeyword = entryProposalKeywords.some(keyword => queryLower.includes(keyword.toLowerCase()));
  
  if (hasEntryKeyword && (queryLower.includes('提案') || queryLower.includes('suggest') || queryLower.includes('recommend') || queryLower.includes('おすすめ'))) {
    return {
      intent: 'proposal_request',  // 提案リクエストとして処理
      confidence: 0.95,
      reasoning: 'エントリー提案リクエスト検出',
      analysisDepth: 'comprehensive',
      extractedSymbol: extractSymbol(userQuery) || 'BTCUSDT',
      requiresWorkflow: true,
      isProposalMode: true,
      proposalType: 'entry',  // エントリー提案専用タイプ
      isEntryProposal: true,  // エントリー提案フラグ
      suggestedResponse: 'エントリー提案を生成します'
    };
  }
  
  // 2. UI操作・チャート切り替えの判定（価格照会より優先）
  const uiControlKeywords = [
    'チャート', '切り替え', '変更', '表示して', '見せて', 'にして',
    'switch', 'change', 'show', 'display'
  ];
  
  const chartSwitchPatterns = [
    /(.+)の?チャートに?切り替え/,
    /(.+)に?変更/,
    /チャートを(.+)に/,
    /(.+)を?表示/,
    /(.+)の?チャート/
  ];
  
  const hasUIKeyword = uiControlKeywords.some(keyword => queryLower.includes(keyword));
  const hasChartSwitchPattern = chartSwitchPatterns.some(pattern => pattern.test(queryLower));
  
  // 通貨シンボルと組み合わせたUI操作の判定
  const symbolWithUIAction = extractSymbol(userQuery) && (hasUIKeyword || hasChartSwitchPattern);
  
  if (symbolWithUIAction && !queryLower.includes('価格') && !queryLower.includes('いくら')) {
    return {
      intent: 'ui_control',
      confidence: 0.95,
      reasoning: 'UIチャート操作コマンド検出',
      analysisDepth: 'basic',
      extractedSymbol: extractSymbol(userQuery),
      requiresWorkflow: false
    };
  }
  
  // 3. 価格照会の判定（UI操作と分析を除外）
  const drawingKeywords = ['引いて', '描いて', 'トレンドライン', 'ライン', 'フィボナッチ', 'サポート', 'レジスタンス'];
  const hasDrawingKeyword = drawingKeywords.some(keyword => queryLower.includes(keyword));
  const priceAnalysisKeywords = ['将来性', '見通し', '買い時', '売り時', '投資', 'どう思う', '分析'];
  const hasAnalysisKeyword = priceAnalysisKeywords.some(keyword => queryLower.includes(keyword));
  
  if ((queryLower.includes('価格') || queryLower.includes('いくら') || queryLower.includes('値段') ||
      /btc|eth|ada|sol|usdt|price|コイン/i.test(queryLower)) && 
      !(hasAnalysisKeyword || queryLower.includes('変更') || queryLower.includes('描画') || 
        hasDrawingKeyword || queryLower.includes('提案') || hasUIKeyword)) {
    return {
      intent: 'price_inquiry',
      confidence: 0.9,
      reasoning: '価格照会キーワード検出',
      analysisDepth: 'basic',
      extractedSymbol: extractSymbol(userQuery),
      requiresWorkflow: false
    };
  }
  
  // 4. 提案リクエストの判定
  
  const proposalKeywords = [
    '提案', '候補', 'おすすめ', '推奨', 'どこに', 'suggest', 'recommend', 'proposal'
  ];
  
  const proposalDrawingKeywords = [
    'トレンドライン', 'ライン', '線', 'サポート', 'レジスタンス', 
    'trend', 'line', 'support', 'resistance'
  ];
  
  // 提案キーワードと描画キーワードの組み合わせをチェック
  const hasProposalKeyword = proposalKeywords.some(keyword => queryLower.includes(keyword.toLowerCase()));
  const hasProposalDrawingKeyword = proposalDrawingKeywords.some(keyword => queryLower.includes(keyword.toLowerCase()));
  
  if (hasProposalKeyword && hasProposalDrawingKeyword) {
    let proposalType: 'trendline' | 'support-resistance' | 'fibonacci' | 'pattern' | 'all' = 'all';
    
    if (queryLower.includes('トレンドライン') || queryLower.includes('trend')) {
      proposalType = 'trendline';
    } else if (queryLower.includes('サポート') || queryLower.includes('レジスタンス') || 
               queryLower.includes('support') || queryLower.includes('resistance')) {
      proposalType = 'support-resistance';
    } else if (queryLower.includes('フィボナッチ') || queryLower.includes('fibonacci')) {
      proposalType = 'fibonacci';
    } else if (queryLower.includes('パターン') || queryLower.includes('pattern')) {
      proposalType = 'pattern';
    }
    
    return {
      intent: 'proposal_request',
      confidence: 0.95,
      reasoning: '提案リクエストキーワード検出',
      analysisDepth: 'detailed',
      extractedSymbol: extractSymbol(userQuery),
      isProposalMode: true,
      proposalType: proposalType
    };
  }
  
  // 5. 描画・提案の判定（描画関連は提案モードとして優先処理）
  const drawingSpecificKeywords = [
    'トレンドライン', '引いて', '描いて', '描画',
    'フィボナッチ', 'サポート', 'レジスタンス', 'サポレジ',
    'trend', 'draw', 'fibonacci', 'support', 'resistance',
    // パターン認識キーワードを追加
    'パターン', 'pattern', 'ヘッドアンドショルダー', 'head and shoulders',
    'トライアングル', 'triangle', 'ダブルトップ', 'double top',
    'ダブルボトム', 'double bottom', 'フラッグ', 'flag', 'ペナント', 'pennant'
  ];
  
  // "線"と"ライン"は文脈によって判断が必要
  const contextualDrawingKeywords = ['ライン', '線', 'line'];
  
  const generalUIKeywords = [
    '変更', '切り替え', '時間足', '移動平均', 'インジケーター',
    'フィット', 'ズーム', 'チャート', '移動平均線', 'ボリンジャー', 'RSI', 'MACD'
  ];
  
  // サポート・レジスタンスと組み合わせた場合は描画として扱う
  const supportResistanceWithDisplay = (queryLower.includes('サポート') || queryLower.includes('レジスタンス')) && 
                                      queryLower.includes('表示');
  
  // 描画関連のキーワードが含まれている場合は自動的に提案モードに（優先判定）
  const hasSpecificDrawingKeyword = drawingSpecificKeywords.some(keyword => queryLower.includes(keyword.toLowerCase()));
  const hasContextualKeyword = contextualDrawingKeywords.some(keyword => queryLower.includes(keyword.toLowerCase()));
  
  // 明確な描画キーワードがある、または文脈的キーワードと描画アクションの組み合わせ、またはサポート・レジスタンスの表示
  if (hasSpecificDrawingKeyword || (hasContextualKeyword && !generalUIKeywords.some(k => queryLower.includes(k))) || supportResistanceWithDisplay) {
    let proposalType: 'trendline' | 'support-resistance' | 'fibonacci' | 'pattern' | 'all' = 'all';
    
    if (queryLower.includes('トレンドライン') || queryLower.includes('trend')) {
      proposalType = 'trendline';
    } else if (queryLower.includes('サポート') || queryLower.includes('レジスタンス') || 
               queryLower.includes('サポレジ') || queryLower.includes('support') || 
               queryLower.includes('resistance')) {
      proposalType = 'support-resistance';
    } else if (queryLower.includes('フィボナッチ') || queryLower.includes('fibonacci') || 
               queryLower.includes('フィボ')) {
      proposalType = 'fibonacci';
    } else if (queryLower.includes('パターン') || queryLower.includes('pattern') ||
               queryLower.includes('ヘッドアンドショルダー') || queryLower.includes('トライアングル') ||
               queryLower.includes('ダブルトップ') || queryLower.includes('ダブルボトム')) {
      proposalType = 'pattern';
    }
    
    return {
      intent: 'proposal_request',
      confidence: 0.95,
      reasoning: '描画コマンドを自動的に提案モードで処理',
      analysisDepth: 'detailed',
      extractedSymbol: extractSymbol(userQuery),
      isProposalMode: true,
      proposalType: proposalType
    };
  }
  
  // 6. 詳細分析の判定（拡張キーワード追加）
  const analysisKeywords = [
    '分析', 'テクニカル', '市場', '買う', '売る', '投資',
    '推奨', 'おすすめ', '戦略', 'リスク', '評価', 'レポート',
    // 追加キーワード
    '将来性', '見通し', '予想', '買い時', '売り時', 
    'どう思う', '判断', 'トレンド', '動向', '展望',
    'outlook', 'forecast', 'prediction', 'trend', 'analysis'
  ];
  
  if (analysisKeywords.some(keyword => queryLower.includes(keyword))) {
    return {
      intent: 'trading_analysis',
      confidence: 0.85,
      reasoning: '詳細分析キーワード検出',
      analysisDepth: determineAnalysisDepth(userQuery),
      extractedSymbol: extractSymbol(userQuery) || 'BTCUSDT',
      requiresWorkflow: true
    };
  }
  
  // 7. 挨拶の判定
  const greetingPatterns = [
    /^(こんにちは|おはよう|こんばんは|はじめまして|hello|hi|hey)\.?$/i,
    /^(お疲れ様|よろしく|どうも)\.?$/i
  ];
  
  if (greetingPatterns.some(pattern => pattern.test(queryLower))) {
    return {
      intent: 'greeting',
      confidence: 0.95,
      reasoning: '挨拶パターン検出',
      analysisDepth: 'basic',
      requiresWorkflow: true,
      suggestedResponse: 'こんにちは！暗号通貨取引についてお手伝いします。'
    };
  }
  
  // 8. ヘルプの判定
  if (queryLower.includes('ヘルプ') || queryLower.includes('使い方') || 
      queryLower.includes('help') || queryLower.includes('how')) {
    return {
      intent: 'help_request',
      confidence: 0.9,
      reasoning: 'ヘルプリクエスト検出',
      analysisDepth: 'basic',
      requiresWorkflow: false,
      suggestedResponse: generateHelpResponse()
    };
  }
  
  // 9. 市場雑談の判定
  const marketChatKeywords = [
    '最近', 'どう', '調子', '相場', '市場', '今日', '昨日', '明日',
    'ビットコイン', 'イーサリアム', '暗号通貨', '仮想通貨', 'クリプト',
    '上がり', '下がり', '動き', 'トレンド', '傾向', '様子'
  ];
  
  const casualMarketPhrases = [
    /最近.*どう/i,
    /調子.*どう/i,
    /相場.*どう/i,
    /今日.*相場/i,
    /市場.*様子/i
  ];
  
  const hasMarketChatKeyword = marketChatKeywords.some(keyword => queryLower.includes(keyword));
  const hasCasualMarketPhrase = casualMarketPhrases.some(pattern => pattern.test(queryLower));
  
  if ((hasMarketChatKeyword && queryLower.length < 50) || hasCasualMarketPhrase) {
    return {
      intent: 'market_chat',
      confidence: 0.8,
      reasoning: '市場に関する気軽な会話',
      analysisDepth: 'basic',
      requiresWorkflow: true,
      conversationMode: 'casual',
      emotionalTone: detectEmotionalTone(userQuery)
    };
  }
  
  // 10. 雑談の判定
  const smallTalkKeywords = [
    '元気', 'げんき', '疲れ', 'つかれ', 'お疲れ', '大丈夫',
    'ありがとう', 'ありがと', 'すごい', 'いいね', 'そうだね',
    'そうなんだ', 'なるほど', 'わかった', 'わかりました', 'OK', 'ok'
  ];
  
  const emotionalPhrases = [
    /嬉しい|うれしい/i,
    /心配|しんぱい/i,
    /不安|ふあん/i,
    /期待|きたい/i,
    /悲しい|かなしい/i
  ];
  
  const hasSmallTalkKeyword = smallTalkKeywords.some(keyword => queryLower.includes(keyword));
  const hasEmotionalPhrase = emotionalPhrases.some(pattern => pattern.test(queryLower));
  
  if (hasSmallTalkKeyword || hasEmotionalPhrase || queryLower.length < 10) {
    return {
      intent: 'small_talk',
      confidence: 0.75,
      reasoning: '雑談や感情表現',
      analysisDepth: 'basic',
      requiresWorkflow: true,
      conversationMode: 'friendly',
      emotionalTone: detectEmotionalTone(userQuery)
    };
  }
  
  // 11. デフォルト: カジュアル会話
  return {
    intent: 'conversational',
    confidence: 0.6,
    reasoning: 'カジュアル会話と推定',
    analysisDepth: 'basic',
    requiresWorkflow: true,
    conversationMode: 'casual',
    emotionalTone: 'neutral'
  };
}

/**
 * シンボル抽出関数
 */
export function extractSymbol(query: string): string | undefined {
  const symbols = ['BTC', 'ETH', 'ADA', 'SOL', 'DOGE', 'XRP', 'DOT', 'LINK', 'UNI', 'AVAX', 'MATIC', 'LTC'];
  const queryUpper = query.toUpperCase();
  
  // 日本語の通貨名マッピング
  const japaneseCurrencyMap: Record<string, string> = {
    'ビットコイン': 'BTC',
    'イーサリアム': 'ETH',
    'イーサ': 'ETH',
    'エイダ': 'ADA',
    'カルダノ': 'ADA',
    'ソラナ': 'SOL',
    'ドージコイン': 'DOGE',
    'ドージ': 'DOGE',
    'リップル': 'XRP',
    'ポルカドット': 'DOT',
    'チェーンリンク': 'LINK',
    'ユニスワップ': 'UNI',
    'アバランチ': 'AVAX',
    'ポリゴン': 'MATIC',
    'マティック': 'MATIC',
    'ライトコイン': 'LTC'
  };
  
  // まず日本語の通貨名をチェック
  for (const [jaName, symbol] of Object.entries(japaneseCurrencyMap)) {
    if (query.includes(jaName)) {
      return symbol + 'USDT';
    }
  }
  
  // 英語のシンボルをチェック
  for (const symbol of symbols) {
    if (queryUpper.includes(symbol)) {
      return symbol + 'USDT';
    }
  }
  
  // More complex pattern matching
  const symbolMatch = query.match(/\b([A-Z]{2,5}(?:USDT?|BTC|ETH))\b/i);
  return symbolMatch ? symbolMatch[1].toUpperCase() : undefined;
}

/**
 * 分析深度決定関数
 */
export function determineAnalysisDepth(query: string): 'basic' | 'detailed' | 'comprehensive' {
  const queryLower = query.toLowerCase();
  
  const comprehensiveKeywords = ['詳しく', '詳細', '包括的', '戦略', '買うべき', '売るべき', 'comprehensive'];
  const detailedKeywords = ['分析', '解析', '調査', 'analysis', 'technical'];
  
  if (comprehensiveKeywords.some(keyword => queryLower.includes(keyword))) {
    return 'comprehensive';
  }
  
  if (detailedKeywords.some(keyword => queryLower.includes(keyword))) {
    return 'detailed';
  }
  
  return 'basic';
}

/**
 * 感情トーン検出関数
 */
export function detectEmotionalTone(query: string): 'positive' | 'neutral' | 'concerned' | 'excited' {
  const queryLower = query.toLowerCase();
  
  const positiveKeywords = [
    '嬉しい', 'うれしい', 'いいね', '良い', 'よい', 'すごい', 'すばらしい',
    '楽しい', 'たのしい', 'ありがとう', '期待', 'きたい', 'わくわく'
  ];
  
  const concernedKeywords = [
    '心配', 'しんぱい', '不安', 'ふあん', '怖い', 'こわい', '大丈夫',
    '悲しい', 'かなしい', '困った', 'こまった', '難しい', 'むずかしい'
  ];
  
  const excitedKeywords = [
    '！！', 'すごい！', 'やった', 'やばい', '最高', 'さいこう',
    '爆上げ', '急騰', 'moon', 'rocket', '🚀', '📈'
  ];
  
  // エキサイトな感情を優先的に検出
  if (excitedKeywords.some(keyword => queryLower.includes(keyword)) || query.includes('！！')) {
    return 'excited';
  }
  
  // 心配や懸念を検出
  if (concernedKeywords.some(keyword => queryLower.includes(keyword))) {
    return 'concerned';
  }
  
  // ポジティブな感情を検出
  if (positiveKeywords.some(keyword => queryLower.includes(keyword))) {
    return 'positive';
  }
  
  // デフォルトは中立
  return 'neutral';
}

/**
 * ヘルプレスポンス生成
 */
function generateHelpResponse(): string {
  return `**Cryptradeアシスタントの使い方**

🔍 **価格確認**
• 「BTCの価格は？」
• 「ETHUSDTの現在価格」

📊 **詳細分析**
• 「BTCを分析して」
• 「ETHの状況とリスクを教えて」

🎨 **チャート操作**
• 「トレンドラインを引いて」
• 「移動平均線を表示」

💡 **取引アドバイス**
• 「SOLを買うべき？」
• 「今の相場はどう？」

対応銘柄：BTC, ETH, SOL, ADA, XRP, DOT, DOGE, LTC, LINK, UNI, AVAX, MATIC などの主要USDT ペア
日本語での通貨名にも対応（ビットコイン、イーサリアム、リップル、ソラナなど）`;
}