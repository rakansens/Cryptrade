import { executeImprovedOrchestrator } from './lib/mastra/agents/orchestrator.agent';

// Test if these queries are detected as complex
const testQueries = [
  'BTCの価格',
  'フィボナッチのおすすめポイントは？',
  'ETHに切り替えて価格チェック',
  'こんにちは',
];

// Function to detect complex query (from orchestrator.agent.ts)
function detectComplexQuery(userQuery: string): boolean {
  // Length-based detection
  if (userQuery.length > 100) {
    return true;
  }
  
  // Multiple operations detection
  const multipleOperations = 
    (userQuery.includes('して') && (userQuery.match(/して/g) || []).length > 1) ||
    (userQuery.includes('また') || userQuery.includes('そして') || userQuery.includes('さらに'));
  
  if (multipleOperations) {
    return true;
  }
  
  // Multiple symbols detection
  const cryptoSymbols = userQuery.match(/[A-Z]{3,}(?:USDT)?/g) || [];
  if (cryptoSymbols.length > 1) {
    return true;
  }
  
  // Complex intent keywords
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
  
  // Queries asking for multiple types of information
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

console.log('Testing complex query detection:\n');

testQueries.forEach((query) => {
  const isComplex = detectComplexQuery(query);
  console.log(`Query: "${query}"`);
  console.log(`Is Complex: ${isComplex}`);
  console.log(`Length: ${query.length}`);
  console.log('---');
});

// ダミー参照で未使用警告を抑制
void executeImprovedOrchestrator;