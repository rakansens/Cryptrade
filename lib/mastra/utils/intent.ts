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

  const detectors = [
    detectShortInput,
    detectGreeting,  // Greeting should be before small talk
    detectEntryProposal,
    detectUIControl,  // UI control should be before drawing proposal
    detectDrawingProposal,
    detectProposalRequest,
    detectPriceInquiry,
    detectHelpRequest,
    detectMarketChat,  // Market chat should be before trading analysis
    detectTradingAnalysis,  // Trading analysis after market chat to avoid false positives
    detectSmallTalk,  // Small talk should be last to catch remaining casual inputs
  ];

  for (const detector of detectors) {
    const result = detector(userQuery, queryLower);
    if (result) {
      return result;
    }
  }

  // For ambiguous inputs, return lower confidence
  const ambiguousPatterns = /^(えーと|これは|どうかな|うーん|んー|まあ|そう)$/i;
  if (ambiguousPatterns.test(userQuery.trim())) {
    return {
      intent: 'conversational',
      confidence: 0.3,
      reasoning: '曖昧な入力',
      analysisDepth: 'basic',
      requiresWorkflow: false,
      conversationMode: 'casual',
      emotionalTone: detectEmotionalTone(userQuery)
    };
  }
  
  // For partial matches that suggest some intent
  const partialMatchPatterns = /(どう|して|見せて|分析)/i;
  if (partialMatchPatterns.test(queryLower) && userQuery.length < 20) {
    return {
      intent: 'conversational',
      confidence: 0.65,
      reasoning: '部分的なマッチ',
      analysisDepth: 'basic',
      requiresWorkflow: true,
      conversationMode: 'casual',
      emotionalTone: detectEmotionalTone(userQuery)
    };
  }
  
  return {
    intent: 'conversational',
    confidence: 0.6,
    reasoning: 'カジュアル会話と推定',
    analysisDepth: 'basic',
    requiresWorkflow: true,
    conversationMode: 'casual',
    emotionalTone: detectEmotionalTone(userQuery)
  };
}


export function detectShortInput(userQuery: string, _queryLower: string): IntentAnalysisResult | null {
  // Handle empty input
  if (userQuery.trim() === '') {
    return {
      intent: 'conversational',
      confidence: 0.3,
      reasoning: '空の入力',
      analysisDepth: 'basic',
      requiresWorkflow: false,
      suggestedResponse: '何かお手伝いできることはありますか？'
    };
  }
  
  // Handle very short inputs (1-2 chars) but exclude some specific keywords
  const shortInputExceptions = /^(hi|ok|はい|いえ|yes|no|やあ|よ|yo)$/i;
  const analysisKeywords = /^(分析|価格|値段)$/i;
  
  if (userQuery.trim().length <= 2 && !shortInputExceptions.test(userQuery.trim()) && !analysisKeywords.test(userQuery.trim())) {
    return {
      intent: 'conversational',
      confidence: 0.5,
      reasoning: '短い入力のため詳細不明',
      analysisDepth: 'basic',
      requiresWorkflow: false,
      suggestedResponse: '申し訳ございませんが、もう少し詳しく教えていただけますか？'
    };
  }
  return null;
}

export function detectEntryProposal(userQuery: string, queryLower: string): IntentAnalysisResult | null {
  const entryProposalKeywords = ['エントリー提案', 'エントリーポイント', 'エントリー', 'entry', '売買', 'トレード', 'ポジション', 'テイクプロフィット', 'ストップロス'];
  const hasEntryKeyword = entryProposalKeywords.some(keyword => queryLower.includes(keyword.toLowerCase()));

  if (hasEntryKeyword && (queryLower.includes('提案') || queryLower.includes('suggest') || queryLower.includes('recommend') || queryLower.includes('おすすめ') || queryLower.includes('教えて'))) {
    return {
      intent: 'proposal_request',
      confidence: 0.95,
      reasoning: 'エントリー提案リクエスト検出',
      analysisDepth: 'comprehensive',
      extractedSymbol: extractSymbol(userQuery) || 'BTCUSDT',
      requiresWorkflow: true,
      isProposalMode: true,
      proposalType: 'entry',
      isEntryProposal: true,
      suggestedResponse: 'エントリー提案を生成します'
    };
  }
  return null;
}

export function detectUIControl(userQuery: string, queryLower: string): IntentAnalysisResult | null {
  const uiControlKeywords = [
    'チャート', '切り替え', '変更', '表示', '見せて', 'にして',
    'switch', 'change', 'show', 'display', 'sw', 'chg', 'disp', 'tf', 'zoom', 'ズーム',
    'ma', 'rsi', 'macd', 'bb', 'ind', '分足', '時間足', 'インジケーター', '追加', 'リセット'
  ];
  
  // Add drawing keywords for UI control
  const drawingUIKeywords = [
    'トレンドライン', 'ライン', '引いて', '描いて', '描画して',
    'フィボナッチ', 'サポート', 'レジスタンス',
    'trend', 'line', 'draw', 'fibonacci', 'support', 'resistance'
  ];

  const chartSwitchPatterns = [
    /(.+)の?チャートに?切り替え/,
    /(.+)に?変更/,
    /チャートを(.+)に/,
    /(.+)を?表示/,
    /(.+)の?チャート/,
    /チャート.*表示/,
    /価格チャート.*表示/,
    /\d+分足に?変更/,
    /BTC価格チャート/,  // Specific pattern for "BTC価格チャート"
    /(BTC|ETH|\w+)価格チャート/  // Pattern for symbol + 価格チャート
  ];

  // Check for specific UI control phrases including drawing commands
  const specificUIPatterns = [
    /チャートを(.+)に変更/,
    /移動平均線を表示/,
    /フィボナッチを引いて/,
    /トレンドライン.*引いて/,
    /ライン.*描画して/,
    /trend\s*line.*描いて/i,
    /draw.*line/i,
    /フィボナッチ.*表示して/,
    /サポートライン.*表示/,
    /レジスタンスライン.*表示/,
    /サポート.*レジスタンス.*表示/,
    /サポレジ.*表示/,
    /チャート.*フィット/,
    /ズーム.*イン/,
    /(.+)時間足に切り替え/,
    /価格チャート.*表示/  // Added specific pattern for "価格チャートを表示"
  ];

  const hasUIKeyword = uiControlKeywords.some(keyword => queryLower.includes(keyword));
  const hasDrawingUIKeyword = drawingUIKeywords.some(keyword => queryLower.includes(keyword));
  const hasChartSwitchPattern = chartSwitchPatterns.some(pattern => pattern.test(queryLower));
  const hasSpecificUIPattern = specificUIPatterns.some(pattern => pattern.test(queryLower));
  
  // Check for timeframe changes (e.g., "15分足に変更")
  const hasTimeframeChange = /\d+(分|時間)足|日足|週足|月足|\d+[mhMH]|\d+min|\d+hour|tf.*\d/i.test(queryLower);
  
  // Check for indicator commands (e.g., "MAを表示")
  const hasIndicatorCommand = /(MA|RSI|MACD|BB|移動平均|ボリンジャー).*(表示|描画|出して|見せて)/i.test(queryLower);
  
  // Check if this is a drawing command with a crypto symbol - treat as proposal
  const hasCryptoSymbol = extractSymbol(userQuery) !== undefined;
  if (hasDrawingUIKeyword && hasCryptoSymbol && 
      (queryLower.includes('サポートライン') || queryLower.includes('レジスタンスライン') || 
       queryLower.includes('トレンドライン')) &&
      !queryLower.includes('引いて') && !queryLower.includes('描いて') && !queryLower.includes('draw')) {
    // This should be handled as a proposal request, not UI control
    return null;
  }
  
  // Check if this is actually a trading analysis request
  if ((queryLower.includes('rsi') && queryLower.includes('見')) ||
      (queryLower.includes('サポート') && queryLower.includes('レジスタンス') && !queryLower.includes('引') && !queryLower.includes('表示')) ||
      (queryLower.includes('トレンド分析') && !queryLower.includes('引いて') && !queryLower.includes('描いて'))) {
    // These should be handled as trading analysis, not UI control
    return null;
  }
  
  // More lenient UI control detection - don't require symbol for UI commands
  if ((hasUIKeyword || hasDrawingUIKeyword || hasChartSwitchPattern || hasSpecificUIPattern || hasTimeframeChange || hasIndicatorCommand) && 
      !queryLower.includes('価格') && !queryLower.includes('いくら') &&
      !queryLower.includes('提案') && !queryLower.includes('おすすめ') &&
      !queryLower.includes('候補') && !queryLower.includes('推奨')) {
    
    const symbol = extractSymbol(userQuery);
    const result: IntentAnalysisResult = {
      intent: 'ui_control',
      confidence: 0.95,
      reasoning: 'UI操作・描画コマンド検出',
      analysisDepth: 'basic',
      requiresWorkflow: true
    };
    if (symbol) {
      result.extractedSymbol = symbol;
    }
    return result;
  }
  return null;
}

export function detectPriceInquiry(userQuery: string, queryLower: string): IntentAnalysisResult | null {
  const drawingKeywords = ['引いて', '描いて', 'トレンドライン', 'ライン', 'フィボナッチ', 'サポート', 'レジスタンス'];
  const hasDrawingKeyword = drawingKeywords.some(keyword => queryLower.includes(keyword));
  const priceAnalysisKeywords = ['将来性', '見通し', '買い時', '売り時', '投資', 'どう思う', '分析'];
  const hasAnalysisKeyword = priceAnalysisKeywords.some(keyword => queryLower.includes(keyword));
  const hasUIKeyword = ['チャート', '切り替え', '変更', '表示して', '見せて', 'にして', 'switch', 'change', 'show', 'display', 'sw', 'chg', 'disp', 'tf', 'zoom', 'ズーム'].some(keyword => queryLower.includes(keyword));

  // More specific price inquiry patterns (including multilingual)
  const specificPricePatterns = [
    /(.+)(の)?価格(は)?[?？]?$/,
    /(.+)(は)?いくら[?？]?$/,
    /(.+)(の)?値段/,
    /(.+)(の)?現在値/,
    /(.+)(の)?相場(は)?[?？]?$/,  // Added "相場"
    /現在の(.+)価格/,
    /what.*price/i,
    /how much.*(?:btc|eth|bitcoin|ethereum)/i,
    /bitcoin\s*price/i,
    /\b(btc|eth|xrp|bnb|sol|ada)\s*(quote|prc|price)/i,  // Added "quote" and "prc"
    /\bquote\s+(btc|eth|xrp|bnb|sol|ada)/i,  // Added "quote [symbol]"
    /cuál.*precio.*bitcoin/i,  // Spanish: "Cuál es el precio de Bitcoin?"
    /precio.*bitcoin/i,  // Spanish: "precio de bitcoin"
    /比特币.*价格/,  // Chinese: "比特币价格是多少？"
    /价格.*多少/,  // Chinese: "价格是多少"
  ];
  
  const hasSpecificPricePattern = specificPricePatterns.some(pattern => pattern.test(queryLower));
  const hasCryptoSymbol = /\b(btc|eth|bnb|ada|sol|usdt|xrp|doge|dot|link|uni|avax|matic|ltc|ビットコイン|イーサリアム|イーサ)\b/i.test(queryLower);
  
  // Special case: "チャートのビットコイン価格" should be price inquiry
  if (queryLower.includes('チャートの') && queryLower.includes('価格')) {
    const symbol = extractSymbol(userQuery);
    return {
      intent: 'price_inquiry',
      confidence: 0.9,
      reasoning: 'チャート上の価格確認',
      analysisDepth: 'basic',
      requiresWorkflow: true,
      extractedSymbol: symbol || 'BTCUSDT'
    };
  }
  
  // Only classify as price inquiry if it's really asking for price
  if ((hasSpecificPricePattern || (hasCryptoSymbol && (queryLower.includes('price') || queryLower.includes('価格') || queryLower.includes('いくら') || queryLower.includes('quote') || queryLower.includes('prc') || queryLower.includes('相場') || queryLower.includes('precio') || queryLower.includes('价格')))) &&
      !(hasAnalysisKeyword || queryLower.includes('変更') || queryLower.includes('描画') ||
        hasDrawingKeyword || queryLower.includes('提案') || hasUIKeyword || 
        (queryLower.includes('チャート') && queryLower.includes('表示')))) {
    const symbol = extractSymbol(userQuery);
    const result: IntentAnalysisResult = {
      intent: 'price_inquiry',
      confidence: 0.9,
      reasoning: '価格照会キーワード検出',
      analysisDepth: 'basic',
      requiresWorkflow: true
    };
    if (symbol) {
      result.extractedSymbol = symbol;
    }
    return result;
  }
  return null;
}

export function detectProposalRequest(userQuery: string, queryLower: string): IntentAnalysisResult | null {
  const proposalKeywords = [
    '提案', '候補', 'おすすめ', '推奨', 'どこに', 'suggest', 'recommend', 'proposal'
  ];

  const proposalDrawingKeywords = [
    'トレンドライン', 'ライン', '線', 'サポート', 'レジスタンス',
    'trend', 'line', 'support', 'resistance', 'パターン', 'pattern'
  ];

  const hasProposalKeyword = proposalKeywords.some(keyword => queryLower.includes(keyword.toLowerCase()));
  const hasProposalDrawingKeyword = proposalDrawingKeywords.some(keyword => queryLower.includes(keyword.toLowerCase()));
  
  // Check for analysis patterns that should not be proposals
  const analysisPatterns = [
    /サポート.*レジスタンス.*分析/,
    /サポート.*分析/,
    /レジスタンス.*分析/
  ];
  
  const isAnalysisRequest = analysisPatterns.some(pattern => pattern.test(queryLower));
  
  // If it's an analysis request with support/resistance, let it fall through to trading_analysis
  if (isAnalysisRequest) {
    return null;
  }

  // Skip if this is a clear UI control command (分析のために線を引く etc.)
  const uiActionPatterns = [
    /分析.*ため.*引いて/,
    /分析.*ため.*描いて/,
    /調べる.*ため.*引いて/
  ];
  
  if (uiActionPatterns.some(pattern => pattern.test(queryLower))) {
    return null;
  }
  
  // Special case: drawing lines with symbols should be treated as proposals
  const hasCryptoSymbol = extractSymbol(userQuery) !== undefined;
  if (hasCryptoSymbol && hasProposalDrawingKeyword && 
      (queryLower.includes('引いて') || queryLower.includes('描いて'))) {
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

    const symbol = extractSymbol(userQuery);
    const result: IntentAnalysisResult = {
      intent: 'proposal_request',
      confidence: 0.95,
      reasoning: '描画提案リクエスト検出',
      analysisDepth: 'detailed',
      requiresWorkflow: true,
      isProposalMode: true,
      proposalType,
      isEntryProposal: false
    };
    if (symbol) {
      result.extractedSymbol = symbol;
    }
    return result;
  }
  
  // More lenient proposal detection
  if (hasProposalKeyword && (hasProposalDrawingKeyword || queryLower.includes('ベース'))) {
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

    const symbol = extractSymbol(userQuery);
    const result: IntentAnalysisResult = {
      intent: 'proposal_request',
      confidence: 0.95,
      reasoning: '提案リクエストキーワード検出',
      analysisDepth: 'detailed',
      requiresWorkflow: true,
      isProposalMode: true,
      proposalType,
      isEntryProposal: false
    };
    if (symbol) {
      result.extractedSymbol = symbol;
    }
    return result;
  }
  return null;
}

export function detectDrawingProposal(userQuery: string, queryLower: string): IntentAnalysisResult | null {
  const drawingSpecificKeywords = [
    'トレンドライン', '引いて', '描いて', '描画',
    'フィボナッチ', 'サポート', 'レジスタンス', 'サポレジ',
    'trend', 'draw', 'fibonacci', 'support', 'resistance',
    'パターン', 'pattern', 'ヘッドアンドショルダー', 'head and shoulders',
    'トライアングル', 'triangle', 'ダブルトップ', 'double top',
    'ダブルボトム', 'double bottom', 'フラッグ', 'flag', 'ペナント', 'pennant'
  ];

  const contextualDrawingKeywords = ['ライン', '線', 'line'];

  const generalUIKeywords = [
    '変更', '切り替え', '時間足', '移動平均', 'インジケーター',
    'フィット', 'ズーム', 'チャート', '移動平均線', 'ボリンジャー', 'RSI', 'MACD'
  ];

  const supportResistanceWithDisplay = (queryLower.includes('サポート') || queryLower.includes('レジスタンス')) &&
                                      queryLower.includes('表示');

  const hasSpecificDrawingKeyword = drawingSpecificKeywords.some(keyword => queryLower.includes(keyword.toLowerCase()));
  const hasContextualKeyword = contextualDrawingKeywords.some(keyword => queryLower.includes(keyword.toLowerCase()));
  
  // Only classify as proposal if it has proposal keywords
  const proposalKeywords = ['提案', '候補', 'おすすめ', '推奨', 'どこに', 'suggest', 'recommend', 'proposal'];
  proposalKeywords.some(keyword => queryLower.includes(keyword));

  // Skip if there are no proposal keywords (let UI control handle pure drawing commands)
  const hasProposalKeyword = proposalKeywords.some(keyword => queryLower.includes(keyword));
  if (!hasProposalKeyword) {
    return null;
  }
  
  // For helper function compatibility: if called directly, detect drawing commands without proposal keywords
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

    const symbol = extractSymbol(userQuery);
    const result: IntentAnalysisResult = {
      intent: 'proposal_request',
      confidence: 0.95,
      reasoning: '描画コマンドを自動的に提案モードで処理',
      analysisDepth: 'detailed',
      isProposalMode: true,
      proposalType
    };
    if (symbol) {
      result.extractedSymbol = symbol;
    }
    return result;
  }
  return null;
}

export function detectTradingAnalysis(userQuery: string, queryLower: string): IntentAnalysisResult | null {
  const analysisKeywords = [
    '分析', 'テクニカル', '買う', '売る', '投資',
    '推奨', 'おすすめ', '戦略', 'リスク', '評価', 'レポート',
    '予想', '買い時', '売り時',
    '判断', '動向', '展望',
    'outlook', 'forecast', 'prediction', 'analysis',
    'ta', 'fa', 'entry', 'exit', 'tp', 'sl', '見解', '詳しく', '詳細',
    '買うべき', '売るべき', 'サポート', 'レジスタンス', 'トレンド', '教えて'
  ];

  // Check for explicit analysis requests
  const explicitAnalysisPatterns = [
    /(.+)を?分析/,
    /(.+)の?詳細な?分析/,
    /(.+)について?詳しく/,
    /(.+)の?状況を?詳しく/,
    /詳しく.*教えて/,
    /テクニカル分析/,
    /技術分析.*して/,
    /^技術分析をして$/,
    /分析を?して/,
    /分析を?お願い/,
    /RSI.*見/,
    /サポート.*レジスタンス/,
    /トレンド分析/,
    /^価格を教えて$/,
    /^値段を教えて$/
  ];

  const hasAnalysisKeyword = analysisKeywords.some(keyword => queryLower.includes(keyword));
  const hasExplicitPattern = explicitAnalysisPatterns.some(pattern => pattern.test(queryLower));

  if (hasAnalysisKeyword || hasExplicitPattern) {
    const symbol = extractSymbol(userQuery);
    
    // Adjust confidence based on query specificity
    let confidence = 0.85;
    if (queryLower.includes('なんか') || queryLower.includes('ちょっと')) {
      confidence = 0.7; // Lower confidence for vague requests
    }
    
    const result: IntentAnalysisResult = {
      intent: 'trading_analysis',
      confidence,
      reasoning: '詳細分析キーワード検出',
      analysisDepth: determineAnalysisDepth(userQuery),
      requiresWorkflow: true,
      emotionalTone: detectEmotionalTone(userQuery)
    };
    
    if (symbol) {
      result.extractedSymbol = symbol;
    }
    
    return result;
  }
  return null;
}

export function detectGreeting(userQuery: string, queryLower: string): IntentAnalysisResult | null {
  const greetingPatterns = [
    // Exact greeting patterns
    /^(こんにちは|おはよう|おはようございます|こんばんは|はじめまして|hello|hi|hey|yo|やあ|どうも)[!！]?\.?$/i,
    /^(よろしく)\.?$/i,
    /^hi\s+there$/i,
    // Greeting at the beginning of sentence followed by more text
    /^(こんにちは|おはよう|おはようございます|こんばんは|はじめまして|hello|hi|hey|yo|やあ|どうも)[!！、。]?[\s、。]?\S/i,
  ];
  
  // Use both original query and lowercase for pattern matching
  if (greetingPatterns.some(pattern => pattern.test(queryLower) || pattern.test(userQuery))) {
    return {
      intent: 'greeting',
      confidence: 0.95,
      reasoning: '挨拶パターン検出',
      analysisDepth: 'basic',
      requiresWorkflow: false,  // Greetings don't require workflow
      conversationMode: 'friendly',
      emotionalTone: 'positive',
      suggestedResponse: 'こんにちは！暗号通貨取引についてお手伝いします。'
    };
  }
  return null;
}

export function detectHelpRequest(_userQuery: string, queryLower: string): IntentAnalysisResult | null {
  if (queryLower.includes('ヘルプ') || queryLower.includes('使い方') ||
      queryLower.includes('help') || queryLower.includes('how') ||
      queryLower.includes('pls') || queryLower.includes('please help') || queryLower.includes('助けて')) {
    return {
      intent: 'help_request',
      confidence: 0.9,
      reasoning: 'ヘルプリクエスト検出',
      analysisDepth: 'basic',
      requiresWorkflow: false,
      suggestedResponse: generateHelpResponse()
    };
  }
  return null;
}

export function detectMarketChat(userQuery: string, queryLower: string): IntentAnalysisResult | null {
  const marketChatKeywords = [
    '最近', '調子', '相場', '市場',
    'ビットコイン', 'イーサリアム', '暗号通貨', '仮想通貨', 'クリプト',
    '上がり', '下がり', '上がって', '下がって', '動き', 'トレンド', '傾向', '様子',
    '将来性', '見通し'  // Add keywords that were causing false positives
  ];

  const casualMarketPhrases = [
    /最近.*どう/i,
    /調子.*どう/i,
    /相場.*どう/i,
    /今日.*相場/i,
    /市場.*様子/i,
    /市場.*どう/i,  // Added pattern for "最近の市場はどう？"
    /将来性.*どう思う/i,  // Added pattern for "ビットコインの将来性についてどう思う？"
    /今日.*(ビットコイン|イーサリアム|暗号|仮想|クリプト|相場|市場)/i,
    /昨日.*(ビットコイン|イーサリアム|暗号|仮想|クリプト|相場|市場)/i
  ];

  const hasMarketChatKeyword = marketChatKeywords.some(keyword => queryLower.includes(keyword));
  const hasCasualMarketPhrase = casualMarketPhrases.some(pattern => pattern.test(queryLower));

  // Check for casual conversation patterns
  const casualPatterns = /(どう？|どう思う|どうかな)/;
  const isCasualTone = casualPatterns.test(queryLower);

  // Skip if this is an analysis request
  if (queryLower.includes('分析') || queryLower.includes('分析して')) {
    return null;
  }

  if ((hasMarketChatKeyword && (queryLower.length < 50 || isCasualTone)) || hasCasualMarketPhrase) {
    return {
      intent: 'market_chat',
      confidence: 0.85,  // Increased confidence
      reasoning: '市場に関する気軽な会話',
      analysisDepth: 'basic',
      requiresWorkflow: false,  // Market chat doesn't require workflow
      conversationMode: 'casual',
      emotionalTone: detectEmotionalTone(userQuery)
    };
  }
  return null;
}

export function detectSmallTalk(userQuery: string, queryLower: string): IntentAnalysisResult | null {
  const smallTalkKeywords = [
    '元気', 'げんき', '疲れ', 'つかれ', 'お疲れ', '大丈夫',
    'ありがとう', 'ありがと', 'すごい', 'いいね', 'そうだね',
    'そうなんだ', 'なるほど', 'わかった', 'わかりました', 'OK', 'ok',
    'thx', 'はい', 'いえ', 'yes', 'no',
    '暑い', '寒い', '天気', '雨', '晴れ', '曇り'  // Added weather keywords
  ];

  const emotionalPhrases = [
    /嬉しい|うれしい/i,
    /心配|しんぱい/i,
    /不安|ふあん/i,
    /期待|きたい/i,
    /悲しい|かなしい/i
  ];

  const hasSmallTalkKeyword = smallTalkKeywords.some(keyword => queryLower.includes(keyword.toLowerCase()));
  const hasEmotionalPhrase = emotionalPhrases.some(pattern => pattern.test(queryLower));

  // Don't classify short inputs containing analysis/price/trading keywords as small talk
  const isTechnicalRelated = /価格|値段|いくら|現在値|price|分析|analysis|チャート|chart|提案|suggest/i.test(queryLower);
  
  // Special handling for very short price/value keywords
  if ((queryLower === '価格' || queryLower === '値段') && userQuery.length <= 2) {
    return {
      intent: 'small_talk',
      confidence: 0.85,
      reasoning: '雑談や感情表現',
      analysisDepth: 'basic',
      requiresWorkflow: false,
      conversationMode: 'friendly',
      emotionalTone: detectEmotionalTone(userQuery)
    };
  }
  
  // Only classify as small talk if it has specific keywords or emotional phrases
  if (hasSmallTalkKeyword || hasEmotionalPhrase) {
    if (!isTechnicalRelated) {
      return {
        intent: 'small_talk',
        confidence: 0.85,
        reasoning: '雑談や感情表現',
        analysisDepth: 'basic',
        requiresWorkflow: false,  // Small talk doesn't require workflow
        conversationMode: 'friendly',
        emotionalTone: detectEmotionalTone(userQuery)
      };
    }
  }
  return null;
}

/**
 * シンボル抽出関数
 */
export function extractSymbol(query: string): string | undefined {
  const symbols = [
    'BTC', 'ETH', 'BNB', 'ADA', 'SOL',
    'DOGE', 'XRP', 'DOT', 'LINK', 'UNI',
    'AVAX', 'MATIC', 'LTC'
  ];
  // Remove special characters but keep spaces and parentheses for proper detection
  const cleanQuery = query.replace(/[!！？?@#$%^&*_+=\[\]{};:'",.<>\/\\|`~]/g, ' ');
  const cleanQueryUpper = cleanQuery.toUpperCase();
  
  // 日本語の通貨名マッピング
  const japaneseCurrencyMap: Record<string, string> = {
    'ビットコイン': 'BTC',
    'イーサリアム': 'ETH',
    'イーサ': 'ETH',
    'バイナンスコイン': 'BNB',
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

  const englishCurrencyMap: Record<string, string> = {
    bitcoin: 'BTC',
    ethereum: 'ETH',
    'binance coin': 'BNB',
    binancecoin: 'BNB',
    cardano: 'ADA',
    solana: 'SOL',
    dogecoin: 'DOGE',
    ripple: 'XRP',
    polkadot: 'DOT',
    chainlink: 'LINK',
    uniswap: 'UNI',
    avalanche: 'AVAX',
    polygon: 'MATIC',
    litecoin: 'LTC'
  };
  
  // まず日本語の通貨名をチェック
  for (const [jaName, symbol] of Object.entries(japaneseCurrencyMap)) {
    if (query.includes(jaName)) {
      return symbol + 'USDT';
    }
  }

  // 英語の通貨名をチェック
  const queryLower = cleanQuery.toLowerCase();
  for (const [enName, symbol] of Object.entries(englishCurrencyMap)) {
    if (queryLower.includes(enName)) {
      return symbol + 'USDT';
    }
  }

  // 既にUSDTが付いているかチェック
  const usdtMatch = cleanQueryUpper.match(/\b([A-Z]{2,5})USDT\b/);
  if (usdtMatch && usdtMatch[1]) {
    return usdtMatch[0];
  }

  // Check for symbols in parentheses first (e.g., リップル（XRP）)
  const parenMatch = query.match(/[（(]([A-Z]{2,5})[）)]/);
  if (parenMatch && parenMatch[1]) {
    const symbolInParen = parenMatch[1].toUpperCase();
    if (symbols.includes(symbolInParen)) {
      return symbolInParen + 'USDT';
    }
  }
  
  // Check for pattern like "BTCについて" or "SOLの動き"
  const japanesePatternMatch = query.match(/([A-Z]{2,5})(?:について|の|を|が|は)/);
  if (japanesePatternMatch && japanesePatternMatch[1]) {
    const symbolMatch = japanesePatternMatch[1].toUpperCase();
    if (symbols.includes(symbolMatch)) {
      return symbolMatch + 'USDT';
    }
  }
  
  // 英語のシンボルをチェック（単語境界を考慮）
  for (const symbol of symbols) {
    const symbolRegex = new RegExp(`\\b${symbol}\\b`, 'i');
    if (symbolRegex.test(cleanQuery) || symbolRegex.test(query)) {
      return symbol + 'USDT';
    }
  }
  
  // More complex pattern matching
  const symbolMatch = cleanQuery.match(/\b([A-Z]{2,5}(?:USDT?|BTC|ETH))\b/i);
  if (symbolMatch && symbolMatch[1]) {
    const matched = symbolMatch[1].toUpperCase();
    // If already has USDT suffix, return as is
    if (matched.endsWith('USDT') || matched.endsWith('USD')) {
      return matched;
    }
    // Otherwise add USDT suffix
    return matched + 'USDT';
  }
  return undefined;
}

/**
 * 分析深度決定関数
 */
export function determineAnalysisDepth(query: string): 'basic' | 'detailed' | 'comprehensive' {
  const queryLower = query.toLowerCase();
  
  const comprehensiveKeywords = ['詳しく', '詳細', '包括的', '戦略', '買うべき', '売るべき', 'comprehensive', '技術分析', 'テクニカル分析'];
  const detailedKeywords = ['分析', '解析', '調査', 'analysis', 'technical', 'rsi', 'サポート', 'レジスタンス', 'トレンド'];
  
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
    '悲しい', 'かなしい', '困った', 'こまった', '難しい', 'むずかしい',
    'やばい', 'ヤバい', 'ヤバイ', '下がって'
  ];
  
  const excitedKeywords = [
    '！！', 'すごい！', 'やった', 'やばい', '最高', 'さいこう',
    '爆上げ', '急騰', 'moon', 'rocket', '🚀', '📈'
  ];
  
  // Context-based detection for ambiguous words like "やばい"
  if (queryLower.includes('やばい') || queryLower.includes('ヤバい') || queryLower.includes('ヤバイ')) {
    // Check context - if it includes negative indicators, it's concerned
    if (queryLower.includes('下が') || query.includes('...') || query.includes('。。。') || queryLower.includes('下がって')) {
      return 'concerned';
    }
    // Otherwise, check for positive indicators
    if (query.includes('！') || queryLower.includes('上が')) {
      return 'excited';
    }
  }
  
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