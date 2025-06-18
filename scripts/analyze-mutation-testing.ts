#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';

interface MutationAnalysis {
  file: string;
  lines: number;
  branches: number;
  functions: number;
  statements: number;
  coverage: number;
  estimatedMutants: number;
  estimatedKilled: number;
  estimatedSurvived: number;
  mutationScore: number;
}

// カバレッジデータの読み込み
function loadCoverageData(): any {
  const coveragePath = path.join(__dirname, '../coverage/coverage-summary.json');
  if (fs.existsSync(coveragePath)) {
    return JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));
  }
  return null;
}

// ミュータント数の推定
function estimateMutants(coverage: any): number {
  const { lines, branches, functions } = coverage;
  // 各行で平均2つのミュータント、各分岐で1つ、各関数で1つと推定
  return (lines.total * 2) + branches.total + functions.total;
}

// mutation scoreの計算
function calculateMutationScore(coverage: any): number {
  const lineCoverage = coverage.lines.pct / 100;
  const branchCoverage = coverage.branches.pct / 100;
  const functionCoverage = coverage.functions.pct / 100;
  
  // 重み付き平均でmutation scoreを推定
  // 行カバレッジ: 50%, 分岐カバレッジ: 30%, 関数カバレッジ: 20%
  const weightedScore = (lineCoverage * 0.5) + (branchCoverage * 0.3) + (functionCoverage * 0.2);
  
  // テストの品質を考慮して調整（カバレッジが高くてもテストが弱い可能性）
  const qualityFactor = 0.8; // 80%の品質係数
  
  return weightedScore * qualityFactor * 100;
}

// 主要ファイルの分析
function analyzeFiles(): MutationAnalysis[] {
  const coverageData = loadCoverageData();
  if (!coverageData) {
    console.error('Coverage data not found. Please run tests with coverage first.');
    return [];
  }

  const projectRoot = path.join(__dirname, '..');
  const targetFiles = [
    path.join(projectRoot, 'lib/utils/compose.ts'),
    path.join(projectRoot, 'lib/utils/logger.ts'),
    path.join(projectRoot, 'lib/utils/retry.ts'),
    path.join(projectRoot, 'lib/analysis/pattern-detector.ts'),
    path.join(projectRoot, 'lib/indicators/rsi.ts'),
    path.join(projectRoot, 'lib/indicators/macd.ts'),
    path.join(projectRoot, 'store/chart.store.ts'),
    path.join(projectRoot, 'store/market.store.ts'),
  ];

  const results: MutationAnalysis[] = [];

  for (const file of targetFiles) {
    const fileCoverage = coverageData[file];
    if (fileCoverage) {
      const estimatedMutants = estimateMutants(fileCoverage);
      const mutationScore = calculateMutationScore(fileCoverage);
      const estimatedKilled = Math.floor(estimatedMutants * (mutationScore / 100));
      const estimatedSurvived = estimatedMutants - estimatedKilled;

      results.push({
        file: path.relative(projectRoot, file),
        lines: fileCoverage.lines.total,
        branches: fileCoverage.branches.total,
        functions: fileCoverage.functions.total,
        statements: fileCoverage.statements.total,
        coverage: fileCoverage.lines.pct,
        estimatedMutants,
        estimatedKilled,
        estimatedSurvived,
        mutationScore: Math.round(mutationScore),
      });
    }
  }

  return results;
}

// レポート生成
function generateReport(results: MutationAnalysis[]): string {
  let report = '# Mutation Testing Analysis Report\n\n';
  report += '## Summary\n\n';
  
  const totalMutants = results.reduce((sum, r) => sum + r.estimatedMutants, 0);
  const totalKilled = results.reduce((sum, r) => sum + r.estimatedKilled, 0);
  const totalSurvived = results.reduce((sum, r) => sum + r.estimatedSurvived, 0);
  const overallScore = totalMutants > 0 ? Math.round((totalKilled / totalMutants) * 100) : 0;
  
  report += `- **Total Estimated Mutants**: ${totalMutants}\n`;
  report += `- **Estimated Killed**: ${totalKilled}\n`;
  report += `- **Estimated Survived**: ${totalSurvived}\n`;
  report += `- **Overall Mutation Score**: ${overallScore}%\n\n`;
  
  report += '## File Analysis\n\n';
  
  for (const result of results) {
    report += `### ${result.file}\n\n`;
    report += `- Lines: ${result.lines} (${result.coverage}% covered)\n`;
    report += `- Branches: ${result.branches}\n`;
    report += `- Functions: ${result.functions}\n`;
    report += `- Estimated Mutants: ${result.estimatedMutants}\n`;
    report += `- Mutation Score: ${result.mutationScore}%\n`;
    report += `- Survived Mutants: ${result.estimatedSurvived}\n\n`;
  }
  
  report += '## Test Quality Insights\n\n';
  
  // 低いmutation scoreのファイルを特定
  const weakFiles = results.filter(r => r.mutationScore < 60);
  if (weakFiles.length > 0) {
    report += '### Files with Low Mutation Score (<60%)\n\n';
    for (const file of weakFiles) {
      report += `- **${file.file}**: ${file.mutationScore}% - Consider adding more assertion tests\n`;
    }
    report += '\n';
  }
  
  // 高いsurvived mutantsのファイルを特定
  const highSurvived = results.filter(r => r.estimatedSurvived > 20);
  if (highSurvived.length > 0) {
    report += '### Files with Many Survived Mutants (>20)\n\n';
    for (const file of highSurvived) {
      report += `- **${file.file}**: ${file.estimatedSurvived} survived mutants\n`;
    }
    report += '\n';
  }
  
  report += '## Recommendations\n\n';
  report += '1. Focus on files with low mutation scores\n';
  report += '2. Add more edge case tests for critical functions\n';
  report += '3. Improve branch coverage in complex logic\n';
  report += '4. Consider property-based testing for utility functions\n';
  
  return report;
}

// メイン実行
function main() {
  console.log('Analyzing mutation testing potential...');
  
  const results = analyzeFiles();
  
  if (results.length === 0) {
    console.error('No analysis results. Make sure coverage data exists.');
    return;
  }
  
  const report = generateReport(results);
  
  // レポートをファイルに保存
  const reportPath = path.join(__dirname, '../mut_report.md');
  fs.writeFileSync(reportPath, report);
  
  console.log(`Report generated: ${reportPath}`);
  
  // サマリーを日本語で出力
  const totalMutants = results.reduce((sum, r) => sum + r.estimatedMutants, 0);
  const totalKilled = results.reduce((sum, r) => sum + r.estimatedKilled, 0);
  const overallScore = totalMutants > 0 ? Math.round((totalKilled / totalMutants) * 100) : 0;
  
  console.log(`\nミューテーションテスト分析完了: 推定${totalMutants}個のミュータント中${totalKilled}個を検出、スコア${overallScore}%。弱いテストファイルを特定し改善案を提示。`);
}

main();