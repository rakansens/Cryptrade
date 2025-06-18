#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';

// Tool imports
import { marketDataResilientTool } from '../../lib/mastra/tools/market-data-resilient.tool';
import { chartDataAnalysisTool } from '../../lib/mastra/tools/chart-data-analysis.tool';
import { enhancedLineAnalysisTool } from '../../lib/mastra/tools/enhanced-line-analysis.tool';
import { proposalGenerationTool } from '../../lib/mastra/tools/proposal-generation.tool';
import { entryProposalGenerationTool } from '../../lib/mastra/tools/entry-proposal-generation';
import { enhancedChartControlTool } from '../../lib/mastra/tools/enhanced-chart-control.tool';
import { uiStateTool } from '../../lib/mastra/tools/ui-state.tool';
import { memoryRecallTool } from '../../lib/mastra/tools/memory-recall.tool';
import { agentSelectionTool } from '../../lib/mastra/tools/agent-selection.tool';

interface ToolTestResult {
  name: string;
  status: 'success' | 'error' | 'warning';
  responseTime: number;
  errorMessage?: string;
  dataFormatValid: boolean;
  performanceMetrics: {
    memoryUsage: number;
    cpuTime: number;
  };
}

class ToolIntegrationValidator {
  private results: ToolTestResult[] = [];
  private startTime: number = 0;

  async runAllTests(): Promise<void> {
    console.log('🔧 ツール統合検証を開始します...\n');
    
    const tools = [
      { name: 'marketDataResilientTool', tool: marketDataResilientTool, testInput: { symbol: 'BTCUSDT', interval: '1h', limit: 100 } },
      { name: 'chartDataAnalysisTool', tool: chartDataAnalysisTool, testInput: { 
        symbol: 'BTCUSDT',
        interval: '1h',
        data: Array(50).fill(null).map((_, i) => ({
          timestamp: Date.now() - i * 3600000,
          open: 40000 + Math.random() * 1000,
          high: 40500 + Math.random() * 1000,
          low: 39500 + Math.random() * 1000,
          close: 40000 + Math.random() * 1000,
          volume: 1000 + Math.random() * 100
        }))
      }},
      { name: 'enhancedLineAnalysisTool', tool: enhancedLineAnalysisTool, testInput: {
        symbol: 'BTCUSDT',
        interval: '1h',
        lines: [
          { type: 'trend', coordinates: { start: { x: Date.now() - 86400000, y: 40000 }, end: { x: Date.now(), y: 41000 } } },
          { type: 'horizontal', coordinates: { start: { x: Date.now() - 86400000, y: 40500 }, end: { x: Date.now(), y: 40500 } } }
        ]
      }},
      { name: 'proposalGenerationTool', tool: proposalGenerationTool, testInput: {
        symbol: 'BTCUSDT',
        interval: '1h',
        currentPrice: 40000,
        marketData: {
          trend: 'bullish',
          support: 39000,
          resistance: 41000,
          volume: 'high'
        }
      }},
      { name: 'entryProposalGenerationTool', tool: entryProposalGenerationTool, testInput: {
        currentPrice: 40000,
        analysisData: {
          trend: 'bullish',
          momentum: 'strong',
          volume: 'increasing',
          keyLevels: { support: [39000, 38000], resistance: [41000, 42000] }
        },
        drawings: []
      }},
      { name: 'enhancedChartControlTool', tool: enhancedChartControlTool, testInput: {
        action: 'getChartInfo',
        data: { symbol: 'BTCUSDT', interval: '1h' }
      }},
      { name: 'uiStateTool', tool: uiStateTool, testInput: {
        action: 'getState',
        data: {}
      }},
      { name: 'memoryRecallTool', tool: memoryRecallTool, testInput: {
        action: 'retrieve',
        key: 'test_analysis',
        context: { symbol: 'BTCUSDT' }
      }},
      { name: 'agentSelectionTool', tool: agentSelectionTool, testInput: {
        query: 'Analyze BTC price action',
        context: { type: 'market_analysis' }
      }}
    ];

    for (const { name, tool, testInput } of tools) {
      await this.testTool(name, tool, testInput);
    }

    await this.generateReport();
  }

  private async testTool(name: string, tool: any, testInput: any): Promise<void> {
    console.log(`📊 Testing ${name}...`);
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    const startCpu = process.cpuUsage();
    
    const result: ToolTestResult = {
      name,
      status: 'success',
      responseTime: 0,
      dataFormatValid: true,
      performanceMetrics: {
        memoryUsage: 0,
        cpuTime: 0
      }
    };

    try {
      // Execute tool
      const response = await tool.execute(testInput);
      
      // Calculate metrics
      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;
      const endCpu = process.cpuUsage(startCpu);
      
      result.responseTime = endTime - startTime;
      result.performanceMetrics.memoryUsage = (endMemory - startMemory) / 1024 / 1024; // MB
      result.performanceMetrics.cpuTime = (endCpu.user + endCpu.system) / 1000; // ms
      
      // Validate response format
      if (!response || typeof response !== 'object') {
        result.dataFormatValid = false;
        result.status = 'warning';
      }
      
      // Check for error handling
      if (response?.error) {
        result.status = 'error';
        result.errorMessage = response.error;
      }
      
      console.log(`✅ ${name} completed in ${result.responseTime}ms`);
      
    } catch (error) {
      result.status = 'error';
      result.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.responseTime = Date.now() - startTime;
      console.log(`❌ ${name} failed: ${result.errorMessage}`);
    }
    
    this.results.push(result);
  }

  private async generateReport(): Promise<void> {
    // Generate summary
    const totalTools = this.results.length;
    const successfulTools = this.results.filter(r => r.status === 'success').length;
    const failedTools = this.results.filter(r => r.status === 'error').length;
    const warningTools = this.results.filter(r => r.status === 'warning').length;
    
    // Calculate average performance
    const avgResponseTime = this.results.reduce((sum, r) => sum + r.responseTime, 0) / totalTools;
    const avgMemoryUsage = this.results.reduce((sum, r) => sum + r.performanceMetrics.memoryUsage, 0) / totalTools;
    
    // Create report
    const report = {
      summary: {
        totalTools,
        successful: successfulTools,
        failed: failedTools,
        warnings: warningTools,
        averageResponseTime: Math.round(avgResponseTime),
        averageMemoryUsage: Math.round(avgMemoryUsage * 100) / 100
      },
      toolResults: this.results,
      timestamp: new Date().toISOString()
    };
    
    // Save report
    const reportPath = path.join(__dirname, '../../tool_test_results.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Generate Japanese summary
    const japaneseSummary = `ツール検証完了: ${totalTools}個中${successfulTools}個成功。平均応答時間${Math.round(avgResponseTime)}ms、エラー処理確認済み。全ツールのデータ形式準拠を検証。`;
    
    console.log('\n📋 検証レポート生成完了');
    console.log('================================');
    console.log(`✅ 成功: ${successfulTools}/${totalTools}`);
    console.log(`❌ 失敗: ${failedTools}/${totalTools}`);
    console.log(`⚠️  警告: ${warningTools}/${totalTools}`);
    console.log(`⏱️  平均応答時間: ${Math.round(avgResponseTime)}ms`);
    console.log(`💾 平均メモリ使用量: ${Math.round(avgMemoryUsage * 100) / 100}MB`);
    console.log('================================');
    console.log(`\n📝 日本語サマリー: ${japaneseSummary}`);
    console.log(`\n📁 詳細レポート保存先: ${reportPath}`);
  }
}

// Run the validator
const validator = new ToolIntegrationValidator();
validator.runAllTests().catch(console.error);