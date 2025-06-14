#!/usr/bin/env node

// Test script to verify pattern deletion with metric lines

const puppeteer = require('puppeteer');

async function testPatternDeletion() {
  console.log('🚀 Starting pattern deletion test...');
  
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[PatternRenderer]') || text.includes('[Agent Event]') || text.includes('[ChatPanel]')) {
      console.log(`[Browser Console] ${text}`);
    }
  });
  
  // Navigate to the application
  await page.goto('http://localhost:3001');
  await page.waitForTimeout(3000);
  
  console.log('📊 Page loaded, creating pattern with metrics...');
  
  // Create a pattern with metrics
  await page.evaluate(() => {
    // Simulate pattern creation with metrics
    const patternId = `drawing_pattern_${Date.now()}_test123`;
    
    const patternEvent = new CustomEvent('chart:addPattern', {
      detail: {
        id: patternId,
        pattern: {
          type: 'head_and_shoulders',
          visualization: {
            keyPoints: [
              { time: Date.now() / 1000 - 3600, value: 100, type: 'trough' },
              { time: Date.now() / 1000 - 2400, value: 110, type: 'peak' },
              { time: Date.now() / 1000 - 1200, value: 105, type: 'trough' },
              { time: Date.now() / 1000, value: 112, type: 'peak' }
            ],
            lines: [
              { from: 0, to: 1, type: 'outline', style: { color: '#888888', lineWidth: 2, lineStyle: 'solid' } },
              { from: 1, to: 2, type: 'outline', style: { color: '#888888', lineWidth: 2, lineStyle: 'solid' } },
              { from: 2, to: 3, type: 'outline', style: { color: '#888888', lineWidth: 2, lineStyle: 'solid' } }
            ]
          },
          metrics: {
            target_level: 120,
            stop_loss: 95,
            breakout_level: 108
          }
        }
      }
    });
    
    window.dispatchEvent(patternEvent);
    window.__testPatternId = patternId;
    
    console.log('Pattern created with ID:', patternId);
  });
  
  await page.waitForTimeout(2000);
  
  // Check if pattern and metric lines are rendered
  const patternState = await page.evaluate(() => {
    if (window.__debugPatternRenderer) {
      return window.__debugPatternRenderer.debugGetState();
    }
    return null;
  });
  
  console.log('📈 Pattern state after creation:', JSON.stringify(patternState, null, 2));
  
  // Now delete the pattern
  console.log('🗑️ Deleting pattern...');
  
  await page.evaluate(() => {
    const deleteEvent = new CustomEvent('chart:deleteDrawing', {
      detail: {
        id: window.__testPatternId
      }
    });
    
    window.dispatchEvent(deleteEvent);
  });
  
  await page.waitForTimeout(2000);
  
  // Check if pattern and metric lines are removed
  const patternStateAfterDelete = await page.evaluate(() => {
    if (window.__debugPatternRenderer) {
      return window.__debugPatternRenderer.debugGetState();
    }
    return null;
  });
  
  console.log('📉 Pattern state after deletion:', JSON.stringify(patternStateAfterDelete, null, 2));
  
  // Verify deletion
  if (patternStateAfterDelete) {
    const hasPattern = patternStateAfterDelete.patternSeries.includes(window.__testPatternId);
    const hasMetricLines = patternStateAfterDelete.metricLines.includes(window.__testPatternId);
    const hasGlobalMetricLines = patternStateAfterDelete.globalMetricLines.includes(window.__testPatternId);
    
    console.log('\n✅ Deletion verification:');
    console.log(`  Pattern series removed: ${!hasPattern ? '✓' : '✗'}`);
    console.log(`  Metric lines removed: ${!hasMetricLines ? '✓' : '✗'}`);
    console.log(`  Global metric lines removed: ${!hasGlobalMetricLines ? '✓' : '✗'}`);
    
    if (hasPattern || hasMetricLines || hasGlobalMetricLines) {
      console.log('\n❌ FAILED: Some elements were not properly removed!');
    } else {
      console.log('\n✅ SUCCESS: All pattern elements were properly removed!');
    }
  }
  
  console.log('\n🏁 Test complete. Press Ctrl+C to exit.');
}

// Run the test
testPatternDeletion().catch(console.error);