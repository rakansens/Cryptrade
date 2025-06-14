#!/usr/bin/env node

/**
 * Direct test of multi-timeframe line detection without AI dependencies
 * Tests the enhanced market data service and line detector directly
 */

const path = require('path');

// Mock the environment to avoid validation issues
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';
process.env.ANTHROPIC_API_KEY = 'test-key';

async function testMultiTimeframeDetection() {
  console.log('🧪 Testing Multi-Timeframe Line Detection (Direct)\n');
  
  try {
    // Import the modules after setting environment - fix import syntax
    const { enhancedMarketDataService } = await import('../lib/services/enhanced-market-data.service.ts');
    const { multiTimeframeLineDetector } = await import('../lib/analysis/multi-timeframe-line-detector.ts');
    
    const symbol = 'BTCUSDT';
    console.log(`📊 Testing direct multi-timeframe detection for ${symbol}...\n`);
    
    // Test 1: Enhanced Market Data Service
    console.log('🔄 Test 1: Enhanced Market Data Service');
    console.log('=====================================');
    
    const startTime = Date.now();
    const multiTimeframeData = await enhancedMarketDataService.fetchMultiTimeframeData(symbol);
    const fetchTime = Date.now() - startTime;
    
    console.log(`✅ Fetched multi-timeframe data in ${fetchTime}ms`);
    console.log(`   Timeframes: ${Object.keys(multiTimeframeData.timeframes).join(', ')}`);
    
    for (const [interval, data] of Object.entries(multiTimeframeData.timeframes)) {
      console.log(`   ${interval}: ${data.data.length} candles, weight: ${data.weight}`);
    }
    
    // Test 2: Support/Resistance Detection
    console.log('\n🎯 Test 2: Support/Resistance Detection');
    console.log('======================================');
    
    const levels = enhancedMarketDataService.findMultiTimeframeSupportResistance(multiTimeframeData, {
      minTimeframes: 2,
      minTouchCount: 3
    });
    
    console.log(`✅ Found ${levels.length} cross-timeframe levels`);
    
    levels.slice(0, 5).forEach((level, index) => {
      console.log(`   ${index + 1}. ${level.type.toUpperCase()}: $${level.price.toFixed(2)}`);
      console.log(`      Strength: ${(level.strength * 100).toFixed(1)}% | Confidence: ${(level.confidenceScore * 100).toFixed(1)}%`);
      console.log(`      Touches: ${level.touchCount} | Timeframes: ${level.timeframeSupport.join(', ')}`);
    });
    
    // Test 3: Confluence Zone Detection
    console.log('\n🎯 Test 3: Confluence Zone Detection');
    console.log('===================================');
    
    const confluenceZones = enhancedMarketDataService.findConfluenceZones(multiTimeframeData, {
      minTimeframes: 2
    });
    
    console.log(`✅ Found ${confluenceZones.length} confluence zones`);
    
    confluenceZones.slice(0, 3).forEach((zone, index) => {
      console.log(`   ${index + 1}. ${zone.type.toUpperCase()} ZONE:`);
      console.log(`      Range: $${zone.priceRange.min.toFixed(2)} - $${zone.priceRange.max.toFixed(2)}`);
      console.log(`      Strength: ${(zone.strength * 100).toFixed(1)}% | Timeframes: ${zone.timeframeCount}`);
      console.log(`      Supporting: ${zone.supportingTimeframes.join(', ')}`);
    });
    
    // Test 4: Multi-Timeframe Line Detector
    console.log('\n📈 Test 4: Multi-Timeframe Line Detector');
    console.log('========================================');
    
    const detectionConfig = {
      minTimeframes: 2,
      priceTolerancePercent: 0.5,
      minTouchCount: 3,
      strengthThreshold: 0.6,
      confluenceZoneWidth: 1.0,
      recencyWeight: 0.3
    };
    
    const detectionStart = Date.now();
    const lineDetectionResult = multiTimeframeLineDetector.detectLines(multiTimeframeData, detectionConfig);
    const detectionTime = Date.now() - detectionStart;
    
    console.log(`✅ Line detection completed in ${detectionTime}ms`);
    console.log(`   Horizontal Lines: ${lineDetectionResult.horizontalLines.length}`);
    console.log(`   Trend Lines: ${lineDetectionResult.trendLines.length}`);
    console.log(`   Confluence Zones: ${lineDetectionResult.confluenceZones.length}`);
    
    // Show top horizontal lines
    if (lineDetectionResult.horizontalLines.length > 0) {
      console.log('\n   Top Horizontal Lines:');
      lineDetectionResult.horizontalLines.slice(0, 3).forEach((line, index) => {
        console.log(`     ${index + 1}. ${line.type.toUpperCase()}: $${line.price.toFixed(2)}`);
        console.log(`        Confidence: ${(line.confidence * 100).toFixed(1)}% | Strength: ${(line.strength * 100).toFixed(1)}%`);
        console.log(`        Touches: ${line.touchCount} | Timeframes: ${line.supportingTimeframes.join(', ')}`);
      });
    }
    
    // Show trend lines
    if (lineDetectionResult.trendLines.length > 0) {
      console.log('\n   Trend Lines:');
      lineDetectionResult.trendLines.slice(0, 3).forEach((line, index) => {
        console.log(`     ${index + 1}. TREND: Slope ${line.slope > 0 ? '+' : ''}${line.slope.toFixed(4)}`);
        console.log(`        Confidence: ${(line.confidence * 100).toFixed(1)}% | Strength: ${(line.strength * 100).toFixed(1)}%`);
        console.log(`        Touches: ${line.touchCount} | Timeframes: ${line.supportingTimeframes.join(', ')}`);
      });
    }
    
    // Test 5: Performance Summary
    console.log('\n📊 Test 5: Performance Summary');
    console.log('=============================');
    
    const totalLines = lineDetectionResult.horizontalLines.length + lineDetectionResult.trendLines.length;
    const highConfidenceLines = [...lineDetectionResult.horizontalLines, ...lineDetectionResult.trendLines]
      .filter(line => line.confidence >= 0.8).length;
    const multiTimeframeLines = [...lineDetectionResult.horizontalLines, ...lineDetectionResult.trendLines]
      .filter(line => line.supportingTimeframes.length >= 2).length;
    
    const avgConfidence = totalLines > 0 
      ? [...lineDetectionResult.horizontalLines, ...lineDetectionResult.trendLines]
          .reduce((sum, line) => sum + line.confidence, 0) / totalLines
      : 0;
    
    const avgStrength = totalLines > 0 
      ? [...lineDetectionResult.horizontalLines, ...lineDetectionResult.trendLines]
          .reduce((sum, line) => sum + line.strength, 0) / totalLines
      : 0;
    
    console.log(`✅ Performance Metrics:`);
    console.log(`   Total Lines Detected: ${totalLines}`);
    console.log(`   High Confidence (≥80%): ${highConfidenceLines}`);
    console.log(`   Multi-timeframe Lines: ${multiTimeframeLines}`);
    console.log(`   Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    console.log(`   Average Strength: ${(avgStrength * 100).toFixed(1)}%`);
    console.log(`   Confluence Zones: ${lineDetectionResult.confluenceZones.length}`);
    console.log(`   Total Detection Time: ${fetchTime + detectionTime}ms`);
    
    // Calculate quality score
    const multiTimeframePercentage = totalLines > 0 ? (multiTimeframeLines / totalLines) : 0;
    const qualityScore = Math.min(100, (
      avgConfidence * 30 +
      avgStrength * 25 +
      multiTimeframePercentage * 25 +
      (lineDetectionResult.confluenceZones.length > 0 ? 10 : 0) +
      (highConfidenceLines / Math.max(totalLines, 1)) * 10
    ));
    
    console.log(`   Quality Score: ${qualityScore.toFixed(1)}/100`);
    
    // Grade assessment
    let grade;
    if (qualityScore >= 90) grade = 'A+ (Excellent)';
    else if (qualityScore >= 80) grade = 'A (Very Good)';
    else if (qualityScore >= 70) grade = 'B (Good)';
    else if (qualityScore >= 60) grade = 'C (Acceptable)';
    else if (qualityScore >= 50) grade = 'D (Needs Improvement)';
    else grade = 'F (Poor)';
    
    console.log(`   Grade: ${grade}`);
    
    // Test cache performance
    console.log('\n⚡ Test 6: Cache Performance');
    console.log('===========================');
    
    const cacheStart = Date.now();
    const cachedData = await enhancedMarketDataService.fetchMultiTimeframeData(symbol);
    const cacheTime = Date.now() - cacheStart;
    
    console.log(`✅ Cached fetch completed in ${cacheTime}ms`);
    console.log(`   Cache speedup: ${(fetchTime / Math.max(cacheTime, 1)).toFixed(1)}x faster`);
    
    // Final assessment
    console.log('\n🎯 PHASE 1 IMPLEMENTATION ASSESSMENT');
    console.log('====================================');
    
    const isSuccessful = qualityScore >= 70 && totalLines >= 3 && multiTimeframeLines >= 1;
    
    if (isSuccessful) {
      console.log('✅ SUCCESS: Phase 1 multi-timeframe line detection is working effectively!');
      console.log('   • Multi-timeframe data integration: ✅');
      console.log('   • Cross-timeframe validation: ✅');
      console.log('   • Confluence zone detection: ✅');
      console.log('   • Performance optimization: ✅');
      
      // Play success sound
      try {
        const { spawn } = require('child_process');
        spawn('afplay', ['/System/Library/Sounds/Hero.aiff'], { stdio: 'ignore' });
      } catch (error) {
        // Sound is optional
      }
      
    } else {
      console.log('⚠️  PARTIAL SUCCESS: Phase 1 implemented but needs optimization');
      console.log(`   Quality Score: ${qualityScore.toFixed(1)}/100 (Target: ≥70)`);
      console.log(`   Total Lines: ${totalLines} (Target: ≥3)`);
      console.log(`   Multi-timeframe: ${multiTimeframeLines} (Target: ≥1)`);
      
      // Play notification sound
      try {
        const { spawn } = require('child_process');
        spawn('afplay', ['/System/Library/Sounds/Glass.aiff'], { stdio: 'ignore' });
      } catch (error) {
        // Sound is optional
      }
    }
    
    console.log('\n✅ Phase 1 direct testing completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    
    // Play error sound
    try {
      const { spawn } = require('child_process');
      spawn('afplay', ['/System/Library/Sounds/Basso.aiff'], { stdio: 'ignore' });
    } catch (soundError) {
      // Sound is optional
    }
    
    process.exit(1);
  }
}

// Run the test
testMultiTimeframeDetection().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});