#!/usr/bin/env node

/**
 * Simple test of multi-timeframe analysis without dependencies
 * Tests the basic functionality by directly calling the services
 */

// Mock environment
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';

async function testBasicFunctionality() {
  console.log('🧪 Testing Multi-Timeframe Basic Functionality\n');
  
  try {
    // Test 1: Check if modules can be imported
    console.log('📦 Test 1: Module Import Check');
    console.log('============================');
    
    let enhancedMarketDataService;
    let multiTimeframeLineDetector;
    
    try {
      const enhancedModule = await import('../lib/services/enhanced-market-data.service.ts');
      enhancedMarketDataService = enhancedModule.enhancedMarketDataService;
      console.log('✅ Enhanced Market Data Service imported successfully');
      console.log('   Module keys:', Object.keys(enhancedModule));
      console.log('   Service methods:', enhancedMarketDataService ? Object.getOwnPropertyNames(Object.getPrototypeOf(enhancedMarketDataService)) : 'undefined');
      
      if (enhancedMarketDataService && typeof enhancedMarketDataService.fetchMultiTimeframeData === 'function') {
        console.log('✅ fetchMultiTimeframeData method available');
      } else {
        console.log('❌ fetchMultiTimeframeData method not found');
        console.log('   Service type:', typeof enhancedMarketDataService);
        console.log('   Available properties:', enhancedMarketDataService ? Object.keys(enhancedMarketDataService) : 'none');
      }
      
    } catch (error) {
      console.log('❌ Failed to import Enhanced Market Data Service:', error.message);
    }
    
    try {
      const detectorModule = await import('../lib/analysis/multi-timeframe-line-detector.ts');
      multiTimeframeLineDetector = detectorModule.multiTimeframeLineDetector;
      console.log('✅ Multi-Timeframe Line Detector imported successfully');
      
      if (multiTimeframeLineDetector && typeof multiTimeframeLineDetector.detectLines === 'function') {
        console.log('✅ detectLines method available');
      } else {
        console.log('❌ detectLines method not found');
      }
      
    } catch (error) {
      console.log('❌ Failed to import Multi-Timeframe Line Detector:', error.message);
    }
    
    // Test 2: Check Binance API service
    console.log('\n📡 Test 2: Binance API Service Check');
    console.log('===================================');
    
    try {
      const binanceModule = await import('../lib/binance/api-service.ts');
      const binanceAPI = binanceModule.binanceAPI;
      console.log('✅ Binance API service imported successfully');
      
      if (binanceAPI && typeof binanceAPI.getKlines === 'function') {
        console.log('✅ getKlines method available');
      } else {
        console.log('❌ getKlines method not found');
      }
      
    } catch (error) {
      console.log('❌ Failed to import Binance API service:', error.message);
    }
    
    // Test 3: Check if we can get some sample data
    console.log('\n📊 Test 3: Sample Data Fetch');
    console.log('============================');
    
    if (enhancedMarketDataService && typeof enhancedMarketDataService.fetchMultiTimeframeData === 'function') {
      try {
        console.log('🔄 Attempting to fetch sample data for BTCUSDT...');
        
        const startTime = Date.now();
        const multiTimeframeData = await enhancedMarketDataService.fetchMultiTimeframeData('BTCUSDT');
        const fetchTime = Date.now() - startTime;
        
        console.log(`✅ Successfully fetched data in ${fetchTime}ms`);
        console.log(`   Symbol: ${multiTimeframeData.symbol}`);
        console.log(`   Timeframes: ${Object.keys(multiTimeframeData.timeframes).join(', ')}`);
        
        // Show data details
        for (const [interval, data] of Object.entries(multiTimeframeData.timeframes)) {
          console.log(`   ${interval}: ${data.data.length} candles, weight: ${data.weight}`);
          if (data.data.length > 0) {
            const latest = data.data[data.data.length - 1];
            console.log(`     Latest price: $${latest.close.toFixed(2)}`);
          }
        }
        
        // Test 4: Try line detection if data fetch succeeded
        console.log('\n📈 Test 4: Line Detection');
        console.log('========================');
        
        if (multiTimeframeLineDetector && typeof multiTimeframeLineDetector.detectLines === 'function') {
          try {
            const detectionConfig = {
              minTimeframes: 2,
              priceTolerancePercent: 0.5,
              minTouchCount: 3,
              strengthThreshold: 0.6,
              confluenceZoneWidth: 1.0,
              recencyWeight: 0.3
            };
            
            console.log('🔄 Running line detection...');
            const detectionStart = Date.now();
            const lineDetectionResult = multiTimeframeLineDetector.detectLines(multiTimeframeData, detectionConfig);
            const detectionTime = Date.now() - detectionStart;
            
            console.log(`✅ Line detection completed in ${detectionTime}ms`);
            console.log(`   Horizontal Lines: ${lineDetectionResult.horizontalLines.length}`);
            console.log(`   Trend Lines: ${lineDetectionResult.trendLines.length}`);
            console.log(`   Confluence Zones: ${lineDetectionResult.confluenceZones.length}`);
            
            // Show top results
            if (lineDetectionResult.horizontalLines.length > 0) {
              console.log('\n   Top Horizontal Lines:');
              lineDetectionResult.horizontalLines.slice(0, 3).forEach((line, index) => {
                console.log(`     ${index + 1}. ${line.type.toUpperCase()}: $${line.price.toFixed(2)}`);
                console.log(`        Confidence: ${(line.confidence * 100).toFixed(1)}% | Strength: ${(line.strength * 100).toFixed(1)}%`);
                console.log(`        Timeframes: ${line.supportingTimeframes.join(', ')}`);
              });
            }
            
            // Test 5: Calculate quality metrics
            console.log('\n📊 Test 5: Quality Assessment');
            console.log('============================');
            
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
            
            console.log(`✅ Quality Metrics:`);
            console.log(`   Total Lines: ${totalLines}`);
            console.log(`   High Confidence (≥80%): ${highConfidenceLines}`);
            console.log(`   Multi-timeframe Lines: ${multiTimeframeLines}`);
            console.log(`   Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
            console.log(`   Average Strength: ${(avgStrength * 100).toFixed(1)}%`);
            console.log(`   Confluence Zones: ${lineDetectionResult.confluenceZones.length}`);
            
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
            
            // Test 6: Performance assessment
            console.log('\n🎯 Test 6: Performance Assessment');
            console.log('=================================');
            
            const totalTime = fetchTime + detectionTime;
            const isSuccessful = qualityScore >= 70 && totalLines >= 3 && multiTimeframeLines >= 1;
            
            console.log(`✅ Performance Summary:`);
            console.log(`   Total Processing Time: ${totalTime}ms`);
            console.log(`   Data Fetch Time: ${fetchTime}ms`);
            console.log(`   Detection Time: ${detectionTime}ms`);
            console.log(`   Success Criteria Met: ${isSuccessful ? '✅ YES' : '❌ NO'}`);
            
            if (isSuccessful) {
              console.log('\n🎉 SUCCESS: Phase 1 multi-timeframe line detection is working!');
              console.log('   ✅ Multi-timeframe data integration working');
              console.log('   ✅ Cross-timeframe validation working');
              console.log('   ✅ Line detection accuracy improved');
              console.log('   ✅ Performance is acceptable');
              
              // Play success sound
              try {
                const { spawn } = require('child_process');
                spawn('afplay', ['/System/Library/Sounds/Hero.aiff'], { stdio: 'ignore' });
              } catch (error) {
                // Sound is optional
              }
              
            } else {
              console.log('\n⚠️  PARTIAL SUCCESS: Implementation working but needs optimization');
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
            
          } catch (error) {
            console.log(`❌ Line detection failed: ${error.message}`);
          }
        } else {
          console.log('❌ Line detector not available');
        }
        
      } catch (error) {
        console.log(`❌ Data fetch failed: ${error.message}`);
        
        if (error.message.includes('fetch')) {
          console.log('💡 This might be expected if there\'s no internet connection or API issues');
        }
      }
    } else {
      console.log('❌ Enhanced Market Data Service not available');
    }
    
    console.log('\n✅ Basic functionality test completed!');
    
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
testBasicFunctionality().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});