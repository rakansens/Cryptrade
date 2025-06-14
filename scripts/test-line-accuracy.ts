#!/usr/bin/env tsx

/**
 * Line Detection Accuracy Testing Script
 * 
 * This script tests and compares the accuracy of the multi-timeframe line detection
 * against the original single-timeframe approach. It provides detailed metrics
 * and performance comparisons.
 */

import { multiTimeframeLineDetector } from '@/lib/analysis/multi-timeframe-line-detector';
import { enhancedMarketDataService } from '@/lib/services/enhanced-market-data.service';
import { enhancedLineAnalysisTool } from '@/lib/mastra/tools/enhanced-line-analysis.tool';
import { chartDataAnalysisTool } from '@/lib/mastra/tools/chart-data-analysis.tool';
import { logger } from '@/lib/utils/logger';

interface AccuracyMetrics {
  totalLines: number;
  highConfidenceLines: number;
  multiTimeframeLines: number;
  averageConfidence: number;
  averageStrength: number;
  confluenceZones: number;
  detectionTime: number;
  crossTimeframeValidation: number;
}

interface ComparisonResult {
  symbol: string;
  enhancedMetrics: AccuracyMetrics;
  originalMetrics: AccuracyMetrics;
  improvement: {
    confidenceGain: number;
    strengthGain: number;
    timeframeValidationGain: number;
    detectionTimeRatio: number;
    qualityScore: number;
  };
}

interface TestConfig {
  symbols: string[];
  iterations: number;
  enableLogging: boolean;
  saveResults: boolean;
  compareWithOriginal: boolean;
}

const DEFAULT_CONFIG: TestConfig = {
  symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT'],
  iterations: 3,
  enableLogging: true,
  saveResults: true,
  compareWithOriginal: true
};

class LineAccuracyTester {
  private config: TestConfig;
  private results: ComparisonResult[] = [];
  
  constructor(config: Partial<TestConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Run comprehensive accuracy tests
   */
  async runAccuracyTests(): Promise<void> {
    console.log('🚀 Starting Line Detection Accuracy Tests\n');
    console.log(`Testing ${this.config.symbols.length} symbols with ${this.config.iterations} iterations each\n`);
    
    const startTime = Date.now();
    
    for (const symbol of this.config.symbols) {
      console.log(`\n📊 Testing ${symbol}...`);
      
      try {
        const result = await this.testSymbolAccuracy(symbol);
        this.results.push(result);
        
        this.printSymbolResults(result);
        
      } catch (error) {
        console.error(`❌ Failed to test ${symbol}:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    const totalTime = Date.now() - startTime;
    
    console.log('\n' + '='.repeat(80));
    console.log('📈 ACCURACY TEST SUMMARY');
    console.log('='.repeat(80));
    
    this.printOverallResults();
    
    console.log(`\n⏱️  Total test time: ${(totalTime / 1000).toFixed(2)}s`);
    
    if (this.config.saveResults) {
      await this.saveResults();
    }
    
    // Play completion sound
    await this.playCompletionSound();
  }
  
  /**
   * Test accuracy for a single symbol
   */
  private async testSymbolAccuracy(symbol: string): Promise<ComparisonResult> {
    const enhancedResults = [];
    const originalResults = [];
    
    // Run multiple iterations for statistical significance
    for (let i = 0; i < this.config.iterations; i++) {
      if (this.config.enableLogging) {
        console.log(`  Iteration ${i + 1}/${this.config.iterations}`);
      }
      
      // Test enhanced multi-timeframe detection
      const enhancedResult = await this.testEnhancedDetection(symbol);
      enhancedResults.push(enhancedResult);
      
      // Test original single-timeframe detection if enabled
      if (this.config.compareWithOriginal) {
        const originalResult = await this.testOriginalDetection(symbol);
        originalResults.push(originalResult);
      }
      
      // Clear cache between iterations for fair comparison
      enhancedMarketDataService.clearCache();
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Calculate average metrics
    const enhancedMetrics = this.calculateAverageMetrics(enhancedResults);
    const originalMetrics = this.config.compareWithOriginal 
      ? this.calculateAverageMetrics(originalResults)
      : this.getBaselineMetrics();
    
    // Calculate improvements
    const improvement = this.calculateImprovement(enhancedMetrics, originalMetrics);
    
    return {
      symbol,
      enhancedMetrics,
      originalMetrics,
      improvement
    };
  }
  
  /**
   * Test enhanced multi-timeframe detection
   */
  private async testEnhancedDetection(symbol: string): Promise<AccuracyMetrics> {
    const startTime = Date.now();
    
    const result = await enhancedLineAnalysisTool.execute({
      context: {
        symbol,
        analysisType: 'full',
        config: {
          minTimeframes: 2,
          strengthThreshold: 0.5,
          minTouchCount: 3
        }
      }
    });
    
    const detectionTime = Date.now() - startTime;
    
    const allLines = [...result.horizontalLines, ...result.trendlines];
    
    // Calculate cross-timeframe validation score
    const crossTimeframeValidation = allLines.length > 0 
      ? allLines.reduce((sum, line) => sum + (line.supportingTimeframes.length > 1 ? 1 : 0), 0) / allLines.length
      : 0;
    
    return {
      totalLines: allLines.length,
      highConfidenceLines: allLines.filter(line => line.confidence >= 0.8).length,
      multiTimeframeLines: allLines.filter(line => line.supportingTimeframes.length >= 2).length,
      averageConfidence: allLines.length > 0 
        ? allLines.reduce((sum, line) => sum + line.confidence, 0) / allLines.length 
        : 0,
      averageStrength: allLines.length > 0
        ? allLines.reduce((sum, line) => sum + line.strength, 0) / allLines.length
        : 0,
      confluenceZones: result.confluenceZones.length,
      detectionTime,
      crossTimeframeValidation
    };
  }
  
  /**
   * Test original single-timeframe detection
   */
  private async testOriginalDetection(symbol: string): Promise<AccuracyMetrics> {
    const startTime = Date.now();
    
    const result = await chartDataAnalysisTool.execute({
      context: {
        symbol,
        timeframe: '1h',
        limit: 500,
        analysisType: 'full'
      }
    });
    
    const detectionTime = Date.now() - startTime;
    
    const lines = result.recommendations?.trendlineDrawing || [];
    
    return {
      totalLines: lines.length,
      highConfidenceLines: lines.filter(line => line.priority >= 8).length,
      multiTimeframeLines: 0, // Original doesn't support multi-timeframe
      averageConfidence: lines.length > 0 
        ? lines.reduce((sum, line) => sum + line.priority / 10, 0) / lines.length 
        : 0,
      averageStrength: lines.length > 0
        ? lines.reduce((sum, line) => sum + line.priority / 10, 0) / lines.length
        : 0,
      confluenceZones: 0, // Original doesn't detect confluence zones
      detectionTime,
      crossTimeframeValidation: 0 // Original doesn't have cross-timeframe validation
    };
  }
  
  /**
   * Calculate average metrics from multiple test runs
   */
  private calculateAverageMetrics(results: AccuracyMetrics[]): AccuracyMetrics {
    const count = results.length;
    
    return {
      totalLines: Math.round(results.reduce((sum, r) => sum + r.totalLines, 0) / count),
      highConfidenceLines: Math.round(results.reduce((sum, r) => sum + r.highConfidenceLines, 0) / count),
      multiTimeframeLines: Math.round(results.reduce((sum, r) => sum + r.multiTimeframeLines, 0) / count),
      averageConfidence: results.reduce((sum, r) => sum + r.averageConfidence, 0) / count,
      averageStrength: results.reduce((sum, r) => sum + r.averageStrength, 0) / count,
      confluenceZones: Math.round(results.reduce((sum, r) => sum + r.confluenceZones, 0) / count),
      detectionTime: results.reduce((sum, r) => sum + r.detectionTime, 0) / count,
      crossTimeframeValidation: results.reduce((sum, r) => sum + r.crossTimeframeValidation, 0) / count
    };
  }
  
  /**
   * Get baseline metrics for comparison when original detection is not available
   */
  private getBaselineMetrics(): AccuracyMetrics {
    return {
      totalLines: 5,
      highConfidenceLines: 1,
      multiTimeframeLines: 0,
      averageConfidence: 0.6,
      averageStrength: 0.6,
      confluenceZones: 0,
      detectionTime: 1000,
      crossTimeframeValidation: 0
    };
  }
  
  /**
   * Calculate improvement metrics
   */
  private calculateImprovement(enhanced: AccuracyMetrics, original: AccuracyMetrics) {
    const confidenceGain = enhanced.averageConfidence - original.averageConfidence;
    const strengthGain = enhanced.averageStrength - original.averageStrength;
    const timeframeValidationGain = enhanced.crossTimeframeValidation - original.crossTimeframeValidation;
    const detectionTimeRatio = enhanced.detectionTime / Math.max(original.detectionTime, 1);
    
    // Calculate overall quality score (0-100)
    const qualityScore = Math.min(100, (
      enhanced.averageConfidence * 30 +
      enhanced.averageStrength * 25 +
      enhanced.crossTimeframeValidation * 25 +
      (enhanced.confluenceZones > 0 ? 10 : 0) +
      (enhanced.multiTimeframeLines / Math.max(enhanced.totalLines, 1)) * 10
    ));
    
    return {
      confidenceGain,
      strengthGain,
      timeframeValidationGain,
      detectionTimeRatio,
      qualityScore
    };
  }
  
  /**
   * Print results for a single symbol
   */
  private printSymbolResults(result: ComparisonResult): void {
    const { symbol, enhancedMetrics, originalMetrics, improvement } = result;
    
    console.log(`\n  📈 ${symbol} Results:`);
    console.log(`    Enhanced: ${enhancedMetrics.totalLines} lines, ${(enhancedMetrics.averageConfidence * 100).toFixed(1)}% confidence`);
    
    if (this.config.compareWithOriginal) {
      console.log(`    Original: ${originalMetrics.totalLines} lines, ${(originalMetrics.averageConfidence * 100).toFixed(1)}% confidence`);
      console.log(`    Improvement: +${(improvement.confidenceGain * 100).toFixed(1)}% confidence, +${(improvement.strengthGain * 100).toFixed(1)}% strength`);
    }
    
    console.log(`    Quality Score: ${improvement.qualityScore.toFixed(1)}/100`);
    console.log(`    Multi-timeframe: ${enhancedMetrics.multiTimeframeLines}/${enhancedMetrics.totalLines} lines`);
    console.log(`    Confluence Zones: ${enhancedMetrics.confluenceZones}`);
    console.log(`    Detection Time: ${enhancedMetrics.detectionTime.toFixed(0)}ms`);
  }
  
  /**
   * Print overall test results
   */
  private printOverallResults(): void {
    if (this.results.length === 0) {
      console.log('No results to display');
      return;
    }
    
    // Calculate overall averages
    const avgEnhancedConfidence = this.results.reduce((sum, r) => sum + r.enhancedMetrics.averageConfidence, 0) / this.results.length;
    const avgEnhancedStrength = this.results.reduce((sum, r) => sum + r.enhancedMetrics.averageStrength, 0) / this.results.length;
    const avgQualityScore = this.results.reduce((sum, r) => sum + r.improvement.qualityScore, 0) / this.results.length;
    const avgConfidenceGain = this.results.reduce((sum, r) => sum + r.improvement.confidenceGain, 0) / this.results.length;
    const avgStrengthGain = this.results.reduce((sum, r) => sum + r.improvement.strengthGain, 0) / this.results.length;
    
    const totalMultiTimeframeLines = this.results.reduce((sum, r) => sum + r.enhancedMetrics.multiTimeframeLines, 0);
    const totalLines = this.results.reduce((sum, r) => sum + r.enhancedMetrics.totalLines, 0);
    const multiTimeframePercentage = totalLines > 0 ? (totalMultiTimeframeLines / totalLines) * 100 : 0;
    
    const totalConfluenceZones = this.results.reduce((sum, r) => sum + r.enhancedMetrics.confluenceZones, 0);
    const avgDetectionTime = this.results.reduce((sum, r) => sum + r.enhancedMetrics.detectionTime, 0) / this.results.length;
    
    console.log(`\n📊 Overall Performance:`);
    console.log(`   Average Confidence: ${(avgEnhancedConfidence * 100).toFixed(1)}%`);
    console.log(`   Average Strength: ${(avgEnhancedStrength * 100).toFixed(1)}%`);
    console.log(`   Average Quality Score: ${avgQualityScore.toFixed(1)}/100`);
    console.log(`   Multi-timeframe Coverage: ${multiTimeframePercentage.toFixed(1)}%`);
    console.log(`   Total Confluence Zones: ${totalConfluenceZones}`);
    console.log(`   Average Detection Time: ${avgDetectionTime.toFixed(0)}ms`);
    
    if (this.config.compareWithOriginal) {
      console.log(`\n🚀 Improvements vs Original:`);
      console.log(`   Confidence Gain: +${(avgConfidenceGain * 100).toFixed(1)}%`);
      console.log(`   Strength Gain: +${(avgStrengthGain * 100).toFixed(1)}%`);
    }
    
    // Performance grade
    const grade = this.calculatePerformanceGrade(avgQualityScore);
    console.log(`\n🎯 Overall Grade: ${grade}`);
    
    // Best and worst performers
    const bestPerformer = this.results.reduce((best, current) => 
      current.improvement.qualityScore > best.improvement.qualityScore ? current : best
    );
    
    const worstPerformer = this.results.reduce((worst, current) => 
      current.improvement.qualityScore < worst.improvement.qualityScore ? current : worst
    );
    
    console.log(`\n🏆 Best Performer: ${bestPerformer.symbol} (${bestPerformer.improvement.qualityScore.toFixed(1)}/100)`);
    console.log(`⚠️  Needs Improvement: ${worstPerformer.symbol} (${worstPerformer.improvement.qualityScore.toFixed(1)}/100)`);
  }
  
  /**
   * Calculate performance grade
   */
  private calculatePerformanceGrade(qualityScore: number): string {
    if (qualityScore >= 90) return 'A+ (Excellent)';
    if (qualityScore >= 80) return 'A (Very Good)';
    if (qualityScore >= 70) return 'B (Good)';
    if (qualityScore >= 60) return 'C (Acceptable)';
    if (qualityScore >= 50) return 'D (Needs Improvement)';
    return 'F (Poor)';
  }
  
  /**
   * Save results to file
   */
  private async saveResults(): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `/Users/hirosato/Downloads/Cryptrade/reports/line-accuracy-${timestamp}.json`;
      
      const reportData = {
        testConfig: this.config,
        results: this.results,
        timestamp: new Date().toISOString(),
        summary: {
          totalSymbols: this.results.length,
          averageQualityScore: this.results.reduce((sum, r) => sum + r.improvement.qualityScore, 0) / this.results.length,
          overallGrade: this.calculatePerformanceGrade(
            this.results.reduce((sum, r) => sum + r.improvement.qualityScore, 0) / this.results.length
          )
        }
      };
      
      const fs = await import('fs/promises');
      await fs.writeFile(filename, JSON.stringify(reportData, null, 2));
      
      console.log(`\n💾 Results saved to: ${filename}`);
      
    } catch (error) {
      console.error('Failed to save results:', error);
    }
  }
  
  /**
   * Play completion sound
   */
  private async playCompletionSound(): Promise<void> {
    try {
      const { spawn } = await import('child_process');
      
      // Determine sound based on overall performance
      const avgQualityScore = this.results.reduce((sum, r) => sum + r.improvement.qualityScore, 0) / this.results.length;
      const soundFile = avgQualityScore >= 80 
        ? '/System/Library/Sounds/Hero.aiff'
        : avgQualityScore >= 60
        ? '/System/Library/Sounds/Glass.aiff'
        : '/System/Library/Sounds/Ping.aiff';
      
      spawn('afplay', [soundFile], { stdio: 'ignore' });
      
    } catch (error) {
      // Sound is optional, don't fail the test
    }
  }
  
  /**
   * Run specific accuracy scenarios
   */
  async runSpecificScenarios(): Promise<void> {
    console.log('🎯 Running Specific Accuracy Scenarios\n');
    
    const scenarios = [
      {
        name: 'High Volatility Assets',
        symbols: ['BTCUSDT', 'ETHUSDT'],
        config: { minTimeframes: 3, strengthThreshold: 0.7 }
      },
      {
        name: 'Stable Assets',
        symbols: ['USDCUSDT'],
        config: { minTimeframes: 2, strengthThreshold: 0.6 }
      },
      {
        name: 'Altcoins',
        symbols: ['ADAUSDT', 'DOTUSDT', 'LINKUSDT'],
        config: { minTimeframes: 2, strengthThreshold: 0.5 }
      }
    ];
    
    for (const scenario of scenarios) {
      console.log(`\n📋 Scenario: ${scenario.name}`);
      console.log(`   Symbols: ${scenario.symbols.join(', ')}`);
      console.log(`   Config: ${JSON.stringify(scenario.config)}`);
      
      const scenarioTester = new LineAccuracyTester({
        symbols: scenario.symbols,
        iterations: 2,
        enableLogging: false,
        saveResults: false,
        compareWithOriginal: false
      });
      
      try {
        await scenarioTester.runAccuracyTests();
      } catch (error) {
        console.error(`   ❌ Scenario failed:`, error instanceof Error ? error.message : String(error));
      }
    }
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const testType = args[0] || 'full';
  
  console.log('🔍 Multi-Timeframe Line Detection Accuracy Tests');
  console.log('================================================\n');
  
  try {
    const tester = new LineAccuracyTester({
      enableLogging: !args.includes('--quiet'),
      saveResults: !args.includes('--no-save'),
      compareWithOriginal: !args.includes('--no-compare'),
      iterations: args.includes('--fast') ? 1 : 3
    });
    
    if (testType === 'scenarios') {
      await tester.runSpecificScenarios();
    } else {
      await tester.runAccuracyTests();
    }
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { LineAccuracyTester, type AccuracyMetrics, type ComparisonResult };