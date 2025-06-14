// 新規ファイル: proposal-utils.ts
// ProposalGenerationTool から共通ユーティリティを分離

export function getAnalysisTitle(
  analysisType: string,
  symbol: string,
  interval: string
): string {
  const typeMap: Record<string, string> = {
    trendline: 'トレンドライン分析',
    'support-resistance': 'サポレジ分析',
    fibonacci: 'フィボナッチ分析',
    pattern: 'パターン検出',
    all: '総合テクニカル分析',
  };
  const typeLabel = typeMap[analysisType] || 'テクニカル分析';
  return `${symbol} (${interval}) - ${typeLabel}`;
}

export function getAnalysisDescription(
  analysisType: string,
  proposalCount: number
): string {
  const descMap: Record<string, string> = {
    trendline: '検出されたトレンドラインの提案',
    'support-resistance': 'サポート・レジスタンス水準の提案',
    fibonacci: '主要なフィボナッチ水準の提案',
    pattern: 'チャートパターンの提案',
    all: '総合的な技術提案',
  };
  const base = descMap[analysisType] || '技術的提案';
  return `${base} (${proposalCount} 件)`;
} 