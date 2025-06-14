/**
 * Intent Definitions for Cryptrade AI System
 * 
 * 拡張可能な意図定義システム
 * - 新しい意図カテゴリの追加が容易
 * - エージェントマッピングの一元管理
 * - キーワードベースの分類ルール
 */

export enum IntentCategory {
  // 現在の意図
  PRICE_INQUIRY = 'price_inquiry',
  TRADING_ANALYSIS = 'trading_analysis',
  UI_CONTROL = 'ui_control',
  CONVERSATIONAL = 'conversational',
  
  // 将来の拡張用
  NEWS_LOOKUP = 'news_lookup',
  PORTFOLIO_CHECK = 'portfolio_check',
  ORDER_EXECUTION = 'order_execution',
  ALERT_MANAGEMENT = 'alert_management',
  EDUCATIONAL = 'educational',
}

export interface IntentDefinition {
  category: IntentCategory;
  agentId: string;
  keywords: string[];
  patterns: RegExp[];
  description: string;
  examples: string[];
  priority: number; // 優先度（高い方が優先）
}

export const INTENT_DEFINITIONS: IntentDefinition[] = [
  {
    category: IntentCategory.PRICE_INQUIRY,
    agentId: 'priceInquiryAgent',
    keywords: ['価格', 'price', 'いくら', 'how much', '値段', 'value', 'rate', 'レート'],
    patterns: [
      /(?:btc|eth|ada|sol|doge|xrp|dot|link|uni|avax|matic).*(?:価格|price)/i,
      /(?:価格|price).*(?:btc|eth|ada|sol|doge|xrp|dot|link|uni|avax|matic)/i,
      /\d+(?:ドル|円|usd|jpy|usdt)/i,
    ],
    description: '暗号通貨の現在価格や価格変動に関する質問',
    examples: [
      'BTCの価格は？',
      'ETHの現在価格を教えて',
      'ビットコインはいくら？',
    ],
    priority: 90,
  },
  
  {
    category: IntentCategory.UI_CONTROL,
    agentId: 'uiControlAgent',
    keywords: ['チャート', 'chart', '表示', 'display', '切り替え', 'switch', '変更', 'change', '描画', 'draw'],
    patterns: [
      /(?:1分|5分|15分|30分|1時間|4時間|日|週|月).*(?:足|チャート|chart)/i,
      /(?:移動平均|MA|RSI|MACD|ボリンジャー).*(?:表示|描画|追加)/i,
      /(?:トレンドライン|フィボナッチ|サポート|レジスタンス).*(?:引|描|追加)/i,
    ],
    description: 'チャートの表示設定やインジケーターの操作',
    examples: [
      '1時間足に変更して',
      '移動平均を表示して',
      'BTCのチャートに切り替えて',
    ],
    priority: 85,
  },
  
  {
    category: IntentCategory.TRADING_ANALYSIS,
    agentId: 'tradingAnalysisAgent',
    keywords: ['分析', 'analysis', '投資', 'investment', '取引', 'trading', '戦略', 'strategy', 'リスク', 'risk'],
    patterns: [
      /(?:技術|テクニカル|ファンダメンタル).*(?:分析|analysis)/i,
      /(?:買い|売り|ロング|ショート).*(?:タイミング|シグナル|サイン)/i,
      /(?:投資|取引).*(?:判断|アドバイス|推奨)/i,
    ],
    description: '取引分析、投資アドバイス、リスク評価',
    examples: [
      'BTCの投資判断を分析して',
      'ETHの技術的分析をお願い',
      '今週のトレード戦略は？',
    ],
    priority: 80,
  },
  
  {
    category: IntentCategory.NEWS_LOOKUP,
    agentId: 'newsAgent', // 将来実装
    keywords: ['ニュース', 'news', '最新', 'latest', '情報', 'information', 'アップデート', 'update'],
    patterns: [
      /(?:最新|latest|今日|today).*(?:ニュース|news)/i,
      /(?:規制|regulation|政策|policy).*(?:情報|ニュース)/i,
    ],
    description: '暗号通貨関連のニュースや最新情報',
    examples: [
      'BTCの最新ニュースは？',
      '今日の暗号通貨ニュース',
      '規制に関する情報',
    ],
    priority: 70,
  },
  
  {
    category: IntentCategory.PORTFOLIO_CHECK,
    agentId: 'portfolioAgent', // 将来実装
    keywords: ['ポートフォリオ', 'portfolio', '残高', 'balance', '資産', 'assets', '損益', 'pnl'],
    patterns: [
      /(?:ポートフォリオ|portfolio).*(?:確認|チェック|check)/i,
      /(?:残高|balance|資産|assets).*(?:確認|表示|show)/i,
    ],
    description: 'ポートフォリオの確認や資産管理',
    examples: [
      'ポートフォリオを確認',
      '現在の残高は？',
      '損益を表示して',
    ],
    priority: 75,
  },
  
  {
    category: IntentCategory.CONVERSATIONAL,
    agentId: 'orchestratorAgent',
    keywords: ['こんにちは', 'hello', 'ありがとう', 'thank', 'help', 'ヘルプ'],
    patterns: [
      /^(こんにちは|hello|hi|hey)/i,
      /^(ありがとう|thanks|thank you)/i,
      /^(さようなら|goodbye|bye)/i,
    ],
    description: '一般的な会話や挨拶',
    examples: [
      'こんにちは',
      'ありがとう',
      'どんなことができますか？',
    ],
    priority: 10, // 最低優先度
  },
];

/**
 * エージェントIDから意図カテゴリを逆引き
 */
export function getCategoryByAgentId(agentId: string): IntentCategory | null {
  const definition = INTENT_DEFINITIONS.find(def => def.agentId === agentId);
  return definition ? definition.category : null;
}

/**
 * 意図カテゴリからエージェントIDを取得
 */
export function getAgentIdByCategory(category: IntentCategory): string | null {
  const definition = INTENT_DEFINITIONS.find(def => def.category === category);
  return definition ? definition.agentId : null;
}

/**
 * キーワードベースの意図分類
 */
export function classifyIntentByKeywords(query: string): {
  category: IntentCategory;
  confidence: number;
  matchedKeywords: string[];
} | null {
  const queryLower = query.toLowerCase();
  let bestMatch: { definition: IntentDefinition; score: number; keywords: string[] } | null = null;

  for (const definition of INTENT_DEFINITIONS) {
    let score = 0;
    const matchedKeywords: string[] = [];

    // キーワードマッチング
    for (const keyword of definition.keywords) {
      if (queryLower.includes(keyword.toLowerCase())) {
        score += 10;
        matchedKeywords.push(keyword);
      }
    }

    // パターンマッチング
    for (const pattern of definition.patterns) {
      if (pattern.test(query)) {
        score += 15;
      }
    }

    // 優先度を考慮
    score += definition.priority / 10;

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { definition, score, keywords: matchedKeywords };
    }
  }

  if (bestMatch && bestMatch.score >= 10) {
    return {
      category: bestMatch.definition.category,
      confidence: Math.min(bestMatch.score / 100, 1.0),
      matchedKeywords: bestMatch.keywords,
    };
  }

  return null;
}

/**
 * 利用可能な意図カテゴリのリストを取得
 */
export function getAvailableIntents(): Array<{
  category: IntentCategory;
  agentId: string;
  description: string;
  examples: string[];
}> {
  return INTENT_DEFINITIONS
    .filter(def => def.agentId !== 'newsAgent' && def.agentId !== 'portfolioAgent') // 未実装を除外
    .map(def => ({
      category: def.category,
      agentId: def.agentId,
      description: def.description,
      examples: def.examples,
    }));
}