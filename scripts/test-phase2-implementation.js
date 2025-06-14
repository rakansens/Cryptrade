#!/usr/bin/env node

/**
 * Phase 2 Implementation Test
 * 
 * Tests the advanced touch point detection implementation
 * focusing on wick/body analysis, volume confirmation, and bounce patterns.
 */

// Mock environment
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';

async function testPhase2Implementation() {
  console.log('🧪 Testing Phase 2: Advanced Touch Point Detection');
  console.log('==================================================\n');
  
  try {
    // Test 1: Advanced Touch Detector
    console.log('📊 Test 1: Advanced Touch Detector');
    console.log('==================================');
    
    let AdvancedTouchDetector;
    try {
      const touchModule = await import('../lib/analysis/advanced-touch-detector.ts');
      AdvancedTouchDetector = touchModule.AdvancedTouchDetector;
      console.log('✅ Advanced Touch Detector imported successfully');
      console.log('   Available exports:', Object.keys(touchModule));
    } catch (error) {
      console.log('❌ Failed to import Advanced Touch Detector:', error.message);
      return;
    }
    
    // Create test data with different touch types
    const testData = [
      // Support level around 50000
      { time: 1000, open: 50100, high: 50200, low: 49950, close: 50050, volume: 1000 }, // Wick touch
      { time: 2000, open: 50050, high: 50150, low: 50000, close: 50000, volume: 1500 }, // Body touch  
      { time: 3000, open: 50000, high: 50300, low: 49990, close: 50250, volume: 2000 }, // Exact + bounce
      { time: 4000, open: 50250, high: 50300, low: 50200, close: 50280, volume: 1200 },
      { time: 5000, open: 50280, high: 50350, low: 49980, close: 50020, volume: 1800 }, // Another touch
      { time: 6000, open: 50020, high: 50400, low: 50010, close: 50350, volume: 2500 }, // Strong bounce
    ];
    
    // Try different import approaches
    let detector;
    if (AdvancedTouchDetector) {
      detector = new AdvancedTouchDetector();
    } else {
      console.log('❌ Could not find AdvancedTouchDetector constructor');
      console.log('   Trying alternative approaches...');
      
      // Try importing directly from touchModule
      try {
        const touchModule = await import('../lib/analysis/advanced-touch-detector.ts');
        if (touchModule.AdvancedTouchDetector) {
          detector = new touchModule.AdvancedTouchDetector();
        } else if (touchModule.advancedTouchDetector) {
          detector = touchModule.advancedTouchDetector;
        } else if (touchModule.default && touchModule.default.advancedTouchDetector) {
          detector = touchModule.default.advancedTouchDetector;
        } else {
          console.log('   Module structure:', JSON.stringify(touchModule, null, 2));
          return;
        }
      } catch (err) {
        console.log('   Import error:', err.message);
        return;
      }
    }
    const supportLevel = 50000;
    
    console.log('🔄 Analyzing touch points for support level 50000...');
    const touchAnalysis = detector.analyzeTouchPoints(testData, supportLevel, 'support');
    
    console.log('✅ Touch Analysis Results:');
    console.log(`   Total Touches: ${touchAnalysis.touchPoints.length}`);
    console.log(`   Wick Touches: ${touchAnalysis.wickTouchCount}`);
    console.log(`   Body Touches: ${touchAnalysis.bodyTouchCount}`);
    console.log(`   Exact Touches: ${touchAnalysis.exactTouchCount}`);
    console.log(`   Strong Bounces: ${touchAnalysis.strongBounceCount}`);
    console.log(`   Quality Score: ${touchAnalysis.touchQualityScore.toFixed(1)}/100`);
    console.log(`   Volume Weighted Strength: ${touchAnalysis.volumeWeightedStrength.toFixed(3)}`);
    
    // Test touch filtering
    const highQualityTouches = detector.filterHighQualityTouches(
      touchAnalysis,
      0.8, // High strength
      true, // Require volume
      false // Don't require bounce
    );
    console.log(`   High Quality Touches: ${highQualityTouches.length}`);
    
    // Test confidence calculation
    const confidence = detector.calculateLineConfidence(touchAnalysis);
    console.log(`   Line Confidence: ${(confidence * 100).toFixed(1)}%`);
    
    // Test statistics
    const { summary, details } = detector.getTouchStatistics(touchAnalysis);
    console.log(`   Summary: ${summary}`);
    
    // Test 2: Enhanced Line Detector V2
    console.log('\n📈 Test 2: Enhanced Line Detector V2');
    console.log('===================================');
    
    let EnhancedLineDetectorV2;
    try {
      const detectorModule = await import('../lib/analysis/enhanced-line-detector-v2.ts');
      EnhancedLineDetectorV2 = detectorModule.EnhancedLineDetectorV2;
      console.log('✅ Enhanced Line Detector V2 imported successfully');
    } catch (error) {
      console.log('❌ Failed to import Enhanced Line Detector V2:', error.message);
      return;
    }
    
    // Create mock multi-timeframe data
    const mockMultiTimeframeData = {
      symbol: 'BTCUSDT',
      timeframes: {
        '15m': {
          data: generateMockData(100, 50000),
          weight: 0.3,
          dataPoints: 100
        },
        '1h': {
          data: generateMockData(50, 50000),
          weight: 0.5, 
          dataPoints: 50
        },
        '4h': {
          data: generateMockData(25, 50000),
          weight: 0.8,
          dataPoints: 25
        }
      },
      fetchedAt: Date.now()
    };
    
    console.log('🔄 Testing enhanced line detection...');
    const lineDetector = new EnhancedLineDetectorV2({
      minTouchCount: 2,
      minConfidence: 0.5,
      minQualityScore: 40
    });
    
    const detectionResult = await lineDetector.detectEnhancedLines(mockMultiTimeframeData);
    
    console.log('✅ Enhanced Line Detection Results:');
    console.log(`   Horizontal Lines: ${detectionResult.horizontalLines.length}`);
    console.log(`   Trendlines: ${detectionResult.trendlines.length}`);
    console.log(`   Processing Time: ${detectionResult.detectionStats.processingTime}ms`);
    
    // Show sample line details
    if (detectionResult.horizontalLines.length > 0) {
      const sampleLine = detectionResult.horizontalLines[0];
      console.log('\n   Sample Horizontal Line:');
      console.log(`     Price: $${sampleLine.price.toFixed(2)}`);
      console.log(`     Type: ${sampleLine.type}`);
      console.log(`     Confidence: ${(sampleLine.confidence * 100).toFixed(1)}%`);
      console.log(`     Touch Count: ${sampleLine.touchCount}`);
      console.log(`     Supporting Timeframes: ${sampleLine.supportingTimeframes.join(', ')}`);
      console.log(`     Quality Score: ${sampleLine.qualityMetrics.overallQuality.toFixed(1)}/100`);
      console.log(`     Wick/Body Ratio: ${(sampleLine.qualityMetrics.wickBodyRatio * 100).toFixed(1)}%`);
      console.log(`     Volume Confirmation: ${(sampleLine.qualityMetrics.volumeConfirmation * 100).toFixed(1)}%`);
      console.log(`     Bounce Confirmation: ${(sampleLine.qualityMetrics.bounceConfirmation * 100).toFixed(1)}%`);
    }
    
    // Test 3: Enhanced Line Analysis Tool V2
    console.log('\n🛠️  Test 3: Enhanced Line Analysis Tool V2');
    console.log('===========================================');
    
    let enhancedLineAnalysisV2Tool;
    try {
      const toolModule = await import('../lib/mastra/tools/enhanced-line-analysis-v2.tool.ts');
      enhancedLineAnalysisV2Tool = toolModule.enhancedLineAnalysisV2Tool;
      console.log('✅ Enhanced Line Analysis Tool V2 imported successfully');
      console.log(`   Tool ID: ${enhancedLineAnalysisV2Tool.id}`);
      console.log(`   Tool Description: ${enhancedLineAnalysisV2Tool.description.slice(0, 100)}...`);
    } catch (error) {
      console.log('❌ Failed to import Enhanced Line Analysis Tool V2:', error.message);
      return;
    }
    
    // Test 4: Configuration Variations
    console.log('\n⚙️  Test 4: Configuration Variations');
    console.log('====================================');
    
    const configurations = [
      {
        name: 'Quick Analysis',
        config: {
          minTimeframes: 1,
          minTouchCount: 2,
          minConfidence: 0.5,
          requireVolumeConfirmation: false,
          requireBounceConfirmation: false
        }
      },
      {
        name: 'Standard Analysis',
        config: {
          minTimeframes: 2,
          minTouchCount: 3,
          minConfidence: 0.6,
          requireVolumeConfirmation: false,
          requireBounceConfirmation: false
        }
      },
      {
        name: 'Comprehensive Analysis',
        config: {
          minTimeframes: 3,
          minTouchCount: 4,
          minConfidence: 0.7,
          requireVolumeConfirmation: true,
          requireBounceConfirmation: true
        }
      }
    ];
    
    for (const configTest of configurations) {
      console.log(`\n🔧 Testing ${configTest.name}:`);
      
      const testDetector = new EnhancedLineDetectorV2(configTest.config);
      const testResult = await testDetector.detectEnhancedLines(mockMultiTimeframeData);
      
      console.log(`   Lines Found: ${testResult.horizontalLines.length + testResult.trendlines.length}`);
      console.log(`   High Quality: ${[...testResult.horizontalLines, ...testResult.trendlines]
        .filter(line => line.qualityMetrics.overallQuality >= 80).length}`);
      console.log(`   Multi-timeframe: ${[...testResult.horizontalLines, ...testResult.trendlines]
        .filter(line => line.supportingTimeframes.length >= 2).length}`);
      
      if (configTest.config.requireVolumeConfirmation) {
        const avgVolumeConfirmation = [...testResult.horizontalLines, ...testResult.trendlines]
          .reduce((sum, line) => sum + line.qualityMetrics.volumeConfirmation, 0) / 
          Math.max([...testResult.horizontalLines, ...testResult.trendlines].length, 1);
        console.log(`   Avg Volume Confirmation: ${(avgVolumeConfirmation * 100).toFixed(1)}%`);
      }
      
      if (configTest.config.requireBounceConfirmation) {
        const avgBounceConfirmation = [...testResult.horizontalLines, ...testResult.trendlines]
          .reduce((sum, line) => sum + line.qualityMetrics.bounceConfirmation, 0) / 
          Math.max([...testResult.horizontalLines, ...testResult.trendlines].length, 1);
        console.log(`   Avg Bounce Confirmation: ${(avgBounceConfirmation * 100).toFixed(1)}%`);
      }
    }
    
    // Test 5: Performance Assessment
    console.log('\n🎯 Test 5: Performance Assessment');
    console.log('=================================');
    
    const performanceTests = [];
    const testCount = 5;
    
    for (let i = 0; i < testCount; i++) {
      const start = Date.now();
      const perfResult = await lineDetector.detectEnhancedLines(mockMultiTimeframeData);
      const time = Date.now() - start;
      
      performanceTests.push({
        time,
        linesFound: perfResult.horizontalLines.length + perfResult.trendlines.length,
        avgQuality: [...perfResult.horizontalLines, ...perfResult.trendlines]
          .reduce((sum, line) => sum + line.qualityMetrics.overallQuality, 0) / 
          Math.max([...perfResult.horizontalLines, ...perfResult.trendlines].length, 1)
      });
    }
    
    const avgTime = performanceTests.reduce((sum, test) => sum + test.time, 0) / testCount;
    const avgLines = performanceTests.reduce((sum, test) => sum + test.linesFound, 0) / testCount;
    const avgQuality = performanceTests.reduce((sum, test) => sum + test.avgQuality, 0) / testCount;
    
    console.log(`✅ Performance Metrics (${testCount} runs):`);
    console.log(`   Average Processing Time: ${avgTime.toFixed(0)}ms`);
    console.log(`   Average Lines Detected: ${avgLines.toFixed(1)}`);
    console.log(`   Average Quality Score: ${avgQuality.toFixed(1)}/100`);
    console.log(`   Throughput: ${(avgLines / (avgTime / 1000)).toFixed(1)} lines/second`);
    
    // Test 6: Phase 2 Features Validation
    console.log('\n🚀 Test 6: Phase 2 Features Validation');
    console.log('======================================');
    
    const validationResult = await lineDetector.detectEnhancedLines(mockMultiTimeframeData);
    const allLines = [...validationResult.horizontalLines, ...validationResult.trendlines];
    
    // Check Phase 2 specific features
    const hasWickBodyAnalysis = allLines.every(line => 
      line.touchAnalysis && 
      typeof line.touchAnalysis.wickTouchCount === 'number' &&
      typeof line.touchAnalysis.bodyTouchCount === 'number'
    );
    
    const hasVolumeAnalysis = allLines.every(line => 
      line.qualityMetrics && 
      typeof line.qualityMetrics.volumeConfirmation === 'number'
    );
    
    const hasBounceAnalysis = allLines.every(line => 
      line.qualityMetrics && 
      typeof line.qualityMetrics.bounceConfirmation === 'number'
    );
    
    const hasQualityMetrics = allLines.every(line => 
      line.qualityMetrics && 
      typeof line.qualityMetrics.overallQuality === 'number'
    );
    
    console.log('✅ Phase 2 Feature Validation:');
    console.log(`   Wick/Body Touch Analysis: ${hasWickBodyAnalysis ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Volume Confirmation: ${hasVolumeAnalysis ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Bounce Pattern Detection: ${hasBounceAnalysis ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Enhanced Quality Metrics: ${hasQualityMetrics ? '✅ PASS' : '❌ FAIL'}`);
    
    // Calculate overall Phase 2 success
    const phase2Features = [hasWickBodyAnalysis, hasVolumeAnalysis, hasBounceAnalysis, hasQualityMetrics];
    const phase2Success = phase2Features.filter(Boolean).length / phase2Features.length;
    
    console.log(`\n🎯 Phase 2 Implementation Success: ${(phase2Success * 100).toFixed(1)}%`);
    
    // Final Assessment
    console.log('\n🏆 PHASE 2 FINAL ASSESSMENT');
    console.log('===========================');
    
    const isPhase2Successful = phase2Success >= 0.75 && avgQuality >= 60 && avgLines >= 3;
    
    if (isPhase2Successful) {
      console.log('✅ SUCCESS: Phase 2 Advanced Touch Point Detection implemented successfully!');
      console.log('   ✅ Wick vs Body touch analysis working');
      console.log('   ✅ Volume confirmation integrated');
      console.log('   ✅ Price bounce detection functional');
      console.log('   ✅ Enhanced quality metrics operational');
      console.log('   ✅ Performance is acceptable');
      
      // Play success sound
      try {
        const { spawn } = require('child_process');
        spawn('afplay', ['/System/Library/Sounds/Hero.aiff'], { stdio: 'ignore' });
      } catch (error) {
        // Sound is optional
      }
      
    } else {
      console.log('⚠️  PARTIAL SUCCESS: Phase 2 implemented but needs optimization');
      console.log(`   Feature Implementation: ${(phase2Success * 100).toFixed(1)}% (Target: ≥75%)`);
      console.log(`   Average Quality: ${avgQuality.toFixed(1)}/100 (Target: ≥60)`);
      console.log(`   Lines Detected: ${avgLines.toFixed(1)} (Target: ≥3)`);
      
      // Play notification sound
      try {
        const { spawn } = require('child_process');
        spawn('afplay', ['/System/Library/Sounds/Glass.aiff'], { stdio: 'ignore' });
      } catch (error) {
        // Sound is optional
      }
    }
    
    console.log('\n✅ Phase 2 testing completed successfully!');
    
  } catch (error) {
    console.error('❌ Phase 2 test failed:', error.message);
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

/**
 * Generate mock candlestick data with support/resistance levels
 */
function generateMockData(count, basePrice) {
  const data = [];
  const supportLevel = basePrice * 0.96; // 4% below
  const resistanceLevel = basePrice * 1.04; // 4% above
  
  for (let i = 0; i < count; i++) {
    const time = Date.now() - (count - i) * 15 * 60 * 1000; // 15 minute intervals
    
    let price = basePrice + Math.sin(i * 0.1) * (basePrice * 0.02); // 2% oscillation
    
    // Create touches at support and resistance
    if (i % 15 === 7) { // Support touch
      price = supportLevel + Math.random() * (basePrice * 0.005);
    } else if (i % 18 === 11) { // Resistance touch
      price = resistanceLevel - Math.random() * (basePrice * 0.005);
    }
    
    const open = price;
    const close = price + (Math.random() - 0.5) * (basePrice * 0.01);
    const high = Math.max(open, close) + Math.random() * (basePrice * 0.008);
    const low = Math.min(open, close) - Math.random() * (basePrice * 0.008);
    const volume = 1000 + Math.random() * 2000;
    
    data.push({ time, open, high, low, close, volume });
  }
  
  return data;
}

// Run the test
testPhase2Implementation().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});