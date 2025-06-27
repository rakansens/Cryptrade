// Query Analyzer Utilities for Orchestrator Agent
// 🟢 Green phase implementation - detectComplexQuery function

/**
 * 暗号通貨シンボルの型定義
 */
export interface CryptoSymbol {
  base: string;
  quote: string;
  full: string;
}

/**
 * クエリ分析結果の型定義
 */
export interface QueryAnalysisResult {
  isComplex: boolean;
  reason: ComplexityReason[];
  symbols: CryptoSymbol[];
  operations: string[];
}

/**
 * 複雑性の理由を示す列挙型
 */
export enum ComplexityReason {
  LENGTH = 'length',
  MULTIPLE_OPERATIONS = 'multiple_operations',
  MULTIPLE_SYMBOLS = 'multiple_symbols',
  COMPLEX_KEYWORDS = 'complex_keywords',
  MULTIPLE_INFO_TYPES = 'multiple_info_types'
}

/**
 * 型ガード: 文字列が有効なクエリかチェック
 */
function isValidQuery(query: unknown): query is string {
  return typeof query === 'string' && query.trim().length > 0;
}

/**
 * 暗号通貨シンボルを安全に抽出
 */
function extractCryptoSymbols(query: string): CryptoSymbol[] {
  const symbolPattern = /([A-Z]{3,})(?:USDT)?/g;
  const matches = query.match(symbolPattern) || [];
  
  return matches.map(match => ({
    base: match.replace('USDT', ''),
    quote: match.includes('USDT') ? 'USDT' : '',
    full: match
  }));
}

/**
 * Detect if a query is complex and requires parallel processing
 * Extracted from orchestrator.agent.ts (lines 921-980)
 */
export function detectComplexQuery(userQuery: unknown): boolean {
  if (!isValidQuery(userQuery)) {
    return false;
  }
  // --------------------------------------------------------------------------------
  // 0. Quick check – simple price inquiry queries are NOT complex.
  if (/\b(価格|いくら|price)\b/i.test(userQuery) && userQuery.length < 50) {
    return false;
  }

  // 1. Length-based detection
  if (userQuery.length > 70) {
    return true;
  }
  
  // 2. Multiple operations detection
  const multipleOperations = 
    (userQuery.includes('して') && (userQuery.match(/して/g) || []).length > 1) ||
    (userQuery.includes('また') || userQuery.includes('そして') || userQuery.includes('さらに'));
  
  if (multipleOperations) {
    return true;
  }
  
  // 3. Multiple symbols detection
  const cryptoSymbols = extractCryptoSymbols(userQuery);
  if (cryptoSymbols.length > 1) {
    return true;
  }
  
  // 4. Complex intent keywords
  const complexKeywords = [
    '分析.*提案',
    '価格.*分析',
    '比較.*どちら',
    'エントリー.*ポイント',
    '詳細.*分析',
    '包括的',
    '全体的',
  ];
  
  const hasComplexKeywords = complexKeywords.some(pattern => 
    new RegExp(pattern, 'i').test(userQuery)
  );
  
  if (hasComplexKeywords) {
    return true;
  }
  
  // 5. Queries asking for multiple types of information
  const multipleInfoTypes = [
    ['価格', '分析'],
    ['チャート', '分析'],
    ['トレンド', '提案'],
    ['表示', '分析'],
  ];
  
  const requestsMultipleInfo = multipleInfoTypes.some(types => 
    types.every(type => userQuery.includes(type))
  );
  
  return requestsMultipleInfo;
}

/**
 * 詳細なクエリ分析（型安全版）
 */
export function analyzeQuery(userQuery: unknown): QueryAnalysisResult {
  if (!isValidQuery(userQuery)) {
    return {
      isComplex: false,
      reason: [],
      symbols: [],
      operations: []
    };
  }

  const reasons: ComplexityReason[] = [];
  const symbols = extractCryptoSymbols(userQuery);
  const operations: string[] = [];

  // 1. Length-based detection
  if (userQuery.length > 70) {
    reasons.push(ComplexityReason.LENGTH);
  }
  
  // 2. Multiple operations detection
  const multipleOperations =
    (userQuery.includes('して') && (userQuery.match(/して/g) || []).length > 1) ||
    (userQuery.includes('また') || userQuery.includes('そして') || userQuery.includes('さらに'));
  
  if (multipleOperations) {
    reasons.push(ComplexityReason.MULTIPLE_OPERATIONS);
    operations.push('multiple_actions');
  }
  
  // 3. Multiple symbols detection
  if (symbols.length > 1) {
    reasons.push(ComplexityReason.MULTIPLE_SYMBOLS);
  }
  
  // 4. Complex intent keywords
  const complexKeywords = [
    '分析.*提案',
    '価格.*分析',
    '比較.*どちら',
    'エントリー.*ポイント',
    '詳細.*分析',
    '包括的',
    '全体的',
  ];
  
  const hasComplexKeywords = complexKeywords.some(pattern =>
    new RegExp(pattern, 'i').test(userQuery)
  );
  
  if (hasComplexKeywords) {
    reasons.push(ComplexityReason.COMPLEX_KEYWORDS);
  }
  
  // 5. Queries asking for multiple types of information
  const multipleInfoTypes = [
    ['価格', '分析'],
    ['チャート', '分析'],
    ['トレンド', '提案'],
    ['表示', '分析'],
  ];
  
  const requestsMultipleInfo = multipleInfoTypes.some(types =>
    types.every(type => userQuery.includes(type))
  );
  
  if (requestsMultipleInfo) {
    reasons.push(ComplexityReason.MULTIPLE_INFO_TYPES);
  }

  return {
    isComplex: reasons.length > 0,
    reason: reasons,
    symbols,
    operations
  };
}