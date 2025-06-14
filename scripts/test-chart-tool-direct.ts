#!/usr/bin/env tsx

/**
 * Direct test of enhanced chart control tool
 */

import { enhancedChartControlTool } from '../lib/mastra/tools/enhanced-chart-control.tool';

async function testDirectTool() {
  console.log('🧪 Testing Enhanced Chart Control Tool Directly\n');
  
  try {
    // Test simple trendline request
    console.log('📝 Test: "トレンドラインを引いて"');
    
    const result = await enhancedChartControlTool.execute({
      context: {
        userRequest: 'トレンドラインを引いて',
        conversationHistory: [],
        currentState: {
          symbol: 'BTCUSDT',
          timeframe: '1h'
        }
      }
    });
    
    console.log('\n✅ Tool Result:');
    console.log('Success:', result.success);
    console.log('Response:', result.response);
    console.log('Operations count:', result.operations.length);
    
    if (result.operations.length > 0) {
      console.log('\n📊 Operations:');
      result.operations.forEach((op, idx) => {
        console.log(`\nOperation ${idx + 1}:`);
        console.log('- Type:', op.type);
        console.log('- Action:', op.action);
        console.log('- Has points:', !!op.parameters?.points);
        console.log('- Execution mode:', op.executionMode);
        
        if (op.clientEvent) {
          console.log('- Client event:', op.clientEvent.event);
          console.log('- Event has points:', !!op.clientEvent.data?.points);
          
          if (op.clientEvent.data?.points) {
            console.log('- Points:', JSON.stringify(op.clientEvent.data.points, null, 2));
          }
        }
      });
    }
    
    // Check results
    const hasProperDrawEvent = result.operations.some(op => 
      op.clientEvent?.event === 'draw:trendline' && 
      op.clientEvent?.data?.points?.length > 0
    );
    
    console.log('\n🎯 Final Result:');
    if (hasProperDrawEvent) {
      console.log('✅ SUCCESS: Tool generates draw:trendline event with coordinates!');
    } else {
      console.log('❌ FAILURE: Tool only generates chart:startDrawing without coordinates');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run test
testDirectTool();