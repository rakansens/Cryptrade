#!/usr/bin/env node

/**
 * Error Handling Test Script
 * Tests various error scenarios across the agent system
 */

import { AgentNetwork } from '@/lib/mastra/network/message-router';
import { ErrorTracker } from '@/lib/errors/error-tracker';
import { withRetry, CircuitBreaker } from '@/lib/api/retry';
import { logger } from '@/lib/utils/logger';
import { Agent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';

// Test configuration
const TEST_CONFIG = {
  verbose: true,
  testTimeout: 30000,
  scenarios: {
    networkTimeout: true,
    agentFailure: true,
    circularRouting: true,
    toolError: true,
    memoryError: true,
    gracefulDegradation: true
  }
};

// Test results collector
const testResults = {
  passed: 0,
  failed: 0,
  scenarios: [] as Array<{
    name: string;
    passed: boolean;
    error?: string;
    details?: any;
  }>
};

// Helper to run test scenario
async function runScenario(
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  console.log(`\n🧪 Testing: ${name}`);
  
  try {
    await testFn();
    testResults.passed++;
    testResults.scenarios.push({ name, passed: true });
    console.log(`✅ PASSED: ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.scenarios.push({
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    });
    console.error(`❌ FAILED: ${name}`, error);
  }
}

// Test Scenarios

async function testNetworkTimeout() {
  const network = new AgentNetwork({ timeout: 100 }); // Very short timeout
  
  // Create a slow agent
  const slowAgent = new Agent({
    name: 'slow-agent',
    model: openai('gpt-4o-mini'),
    instructions: 'You are a test agent that responds slowly'
  });
  
  network.registerAgent('slowAgent', slowAgent, ['test'], 'Slow test agent');
  
  // Override generate to simulate slow response
  (slowAgent as any).generate = async () => {
    await new Promise(resolve => setTimeout(resolve, 200)); // Longer than timeout
    return { text: 'This should timeout' };
  };
  
  const result = await network.sendMessage(
    'test-source',
    'slowAgent',
    'test_method'
  );
  
  if (result?.type !== 'error') {
    throw new Error('Expected timeout error');
  }
  
  console.log('  ✓ Network timeout handled correctly');
}

async function testAgentRegistrationFailure() {
  const network = new AgentNetwork();
  
  // Try to send message to non-existent agent
  const result = await network.sendMessage(
    'test-source',
    'non-existent-agent',
    'test_method'
  );
  
  if (result !== null) {
    throw new Error('Expected null result for non-existent agent');
  }
  
  console.log('  ✓ Non-existent agent handled correctly');
}

async function testCircularRouting() {
  const network = new AgentNetwork({ maxHops: 3 });
  
  // Create agents that route to each other
  const agentA = new Agent({
    name: 'agent-a',
    model: openai('gpt-4o-mini'),
    instructions: 'Always route to agent-b'
  });
  
  const agentB = new Agent({
    name: 'agent-b',
    model: openai('gpt-4o-mini'),
    instructions: 'Always route to agent-a'
  });
  
  network.registerAgent('agentA', agentA, ['routing'], 'Routes to B');
  network.registerAgent('agentB', agentB, ['routing'], 'Routes to A');
  
  // This should hit max hops limit
  let hopCount = 0;
  const originalSend = network.sendMessage.bind(network);
  
  (network as any).sendMessage = async (...args: any[]) => {
    hopCount++;
    if (hopCount > 5) {
      throw new Error('Circular routing not prevented!');
    }
    return originalSend(...args);
  };
  
  await network.sendMessage('test', 'agentA', 'process_query', {
    query: 'Test circular routing'
  });
  
  console.log(`  ✓ Circular routing prevented after ${hopCount} hops`);
}

async function testRetryMechanism() {
  let attempts = 0;
  
  const failingOperation = async () => {
    attempts++;
    if (attempts < 3) {
      throw new Error('ETIMEDOUT: Connection timeout');
    }
    return 'Success after retries';
  };
  
  const result = await withRetry(failingOperation, {
    maxAttempts: 3,
    baseDelay: 100
  });
  
  if (result !== 'Success after retries' || attempts !== 3) {
    throw new Error('Retry mechanism not working correctly');
  }
  
  console.log('  ✓ Retry mechanism working correctly');
}

async function testCircuitBreaker() {
  const breaker = new CircuitBreaker(3, 1000);
  let failureCount = 0;
  
  // Operation that fails initially
  const operation = async () => {
    failureCount++;
    if (failureCount <= 3) {
      throw new Error('Service unavailable');
    }
    return 'Success';
  };
  
  // Trigger failures to open circuit
  for (let i = 0; i < 3; i++) {
    try {
      await breaker.execute(operation);
    } catch (e) {
      // Expected failures
    }
  }
  
  // Circuit should be open now
  try {
    await breaker.execute(operation);
    throw new Error('Circuit breaker should be open');
  } catch (error) {
    if (!error.message.includes('Circuit breaker is OPEN')) {
      throw error;
    }
  }
  
  console.log('  ✓ Circuit breaker working correctly');
}

async function testErrorTracking() {
  const tracker = ErrorTracker.getInstance();
  
  // Track various errors
  tracker.trackException(new Error('Test error 1'), {
    agentName: 'testAgent',
    toolName: 'testTool'
  });
  
  tracker.trackException(new Error('Test error 2'), {
    endpoint: '/api/test',
    statusCode: 500
  });
  
  const stats = tracker.getStats();
  
  if (stats.total < 2) {
    throw new Error('Error tracking not recording properly');
  }
  
  console.log('  ✓ Error tracking working correctly');
  console.log(`    - Total errors tracked: ${stats.total}`);
}

async function testGracefulDegradation() {
  const network = new AgentNetwork();
  
  // Register primary and fallback agents
  const primaryAgent = new Agent({
    name: 'primary',
    model: openai('gpt-4o-mini'),
    instructions: 'Primary agent'
  });
  
  const fallbackAgent = new Agent({
    name: 'orchestratorAgent',
    model: openai('gpt-4o-mini'),
    instructions: 'Fallback orchestrator'
  });
  
  network.registerAgent('primary', primaryAgent, ['main'], 'Primary agent');
  network.registerAgent('orchestratorAgent', fallbackAgent, ['fallback'], 'Fallback');
  
  // Make primary agent fail
  (primaryAgent as any).generate = async () => {
    throw new Error('Primary agent failure');
  };
  
  // Should route to fallback
  const agentId = await network.selectAgent('test query', {});
  
  if (!agentId) {
    throw new Error('No fallback agent selected');
  }
  
  console.log(`  ✓ Graceful degradation to ${agentId}`);
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Error Handling Tests\n');
  
  if (TEST_CONFIG.scenarios.networkTimeout) {
    await runScenario('Network Timeout Handling', testNetworkTimeout);
  }
  
  if (TEST_CONFIG.scenarios.agentFailure) {
    await runScenario('Agent Registration Failure', testAgentRegistrationFailure);
  }
  
  if (TEST_CONFIG.scenarios.circularRouting) {
    await runScenario('Circular Routing Prevention', testCircularRouting);
  }
  
  await runScenario('Retry Mechanism', testRetryMechanism);
  
  await runScenario('Circuit Breaker', testCircuitBreaker);
  
  await runScenario('Error Tracking', testErrorTracking);
  
  if (TEST_CONFIG.scenarios.gracefulDegradation) {
    await runScenario('Graceful Degradation', testGracefulDegradation);
  }
  
  // Print summary
  console.log('\n📊 Test Summary:');
  console.log(`  ✅ Passed: ${testResults.passed}`);
  console.log(`  ❌ Failed: ${testResults.failed}`);
  console.log(`  📈 Total: ${testResults.passed + testResults.failed}`);
  
  // Save results
  const fs = await import('fs');
  fs.writeFileSync(
    'error-handling-test-results.json',
    JSON.stringify(testResults, null, 2)
  );
  
  console.log('\n💾 Results saved to error-handling-test-results.json');
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});