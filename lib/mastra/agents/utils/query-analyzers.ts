// Query Analyzer Utilities for Orchestrator Agent
// 🟢 Green phase implementation - detectComplexQuery function

/**
 * Detect if a query is complex and requires parallel processing
 * Extracted from orchestrator.agent.ts (lines 921-980)
 */
export function detectComplexQuery(userQuery: string): boolean {
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
  const cryptoSymbols = userQuery.match(/[A-Z]{3,}(?:USDT)?/g) || [];
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