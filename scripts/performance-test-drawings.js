#!/usr/bin/env node

/**
 * Performance Test for Drawing Operations
 * Tests rendering performance with 100 trendlines + 50 fibonacci sets
 * 
 * Usage: node scripts/performance-test-drawings.js
 */

const puppeteer = require('puppeteer');

async function runPerformanceTest() {
  console.log('🚀 Starting Drawing Performance Test...\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Set to true for CI
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Enable performance monitoring
  await page.evaluateOnNewDocument(() => {
    window.performanceMetrics = {
      fps: [],
      renderTime: [],
      memoryUsage: []
    };
    
    // FPS counter
    let lastTime = performance.now();
    let frames = 0;
    
    function measureFPS() {
      frames++;
      const currentTime = performance.now();
      
      if (currentTime >= lastTime + 1000) {
        const fps = Math.round((frames * 1000) / (currentTime - lastTime));
        window.performanceMetrics.fps.push(fps);
        frames = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(measureFPS);
    }
    
    requestAnimationFrame(measureFPS);
  });
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  
  // Wait for chart to load
  await page.waitForSelector('[data-testid="chart-container"]', { timeout: 10000 });
  await page.waitForTimeout(3000);
  
  console.log('📊 Chart loaded, starting performance test...\n');
  
  const startTime = Date.now();
  const startMemory = await page.evaluate(() => {
    if (performance.memory) {
      return performance.memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  });
  
  // Phase 1: Add 100 trendlines
  console.log('➕ Adding 100 trendlines...');
  const trendlineStart = Date.now();
  
  for (let i = 0; i < 100; i++) {
    await page.evaluate((index) => {
      const now = Date.now();
      const basePrice = 42000 + (index * 30);
      
      window.dispatchEvent(new CustomEvent('chart:addDrawing', {
        detail: {
          id: `perf_trend_${index}`,
          type: 'trendline',
          points: [
            { time: now - 900000 - (index * 10000), price: basePrice },
            { time: now - 300000 - (index * 10000), price: basePrice + 150 }
          ],
          style: { 
            color: `hsl(${index * 3.6}, 70%, 50%)`, 
            lineWidth: 1, 
            lineStyle: 'solid', 
            showLabels: false 
          }
        }
      }));
    }, i);
    
    // Progress indicator
    if ((i + 1) % 20 === 0) {
      process.stdout.write(`\r  Progress: ${i + 1}/100 trendlines`);
      await page.waitForTimeout(50); // Small delay every 20 items
    }
  }
  
  const trendlineTime = Date.now() - trendlineStart;
  console.log(`\n  ✅ Trendlines added in ${trendlineTime}ms\n`);
  
  // Phase 2: Add 50 fibonacci sets
  console.log('➕ Adding 50 fibonacci retracements...');
  const fibStart = Date.now();
  
  for (let i = 0; i < 50; i++) {
    await page.evaluate((index) => {
      const now = Date.now();
      const basePrice = 43000 + (index * 60);
      
      window.dispatchEvent(new CustomEvent('chart:addDrawing', {
        detail: {
          id: `perf_fib_${index}`,
          type: 'fibonacci',
          points: [
            { time: now - 1200000 - (index * 15000), price: basePrice },
            { time: now - 600000 - (index * 15000), price: basePrice + 400 }
          ],
          style: { 
            color: '#FF9800', 
            lineWidth: 1, 
            lineStyle: 'dashed', 
            showLabels: false 
          }
        }
      }));
    }, i);
    
    // Progress indicator
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\r  Progress: ${i + 1}/50 fibonacci sets`);
      await page.waitForTimeout(50); // Small delay every 10 items
    }
  }
  
  const fibTime = Date.now() - fibStart;
  console.log(`\n  ✅ Fibonacci sets added in ${fibTime}ms\n`);
  
  // Wait for rendering to stabilize
  await page.waitForTimeout(2000);
  
  // Collect performance metrics
  const metrics = await page.evaluate(() => {
    const store = window.useChartStore?.getState();
    const drawingCount = store?.drawings.length || 0;
    
    const fps = window.performanceMetrics.fps;
    const avgFPS = fps.length > 0 ? fps.reduce((a, b) => a + b, 0) / fps.length : 0;
    const minFPS = fps.length > 0 ? Math.min(...fps) : 0;
    
    const currentMemory = performance.memory ? 
      performance.memory.usedJSHeapSize / 1024 / 1024 : 0;
    
    return {
      drawingCount,
      avgFPS: Math.round(avgFPS),
      minFPS,
      currentMemoryMB: Math.round(currentMemory)
    };
  });
  
  const endMemory = metrics.currentMemoryMB;
  const memoryIncrease = endMemory - startMemory;
  const totalTime = Date.now() - startTime;
  
  // Fetch metrics from API
  const apiMetrics = await page.evaluate(async () => {
    const response = await fetch('/api/metrics?format=json');
    return response.json();
  });
  
  console.log('📈 Performance Test Results:');
  console.log('================================');
  console.log(`Total Drawings: ${metrics.drawingCount}`);
  console.log(`Total Time: ${totalTime}ms`);
  console.log(`Average FPS: ${metrics.avgFPS}`);
  console.log(`Minimum FPS: ${metrics.minFPS}`);
  console.log(`Memory Usage: ${startMemory.toFixed(1)}MB → ${endMemory}MB (+${memoryIncrease.toFixed(1)}MB)`);
  console.log(`Success Count: ${apiMetrics.drawing_success_total?.value || 0}`);
  console.log(`Failed Count: ${apiMetrics.drawing_failed_total?.value || 0}`);
  console.log('================================\n');
  
  // Performance thresholds
  const passed = metrics.avgFPS >= 55 && metrics.minFPS >= 30;
  
  if (passed) {
    console.log('✅ Performance test PASSED! FPS > 55');
  } else {
    console.log('❌ Performance test FAILED! FPS < 55');
    console.log('   Consider optimizing rendering or reducing drawing complexity');
  }
  
  // Take screenshot
  await page.screenshot({ 
    path: 'performance-test-result.png',
    fullPage: true 
  });
  console.log('\n📸 Screenshot saved to performance-test-result.png');
  
  await browser.close();
  
  process.exit(passed ? 0 : 1);
}

// Run the test
runPerformanceTest().catch(error => {
  console.error('❌ Performance test failed:', error);
  process.exit(1);
});