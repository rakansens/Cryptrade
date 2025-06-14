#!/usr/bin/env node

/**
 * Test script to verify agent tool usage
 */

const { Agent } = require('@mastra/core');
const { openai } = require('@ai-sdk/openai');
const { createTool } = require('@mastra/core');
const { z } = require('zod');

// Create a simple test tool
const testPriceTool = createTool({
  id: 'test-price-tool',
  name: 'testPriceTool',
  description: 'Get test price for a symbol',
  inputSchema: z.object({
    symbol: z.string()
  }),
  outputSchema: z.object({
    symbol: z.string(),
    price: z.number()
  }),
  execute: async ({ context }) => {
    console.log('[TestPriceTool] Called with:', context);
    
    // Return fixed prices for testing
    const prices = {
      'BTCUSDT': 105372.23,
      'ETHUSDT': 2616.38,
    };
    
    return {
      symbol: context.symbol,
      price: prices[context.symbol] || 99999.99
    };
  }
});

// Create test agent
const testAgent = new Agent({
  name: 'test-price-agent',
  model: openai('gpt-4o-mini'),
  instructions: `
You are a price query agent. When asked about cryptocurrency prices:
1. Use the testPriceTool to get the current price
2. Return the price in a natural response
3. Always include the exact price from the tool

IMPORTANT: You MUST use the testPriceTool to get prices. Do not make up prices.
  `,
  tools: {
    testPriceTool
  }
});

// Test the agent
async function testAgentWithTool() {
  console.log('Testing agent with tool...\n');
  
  try {
    const messages = [
      {
        role: 'user',
        content: 'What is the current price of BTC? Use BTCUSDT symbol.'
      }
    ];
    
    console.log('Sending message to agent...');
    const response = await testAgent.generate(messages, {
      maxSteps: 5,
      experimental_telemetry: { isEnabled: false }
    });
    
    console.log('\nAgent response:');
    console.log('Type:', typeof response);
    console.log('Response object:', JSON.stringify(response, null, 2));
    
    if (response.text) {
      console.log('\nResponse text:', response.text);
    }
    
    if (response.toolCalls) {
      console.log('\nTool calls:', response.toolCalls);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run test
testAgentWithTool();