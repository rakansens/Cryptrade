#!/usr/bin/env ts-node
/**
 * Test script for conversation flow improvements
 * Tests the improved orchestrator with various conversation scenarios
 */

import { executeImprovedOrchestrator } from '@/lib/mastra/agents/orchestrator.agent';
import { createEnhancedSession } from '@/lib/store/enhanced-conversation-memory.store';
import { logger } from '@/lib/utils/logger';

interface TestCase {
  id: string;
  description: string;
  messages: Array<{
    input: string;
    expectedIntent?: string;
    expectResponse?: boolean;
  }>;
}

const testCases: TestCase[] = [
  {
    id: 'greeting-flow',
    description: 'Greeting and casual conversation',
    messages: [
      { input: 'こんにちは！', expectedIntent: 'conversational', expectResponse: true },
      { input: '今日はいい天気ですね', expectedIntent: 'conversational', expectResponse: true },
      { input: '最近の市場はどうですか？', expectedIntent: 'conversational', expectResponse: true },
    ],
  },
  {
    id: 'price-inquiry-flow',
    description: 'Price inquiry conversation',
    messages: [
      { input: 'BTCの価格を教えて', expectedIntent: 'price_inquiry', expectResponse: true },
      { input: 'それは高いですね', expectedIntent: 'conversational', expectResponse: true },
      { input: 'ETHはどう？', expectedIntent: 'price_inquiry', expectResponse: true },
    ],
  },
  {
    id: 'mixed-flow',
    description: 'Mixed technical and casual conversation',
    messages: [
      { input: 'こんにちは', expectedIntent: 'conversational', expectResponse: true },
      { input: 'BTCの分析をお願いします', expectedIntent: 'trading_analysis', expectResponse: true },
      { input: 'ありがとう！', expectedIntent: 'conversational', expectResponse: true },
      { input: 'また明日聞きます', expectedIntent: 'conversational', expectResponse: true },
    ],
  },
  {
    id: 'error-recovery',
    description: 'Error recovery test',
    messages: [
      { input: 'XYZABCの価格', expectedIntent: 'price_inquiry', expectResponse: true },
      { input: '存在しない通貨でした', expectedIntent: 'conversational', expectResponse: true },
      { input: 'BTCの価格を教えて', expectedIntent: 'price_inquiry', expectResponse: true },
    ],
  },
];

async function runTests() {
  console.log('🧪 Testing Conversation Flow Improvements\n');
  
  const results = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    responseFailures: 0,
    intentMismatches: 0,
  };

  for (const testCase of testCases) {
    console.log(`\n📋 Test Case: ${testCase.description} (${testCase.id})`);
    console.log('━'.repeat(50));
    
    // Create a new session for each test case
    const sessionId = await createEnhancedSession();
    
    for (let i = 0; i < testCase.messages.length; i++) {
      const message = testCase.messages[i];
      results.totalTests++;
      
      console.log(`\n🔹 Turn ${i + 1}: "${message?.input}"`);
      
      try {
        const startTime = Date.now();
        const result = await executeImprovedOrchestrator(
          message?.input || '',
          sessionId
        );
        const responseTime = Date.now() - startTime;
        
        // Check if we got a response
        const hasResponse = !!(
          result.executionResult?.response || 
          (result.executionResult as any)?.executionResult?.response ||
          (result.executionResult as any)?.message
        );
        
        const response = 
          result.executionResult?.response || 
          (result.executionResult as any)?.executionResult?.response ||
          (result.executionResult as any)?.message ||
          'No response';
        
        // Check intent match
        const intentMatch = !message?.expectedIntent || 
          result.analysis.intent === message?.expectedIntent ||
          (result.analysis.intent === 'conversational' && 
           ['greeting', 'small_talk', 'market_chat', 'help_request'].includes(message?.expectedIntent || ''));
        
        // Check response exists
        const responseExists = !message?.expectResponse || 
          (hasResponse && response !== 'No response');
        
        if (intentMatch && responseExists) {
          results.passed++;
          console.log(`✅ PASS - Intent: ${result.analysis.intent}, Time: ${responseTime}ms`);
        } else {
          results.failed++;
          if (!intentMatch) {
            results.intentMismatches++;
            console.log(`❌ FAIL - Intent mismatch: expected ${message?.expectedIntent}, got ${result.analysis.intent}`);
          }
          if (!responseExists) {
            results.responseFailures++;
            console.log(`❌ FAIL - No response returned`);
          }
        }
        
        console.log(`   Response: ${response.substring(0, 100)}...`);
        console.log(`   Confidence: ${result.analysis.confidence}`);
        
      } catch (error) {
        results.failed++;
        results.responseFailures++;
        console.log(`❌ ERROR: ${error}`);
      }
    }
  }
  
  // Calculate metrics
  const successRate = (results.passed / results.totalTests) * 100;
  const responseRate = ((results.totalTests - results.responseFailures) / results.totalTests) * 100;
  const intentAccuracy = ((results.totalTests - results.intentMismatches) / results.totalTests) * 100;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.totalTests}`);
  console.log(`Passed: ${results.passed} (${successRate.toFixed(1)}%)`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Response Failures: ${results.responseFailures} (${(100 - responseRate).toFixed(1)}%)`);
  console.log(`Intent Mismatches: ${results.intentMismatches} (${(100 - intentAccuracy).toFixed(1)}%)`);
  console.log('');
  console.log(`✨ Success Rate: ${successRate.toFixed(1)}%`);
  console.log(`📡 Response Rate: ${responseRate.toFixed(1)}%`);
  console.log(`🎯 Intent Accuracy: ${intentAccuracy.toFixed(1)}%`);
  
  if (successRate >= 95) {
    console.log('\n🎉 SUCCESS: Failure rate is under 5%!');
  } else {
    console.log(`\n⚠️  NEEDS IMPROVEMENT: Failure rate is ${(100 - successRate).toFixed(1)}%`);
  }
}

// Run the tests
runTests().catch(error => {
  logger.error('Test execution failed', { error: String(error) });
  process.exit(1);
});