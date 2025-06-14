#!/usr/bin/env node

/**
 * シンプルな複数描画テスト
 */

async function testMultipleDrawings() {
  const fetch = (await import('node-fetch')).default;
  
  console.log('🧪 Testing: 5本のトレンドラインを引いて');
  
  try {
    console.log('\n📤 Sending request to API...');
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: '5本のトレンドラインを引いて',
        sessionId: 'test-multiple-drawings',
      }),
    });

    const elapsedTime = Date.now() - startTime;
    console.log(`⏱️  Response time: ${elapsedTime}ms`);

    if (!response.ok) {
      console.error(`❌ HTTP error! status: ${response.status}`);
      const errorText = await response.text();
      console.error(`Error details: ${errorText}`);
      return;
    }

    const data = await response.json();
    
    console.log('\n✅ Response received:');
    console.log(`📝 Message: ${data.message}`);
    console.log(`🎯 Intent: ${data.analysis?.intent} (confidence: ${data.analysis?.confidence})`);
    console.log(`⚡ Execution time: ${data.execution?.executionTime}ms`);
    
    // Check if operations were generated
    if (data.data?.operations) {
      console.log(`\n📊 Operations: ${data.data.operations.length}`);
      data.data.operations.forEach((op, idx) => {
        console.log(`  ${idx + 1}. ${op.type} - ${op.action}`);
        if (op.parameters?.drawings) {
          console.log(`     Multiple drawings: ${op.parameters.drawings.length}`);
        }
      });
    } else if (data.execution?.executionResult?.data?.operations) {
      console.log(`\n📊 Operations: ${data.execution.executionResult.data.operations.length}`);
    } else {
      console.log('\n⚠️  No operations found in response');
      console.log('Response keys:', Object.keys(data));
      if (data.execution) {
        console.log('Execution keys:', Object.keys(data.execution));
      }
    }
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
  }
}

// Listen for SSE events in parallel
async function listenForEvents() {
  const { EventSource } = require('eventsource');
  const eventSource = new EventSource('http://localhost:3000/api/ui-events');
  
  console.log('\n👂 Listening for SSE events...');
  
  eventSource.addEventListener('ui-event', (event) => {
    const payload = JSON.parse(event.data);
    if (payload.event === 'draw:trendline') {
      console.log('\n🎨 Drawing event received!');
      console.log(`- Multiple: ${payload.data?.multiple || false}`);
      console.log(`- Drawings: ${payload.data?.drawings?.length || 1}`);
      if (payload.data?.multiple && payload.data?.drawings) {
        payload.data.drawings.forEach((d, i) => {
          console.log(`  ${i + 1}. ${d.id} - ${d.description || 'N/A'}`);
        });
      }
    }
  });
  
  // Give it 10 seconds to receive events
  return new Promise(resolve => {
    setTimeout(() => {
      eventSource.close();
      console.log('\n👋 Event listener closed');
      resolve();
    }, 10000);
  });
}

// Run both in parallel
Promise.all([
  testMultipleDrawings(),
  listenForEvents()
]).then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
});