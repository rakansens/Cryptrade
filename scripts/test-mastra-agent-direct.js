#!/usr/bin/env node

/**
 * Test Mastra agent directly with marketDataResilientTool
 */

const { priceInquiryAgent } = require('../lib/mastra/network/agent-registry');

async function testPriceInquiryAgent() {
  console.log('Testing priceInquiryAgent directly...\n');
  
  try {
    const messages = [
      {
        role: 'user',
        content: 'BTCの価格を教えて'
      }
    ];
    
    console.log('Sending message to priceInquiryAgent...');
    const response = await priceInquiryAgent.generate(messages, {
      maxSteps: 5,
      experimental_telemetry: { isEnabled: false }
    });
    
    console.log('\nResponse type:', typeof response);
    console.log('\nResponse text:', response.text);
    
    if (response.steps) {
      console.log('\nSteps:', response.steps.length);
      response.steps.forEach((step, i) => {
        console.log(`\nStep ${i}:`, {
          stepType: step.stepType,
          hasToolCalls: step.toolCalls?.length > 0,
          hasToolResults: step.toolResults?.length > 0,
          toolResults: step.toolResults?.map(tr => ({
            toolName: tr.toolName,
            result: tr.result
          }))
        });
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testPriceInquiryAgent();