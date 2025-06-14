#!/usr/bin/env node

/**
 * Test script to verify enhanced chart control fixes
 * Tests that "トレンドラインを引いて" generates actual coordinates
 */

async function testChartControl() {
  console.log('🧪 Testing Enhanced Chart Control Fix\n');
  
  // First check if server is running
  try {
    await fetch('http://localhost:3001');
  } catch (err) {
    console.log('❌ Server not reachable at http://localhost:3001');
    console.log('💡 Please make sure the development server is running with: npm run dev');
    process.exit(1);
  }
  
  try {
    // Test 1: Simple trendline request
    console.log('📝 Test 1: Simple trendline request ("トレンドラインを引いて")');
    const response = await fetch('http://localhost:3001/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'トレンドラインを引いて' }
        ],
        isStreamMode: false
      })
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    
    if (data.response) {
      console.log('AI Response:', data.response);
    }
    
    if (data.operations) {
      console.log('\nOperations generated:');
      data.operations.forEach((op, idx) => {
        console.log(`\nOperation ${idx + 1}:`, {
          type: op.type,
          action: op.action,
          hasPoints: !!op.parameters?.points,
          hasClientEvent: !!op.clientEvent,
          eventType: op.clientEvent?.event,
          pointCount: op.parameters?.points?.length
        });
        
        if (op.parameters?.points) {
          console.log('Points:', JSON.stringify(op.parameters.points, null, 2));
        }
        
        if (op.clientEvent) {
          console.log('Client Event:', {
            event: op.clientEvent.event,
            hasData: !!op.clientEvent.data,
            hasPoints: !!op.clientEvent.data?.points
          });
        }
      });
    }

    // Check if the fix is working
    const hasDrawEvent = data.operations?.some(op => 
      op.clientEvent?.event === 'draw:trendline' && 
      op.clientEvent?.data?.points?.length > 0
    );
    
    const hasStartDrawingOnly = data.operations?.some(op => 
      op.clientEvent?.event === 'chart:startDrawing' &&
      !op.parameters?.points
    );
    
    console.log('\n✅ Test Results:');
    console.log(`- Has draw:trendline with points: ${hasDrawEvent ? '✅ YES' : '❌ NO'}`);
    console.log(`- Only has chart:startDrawing: ${hasStartDrawingOnly ? '❌ YES (BAD)' : '✅ NO (GOOD)'}`);
    
    if (hasDrawEvent) {
      console.log('\n🎉 SUCCESS: The fix is working! Trendline coordinates are being generated.');
    } else {
      console.log('\n❌ FAILURE: Still falling back to chart:startDrawing without coordinates.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Make sure the development server is running on port 3001');
    }
  }
}

// Run the test
testChartControl();