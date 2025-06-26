// String Helper Utilities for Orchestrator Agent
// 🟢 Green phase implementation - extractMetadataFromQuery function

/**
 * Extract metadata from query for memory storage
 * Extracted from orchestrator.agent.ts (lines 701-723)
 */
export function extractMetadataFromQuery(query: string): { symbols: string[]; topics: string[] } {
  const symbols: string[] = [];
  const topics: string[] = [];
  
  // Extract cryptocurrency symbols
  const cryptoSymbols = ['BTC', 'ETH', 'ADA', 'SOL', 'DOGE', 'XRP', 'DOT', 'LINK', 'UNI', 'AVAX', 'MATIC'];
  const queryUpper = query.toUpperCase();
  
  for (const symbol of cryptoSymbols) {
    if (queryUpper.includes(symbol)) {
      symbols.push(symbol);
    }
  }
  
  // Extract topics
  const queryLower = query.toLowerCase();
  if (queryLower.includes('価格') || queryLower.includes('price')) topics.push('price');
  if (queryLower.includes('分析') || queryLower.includes('analysis')) topics.push('analysis');
  if (queryLower.includes('チャート') || queryLower.includes('chart')) topics.push('chart');
  if (queryLower.includes('取引') || queryLower.includes('trading')) topics.push('trading');
  
  return { symbols, topics };
}