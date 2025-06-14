#!/usr/bin/env tsx

/**
 * Multi-Timeframe Line Detection Demo
 * 
 * Demonstrates the enhanced multi-timeframe line detection capabilities
 * and compares them with the original single-timeframe approach.
 */

import { enhancedLineAnalysisTool } from '@/lib/mastra/tools/enhanced-line-analysis.tool';
import { multiTimeframeLineDetector } from '@/lib/analysis/multi-timeframe-line-detector';
import { enhancedMarketDataService } from '@/lib/services/enhanced-market-data.service';

async function runDemo(): Promise<void> {
  console.log('🚀 Multi-Timeframe Line Detection Demo');
  console.log('====================================\n');

  try {
    const symbol = 'BTCUSDT';
    
    console.log(`📊 Analyzing ${symbol} with enhanced multi-timeframe detection...\n`);
    
    // Run enhanced line analysis
    const result = await enhancedLineAnalysisTool.execute({
      context: {
        symbol,
        analysisType: 'full',
        config: {
          minTimeframes: 2,
          strengthThreshold: 0.6,
          minTouchCount: 3
        }
      }
    });
    
    console.log('📈 ANALYSIS RESULTS');
    console.log('==================');
    console.log(`Symbol: ${result.symbol}`);
    console.log(`Current Price: $${result.marketStructure.priceAction.currentPrice.toFixed(2)}`);
    console.log(`Market Trend: ${result.marketStructure.currentTrend} (${Math.round(result.marketStructure.trendStrength * 100)}% strength)`);
    console.log(`Analysis Time: ${result.summary.detectionTime}ms`);
    
    console.log('\n🎯 DETECTED LINES');
    console.log('=================');
    console.log(`Total Lines: ${result.summary.totalLines}`);
    console.log(`High Confidence: ${result.summary.highConfidenceLines}`);
    console.log(`Multi-timeframe: ${result.summary.multiTimeframeLines}`);
    console.log(`Average Strength: ${(result.summary.averageStrength * 100).toFixed(1)}%`);
    
    // Show top horizontal lines
    if (result.horizontalLines.length > 0) {
      console.log('\n📏 TOP HORIZONTAL LINES');
      console.log('=======================');
      result.horizontalLines.slice(0, 5).forEach((line, index) => {
        console.log(`${index + 1}. ${line.type.toUpperCase()}: $${line.price.toFixed(2)}`);
        console.log(`   Confidence: ${(line.confidence * 100).toFixed(1)}% | Strength: ${(line.strength * 100).toFixed(1)}%`);
        console.log(`   Touches: ${line.touchCount} | Timeframes: ${line.supportingTimeframes.join(', ')}`);
        if (line.description) {
          console.log(`   Description: ${line.description}`);
        }
        console.log('');
      });
    }
    
    // Show trendlines
    if (result.trendlines.length > 0) {
      console.log('📈 DETECTED TRENDLINES');
      console.log('======================');
      result.trendlines.slice(0, 3).forEach((line, index) => {
        console.log(`${index + 1}. TRENDLINE: $${line.price.toFixed(2)}`);
        console.log(`   Confidence: ${(line.confidence * 100).toFixed(1)}% | Strength: ${(line.strength * 100).toFixed(1)}%`);
        console.log(`   Touches: ${line.touchCount} | Timeframes: ${line.supportingTimeframes.join(', ')}`);
        if (line.description) {
          console.log(`   Description: ${line.description}`);
        }
        console.log('');
      });
    }
    
    // Show confluence zones
    if (result.confluenceZones.length > 0) {
      console.log('🎯 CONFLUENCE ZONES');
      console.log('===================');
      result.confluenceZones.slice(0, 3).forEach((zone, index) => {
        console.log(`${index + 1}. ${zone.type.toUpperCase()} ZONE: $${zone.priceRange.min.toFixed(2)} - $${zone.priceRange.max.toFixed(2)}`);
        console.log(`   Center: $${zone.priceRange.center.toFixed(2)}`);
        console.log(`   Strength: ${(zone.strength * 100).toFixed(1)}% | Timeframes: ${zone.timeframeCount}`);
        console.log(`   Supporting: ${zone.supportingTimeframes.join(', ')}`);
        if (zone.description) {
          console.log(`   Description: ${zone.description}`);
        }
        console.log('');
      });
    }
    
    // Show market structure analysis
    console.log('📊 MARKET STRUCTURE');
    console.log('===================');
    console.log(`Current Trend: ${result.marketStructure.currentTrend}`);
    console.log(`Trend Strength: ${(result.marketStructure.trendStrength * 100).toFixed(1)}%`);
    
    if (result.marketStructure.priceAction.nearestSupport) {
      console.log(`Nearest Support: $${result.marketStructure.priceAction.nearestSupport.toFixed(2)} (-${result.marketStructure.priceAction.distanceToSupport?.toFixed(2)}%)`);
    }
    
    if (result.marketStructure.priceAction.nearestResistance) {
      console.log(`Nearest Resistance: $${result.marketStructure.priceAction.nearestResistance.toFixed(2)} (+${result.marketStructure.priceAction.distanceToResistance?.toFixed(2)}%)`);
    }
    
    // Show key levels
    if (result.marketStructure.keyLevels.length > 0) {
      console.log('\nKey Levels:');
      result.marketStructure.keyLevels.forEach(level => {
        console.log(`  • ${level.type}: $${level.price.toFixed(2)} (${level.importance})`);
      });
    }
    
    // Show drawing recommendations
    console.log('\n🎨 DRAWING RECOMMENDATIONS');
    console.log('==========================');
    console.log(`Total Actions: ${result.recommendations.drawingActions.length}`);
    
    result.recommendations.drawingActions.slice(0, 5).forEach((action, index) => {
      console.log(`${index + 1}. ${action.action} - ${action.type.toUpperCase()}`);
      console.log(`   Priority: ${action.priority}/10`);
      console.log(`   Price: $${action.coordinates.startPrice.toFixed(2)}`);
      console.log(`   Style: ${action.style.color}, ${action.style.lineWidth}px, ${action.style.lineStyle}`);
      console.log(`   Description: ${action.description}`);
      console.log('');
    });
    
    // Show analysis summary
    console.log('📝 ANALYSIS SUMMARY');
    console.log('===================');
    console.log(result.recommendations.analysis);
    
    // Show trading setup if available
    if (result.recommendations.tradingSetup) {
      const setup = result.recommendations.tradingSetup;
      console.log('\n💼 TRADING SETUP');
      console.log('================');
      console.log(`Bias: ${setup.bias.toUpperCase()}`);
      
      if (setup.entryZones.length > 0) {
        console.log('Entry Zones:');
        setup.entryZones.forEach(zone => {
          console.log(`  • ${zone.type.toUpperCase()}: $${zone.price.toFixed(2)} (${(zone.confidence * 100).toFixed(1)}% confidence)`);
        });
      }
      
      if (setup.targetLevels.length > 0) {
        console.log('Target Levels:');
        setup.targetLevels.forEach(target => {
          console.log(`  • $${target.toFixed(2)}`);
        });
      }
      
      if (setup.stopLossLevels.length > 0) {
        console.log('Stop Loss Levels:');
        setup.stopLossLevels.forEach(stop => {
          console.log(`  • $${stop.toFixed(2)}`);
        });
      }
      
      if (setup.riskRewardRatio) {
        console.log(`Risk/Reward Ratio: 1:${setup.riskRewardRatio.toFixed(2)}`);
      }
    }
    
    console.log('\n✅ Demo completed successfully!');
    
    // Show configuration used
    console.log('\n⚙️  CONFIGURATION USED');
    console.log('=====================');
    console.log(`Min Timeframes: ${result.config.minTimeframes}`);
    console.log(`Price Tolerance: ${result.config.priceTolerancePercent}%`);
    console.log(`Min Touch Count: ${result.config.minTouchCount}`);
    console.log(`Strength Threshold: ${result.config.strengthThreshold}`);
    console.log(`Confluence Zone Width: ${result.config.confluenceZoneWidth}%`);
    console.log(`Recency Weight: ${result.config.recencyWeight}`);
    
    // Play success sound
    try {
      const { spawn } = await import('child_process');
      spawn('afplay', ['/System/Library/Sounds/Glass.aiff'], { stdio: 'ignore' });
    } catch (error) {
      // Sound is optional
    }
    
  } catch (error) {
    console.error('❌ Demo failed:', error instanceof Error ? error.message : String(error));
    
    // Play error sound
    try {
      const { spawn } = await import('child_process');
      spawn('afplay', ['/System/Library/Sounds/Basso.aiff'], { stdio: 'ignore' });
    } catch (soundError) {
      // Sound is optional
    }
    
    process.exit(1);
  }
}

// Additional demo functions
async function showMultiTimeframeComparison(): Promise<void> {
  console.log('\n🔄 MULTI-TIMEFRAME COMPARISON');
  console.log('=============================\n');
  
  const symbol = 'BTCUSDT';
  
  try {
    // Fetch multi-timeframe data
    const multiTimeframeData = await enhancedMarketDataService.fetchMultiTimeframeData(symbol);
    
    console.log(`📊 Multi-timeframe data for ${symbol}:`);
    console.log(`Timeframes: ${Object.keys(multiTimeframeData.timeframes).join(', ')}`);
    
    for (const [interval, data] of Object.entries(multiTimeframeData.timeframes)) {
      console.log(`\n${interval}:`);
      console.log(`  Data Points: ${data.data.length}`);
      console.log(`  Weight: ${data.weight}`);
      console.log(`  Latest Price: $${data.data[data.data.length - 1].close.toFixed(2)}`);
    }
    
    // Find support/resistance levels
    const levels = enhancedMarketDataService.findMultiTimeframeSupportResistance(multiTimeframeData, {
      minTimeframes: 2,
      minTouchCount: 3
    });
    
    console.log(`\n📏 Cross-timeframe levels found: ${levels.length}`);
    
    levels.slice(0, 5).forEach((level, index) => {
      console.log(`\n${index + 1}. ${level.type.toUpperCase()}: $${level.price.toFixed(2)}`);
      console.log(`   Strength: ${(level.strength * 100).toFixed(1)}%`);
      console.log(`   Confidence: ${(level.confidenceScore * 100).toFixed(1)}%`);
      console.log(`   Touch Count: ${level.touchCount}`);
      console.log(`   Supporting Timeframes: ${level.timeframeSupport.join(', ')}`);
    });
    
    // Find confluence zones
    const confluenceZones = enhancedMarketDataService.findConfluenceZones(multiTimeframeData, {
      minTimeframes: 2
    });
    
    console.log(`\n🎯 Confluence zones found: ${confluenceZones.length}`);
    
    confluenceZones.slice(0, 3).forEach((zone, index) => {
      console.log(`\n${index + 1}. ${zone.type.toUpperCase()} ZONE:`);
      console.log(`   Price Range: $${zone.priceRange.min.toFixed(2)} - $${zone.priceRange.max.toFixed(2)}`);
      console.log(`   Strength: ${(zone.strength * 100).toFixed(1)}%`);
      console.log(`   Timeframe Count: ${zone.timeframeCount}`);
      console.log(`   Supporting: ${zone.supportingTimeframes.join(', ')}`);
    });
    
  } catch (error) {
    console.error('❌ Multi-timeframe comparison failed:', error instanceof Error ? error.message : String(error));
  }
}

// Run the demo
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes('--comparison')) {
    await showMultiTimeframeComparison();
  } else {
    await runDemo();
    
    if (args.includes('--extended')) {
      await showMultiTimeframeComparison();
    }
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runDemo, showMultiTimeframeComparison };