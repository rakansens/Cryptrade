#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';

interface ToolImplementation {
  name: string;
  filePath: string;
  hasExport: boolean;
  hasExecuteMethod: boolean;
  hasInputValidation: boolean;
  hasErrorHandling: boolean;
  hasTypeDefinitions: boolean;
  dependencies: string[];
  codePatterns: {
    circuitBreaker?: boolean;
    retryLogic?: boolean;
    caching?: boolean;
    logging?: boolean;
  };
}

class ToolImplementationValidator {
  private toolFiles = [
    { name: 'marketDataResilientTool', path: 'lib/mastra/tools/market-data-resilient.tool.ts' },
    { name: 'chartDataAnalysisTool', path: 'lib/mastra/tools/chart-data-analysis.tool.ts' },
    { name: 'enhancedLineAnalysisTool', path: 'lib/mastra/tools/enhanced-line-analysis.tool.ts' },
    { name: 'proposalGenerationTool', path: 'lib/mastra/tools/proposal-generation.tool.ts' },
    { name: 'entryProposalGenerationTool', path: 'lib/mastra/tools/entry-proposal-generation/index.ts' },
    { name: 'enhancedChartControlTool', path: 'lib/mastra/tools/enhanced-chart-control.tool.ts' },
    { name: 'uiStateTool', path: 'lib/mastra/tools/ui-state.tool.ts' },
    { name: 'memoryRecallTool', path: 'lib/mastra/tools/memory-recall.tool.ts' },
    { name: 'agentSelectionTool', path: 'lib/mastra/tools/agent-selection.tool.ts' }
  ];

  private implementations: ToolImplementation[] = [];

  async analyzeTools(): Promise<void> {
    console.log('🔍 ツール実装検証を開始します...\n');

    for (const tool of this.toolFiles) {
      await this.analyzeToolImplementation(tool);
    }

    await this.generateDetailedReport();
  }

  private async analyzeToolImplementation(tool: { name: string; path: string }): Promise<void> {
    console.log(`📝 Analyzing ${tool.name}...`);
    
    const fullPath = path.join(process.cwd(), tool.path);
    const implementation: ToolImplementation = {
      name: tool.name,
      filePath: tool.path,
      hasExport: false,
      hasExecuteMethod: false,
      hasInputValidation: false,
      hasErrorHandling: false,
      hasTypeDefinitions: false,
      dependencies: [],
      codePatterns: {}
    };

    try {
      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      
      // Check for export
      implementation.hasExport = /export\s+(const|function|class)\s+\w*[Tt]ool/.test(fileContent) ||
                                /export\s+{\s*\w*[Tt]ool/.test(fileContent);
      
      // Check for execute method
      implementation.hasExecuteMethod = /execute\s*[:=]\s*async?\s*\(|\.execute\s*=/.test(fileContent);
      
      // Check for input validation
      implementation.hasInputValidation = /z\.|zod|validate|schema|input\s*validation/i.test(fileContent);
      
      // Check for error handling
      implementation.hasErrorHandling = /try\s*{|catch\s*\(|\.catch\(|throw\s+new/i.test(fileContent);
      
      // Check for type definitions
      implementation.hasTypeDefinitions = /interface\s+|type\s+\w+\s*=|:\s*\w+(\[\])?</i.test(fileContent);
      
      // Extract dependencies
      const importMatches = fileContent.match(/import\s+.*from\s+['"]([^'"]+)['"]/g) || [];
      implementation.dependencies = importMatches.map(imp => {
        const match = imp.match(/from\s+['"]([^'"]+)['"]/);
        return match ? match[1] : '';
      }).filter(dep => dep && !dep.startsWith('.'));
      
      // Check for specific patterns
      implementation.codePatterns.circuitBreaker = /circuit\s*breaker|CircuitBreaker/i.test(fileContent);
      implementation.codePatterns.retryLogic = /retry|retries|attemptCount|maxAttempts/i.test(fileContent);
      implementation.codePatterns.caching = /cache|cached|memoize|ttl/i.test(fileContent);
      implementation.codePatterns.logging = /logger|console\.log|debug|error\(/i.test(fileContent);
      
      console.log(`✅ ${tool.name} analysis complete`);
    } catch (error) {
      console.log(`❌ ${tool.name} analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    this.implementations.push(implementation);
  }

  private async generateDetailedReport(): Promise<void> {
    // Calculate statistics
    const totalTools = this.implementations.length;
    const toolsWithExport = this.implementations.filter(t => t.hasExport).length;
    const toolsWithExecute = this.implementations.filter(t => t.hasExecuteMethod).length;
    const toolsWithValidation = this.implementations.filter(t => t.hasInputValidation).length;
    const toolsWithErrorHandling = this.implementations.filter(t => t.hasErrorHandling).length;
    const toolsWithTypes = this.implementations.filter(t => t.hasTypeDefinitions).length;
    
    // Pattern statistics
    const patternsStats = {
      circuitBreaker: this.implementations.filter(t => t.codePatterns.circuitBreaker).length,
      retryLogic: this.implementations.filter(t => t.codePatterns.retryLogic).length,
      caching: this.implementations.filter(t => t.codePatterns.caching).length,
      logging: this.implementations.filter(t => t.codePatterns.logging).length
    };
    
    // Generate compliance score for each tool
    const toolScores = this.implementations.map(impl => ({
      name: impl.name,
      score: this.calculateComplianceScore(impl),
      issues: this.identifyIssues(impl)
    }));
    
    // Create comprehensive report
    const report = {
      summary: {
        totalTools,
        implementationStats: {
          withExport: toolsWithExport,
          withExecuteMethod: toolsWithExecute,
          withInputValidation: toolsWithValidation,
          withErrorHandling: toolsWithErrorHandling,
          withTypeDefinitions: toolsWithTypes
        },
        patternUsage: patternsStats,
        averageComplianceScore: Math.round(
          toolScores.reduce((sum, t) => sum + t.score, 0) / totalTools
        )
      },
      toolDetails: this.implementations,
      complianceScores: toolScores,
      recommendations: this.generateRecommendations(),
      timestamp: new Date().toISOString()
    };
    
    // Save detailed report
    const reportPath = path.join(process.cwd(), 'tool_implementation_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Generate Japanese summary
    const avgScore = report.summary.averageComplianceScore;
    const japaneseSummary = `実装検証完了: ${totalTools}ツール分析、平均準拠スコア${avgScore}%。エラー処理${toolsWithErrorHandling}個、型定義${toolsWithTypes}個実装。パターン使用率: キャッシュ${patternsStats.caching}個、リトライ${patternsStats.retryLogic}個。`;
    
    console.log('\n📊 実装検証レポート');
    console.log('================================');
    console.log(`🔧 総ツール数: ${totalTools}`);
    console.log(`📦 エクスポート実装: ${toolsWithExport}/${totalTools}`);
    console.log(`⚡ Execute メソッド: ${toolsWithExecute}/${totalTools}`);
    console.log(`✅ 入力検証: ${toolsWithValidation}/${totalTools}`);
    console.log(`🛡️ エラー処理: ${toolsWithErrorHandling}/${totalTools}`);
    console.log(`📝 型定義: ${toolsWithTypes}/${totalTools}`);
    console.log('\n🎯 デザインパターン使用状況:');
    console.log(`   サーキットブレーカー: ${patternsStats.circuitBreaker}`);
    console.log(`   リトライロジック: ${patternsStats.retryLogic}`);
    console.log(`   キャッシング: ${patternsStats.caching}`);
    console.log(`   ロギング: ${patternsStats.logging}`);
    console.log('================================');
    console.log(`\n📝 日本語サマリー: ${japaneseSummary}`);
    console.log(`\n📁 詳細レポート保存先: ${reportPath}`);
    
    // Display tools needing attention
    const lowScoreTools = toolScores.filter(t => t.score < 70);
    if (lowScoreTools.length > 0) {
      console.log('\n⚠️  改善が必要なツール:');
      lowScoreTools.forEach(t => {
        console.log(`   - ${t.name} (スコア: ${t.score}%)`);
        t.issues.forEach(issue => console.log(`     • ${issue}`));
      });
    }
  }

  private calculateComplianceScore(impl: ToolImplementation): number {
    let score = 0;
    const weights = {
      hasExport: 20,
      hasExecuteMethod: 20,
      hasInputValidation: 15,
      hasErrorHandling: 20,
      hasTypeDefinitions: 15,
      hasPatterns: 10
    };
    
    if (impl.hasExport) score += weights.hasExport;
    if (impl.hasExecuteMethod) score += weights.hasExecuteMethod;
    if (impl.hasInputValidation) score += weights.hasInputValidation;
    if (impl.hasErrorHandling) score += weights.hasErrorHandling;
    if (impl.hasTypeDefinitions) score += weights.hasTypeDefinitions;
    
    // Bonus for design patterns
    const patternCount = Object.values(impl.codePatterns).filter(v => v).length;
    if (patternCount > 0) score += weights.hasPatterns;
    
    return score;
  }

  private identifyIssues(impl: ToolImplementation): string[] {
    const issues: string[] = [];
    
    if (!impl.hasExport) issues.push('Missing proper export statement');
    if (!impl.hasExecuteMethod) issues.push('Missing execute method');
    if (!impl.hasInputValidation) issues.push('No input validation detected');
    if (!impl.hasErrorHandling) issues.push('Insufficient error handling');
    if (!impl.hasTypeDefinitions) issues.push('Missing type definitions');
    
    return issues;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const avgValidation = this.implementations.filter(t => t.hasInputValidation).length / this.implementations.length;
    if (avgValidation < 0.8) {
      recommendations.push('Implement consistent input validation using Zod across all tools');
    }
    
    const avgErrorHandling = this.implementations.filter(t => t.hasErrorHandling).length / this.implementations.length;
    if (avgErrorHandling < 0.9) {
      recommendations.push('Ensure all tools have comprehensive error handling');
    }
    
    const circuitBreakerTools = this.implementations.filter(t => t.codePatterns.circuitBreaker).length;
    if (circuitBreakerTools < 3) {
      recommendations.push('Consider implementing circuit breaker pattern for more tools dealing with external services');
    }
    
    return recommendations;
  }
}

// Run the validator
const validator = new ToolImplementationValidator();
validator.analyzeTools().catch(console.error);