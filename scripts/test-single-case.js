#!/usr/bin/env node

/**
 * 単一ケースの複数描画テスト
 */

const API_URL = 'http://localhost:3000/api/ai/chat';

async function testSingleCase() {
  // Dynamic import for node-fetch
  const fetch = (await import('node-fetch')).default;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Test: 5本のトレンドラインを引いて`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "5本のトレンドラインを引いて",
        sessionId: 'test-session',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`\n❌ HTTP error! status: ${response.status}`);
      console.error(`Error details: ${errorText}`);
      return;
    }

    const data = await response.json();
    
    console.log('\n📊 Result:');
    console.log(`💬 Response: ${data.message}`);
    console.log(`🎯 Selected Agent: ${data.selectedAgent}`);
    console.log(`🔍 Intent: ${data.analysis?.intent} (confidence: ${data.analysis?.confidence})`);
    
    // Check execution data for operations
    if (data.execution && data.data) {
      console.log(`\n🔧 Execution Data:`);
      console.log(`- Success: ${data.execution.success}`);
      console.log(`- Execution Time: ${data.execution.executionTime}ms`);
      
      if (data.data.operations && data.data.operations.length > 0) {
        console.log(`\n📋 Operations (${data.data.operations.length}):`);
        
        data.data.operations.forEach((op, index) => {
          console.log(`\n  Operation ${index + 1}:`);
          console.log(`  - Type: ${op.type}`);
          console.log(`  - Action: ${op.action}`);
          console.log(`  - Description: ${op.description}`);
          
          if (op.parameters?.drawings) {
            console.log(`  - Multiple Drawings: ${op.parameters.drawings.length} items`);
            console.log(`  - clientEvent.data.multiple: ${op.clientEvent?.data?.multiple}`);
            
            op.parameters.drawings.forEach((drawing, idx) => {
              console.log(`    Drawing ${idx + 1}:`);
              console.log(`      - ID: ${drawing.id}`);
              console.log(`      - Description: ${drawing.description || 'N/A'}`);
              console.log(`      - Color: ${drawing.style?.color}`);
            });
          }
        });
      } else {
        console.log('\n⚠️  No operations found in data');
      }
    } else {
      console.log('\n⚠️  No execution data found');
    }
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Run test
testSingleCase().then(() => {
  console.log('\n✅ Test completed!');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});