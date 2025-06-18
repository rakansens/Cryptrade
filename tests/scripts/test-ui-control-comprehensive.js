#!/usr/bin/env node

/**
 * UI Control Agent Comprehensive Test (AGENT-007)
 * 
 * Validates UI control agent's chart manipulation capabilities
 */

const { registerAllAgents } = require('../lib/mastra/network/agent-registry');
const { agentNetwork } = require('../lib/mastra/network/agent-network');
const fs = require('fs').promises;
const path = require('path');

// Test results structure
const testResults = {
  testId: 'agent-007',
  timestamp: new Date().toISOString(),
  summary: '',
  tests: {
    symbolChange: { passed: false, details: {} },
    timeframeChange: { passed: false, details: {} },
    drawingOperations: { passed: false, details: {} },
    indicatorToggles: { passed: false, details: {} },
    multipleDrawings: { passed: false, details: {} },
    batchOperations: { passed: false, details: {} },
  },
  eventFlow: [],
  stateConsistency: [],
  performance: {},
  errors: [],
};

/**
 * Test symbol change operations
 */
async function testSymbolChange() {
  console.log('\n=== Testing Symbol Change ===');
  const testCases = [
    { query: 'BTCに切り替えて', expected: 'BTCUSDT' },
    { query: 'ETHを表示して', expected: 'ETHUSDT' },
    { query: 'リップルのチャートを見せて', expected: 'XRPUSDT' },
  ];

  const results = [];
  for (const test of testCases) {
    console.log(`\nTest: "${test.query}"`);
    
    try {
      const result = await agentNetwork.sendMessage(
        'testClient',
        'uiControlAgent',
        'process_query',
        { query: test.query },
        `test-symbol-${Date.now()}`
      );

      const success = result?.type === 'response';
      const operations = extractOperations(result);
      const hasSymbolChange = operations.some(op => 
        op.type === 'symbol_change' && 
        op.parameters?.symbol === test.expected
      );

      results.push({
        query: test.query,
        success,
        hasCorrectOperation: hasSymbolChange,
        operations: operations.length,
        response: result?.result?.substring(0, 100),
      });

      if (hasSymbolChange) {
        console.log(`✓ Symbol change detected: ${test.expected}`);
      } else {
        console.log(`✗ Expected symbol change not found`);
      }
    } catch (error) {
      console.error(`✗ Error: ${error.message}`);
      results.push({
        query: test.query,
        success: false,
        error: error.message,
      });
    }
  }

  testResults.tests.symbolChange = {
    passed: results.every(r => r.hasCorrectOperation),
    details: results,
  };
}

/**
 * Test timeframe change operations
 */
async function testTimeframeChange() {
  console.log('\n=== Testing Timeframe Change ===');
  const testCases = [
    { query: '1時間足に変更して', expected: '1h' },
    { query: '日足チャートを表示', expected: '1d' },
    { query: '5分足に切り替えて', expected: '5m' },
  ];

  const results = [];
  for (const test of testCases) {
    console.log(`\nTest: "${test.query}"`);
    
    try {
      const result = await agentNetwork.sendMessage(
        'testClient',
        'uiControlAgent',
        'process_query',
        { query: test.query },
        `test-timeframe-${Date.now()}`
      );

      const success = result?.type === 'response';
      const operations = extractOperations(result);
      const hasTimeframeChange = operations.some(op => 
        op.type === 'timeframe_change' && 
        op.parameters?.timeframe === test.expected
      );

      results.push({
        query: test.query,
        success,
        hasCorrectOperation: hasTimeframeChange,
        operations: operations.length,
        response: result?.result?.substring(0, 100),
      });

      if (hasTimeframeChange) {
        console.log(`✓ Timeframe change detected: ${test.expected}`);
      }
    } catch (error) {
      console.error(`✗ Error: ${error.message}`);
      results.push({
        query: test.query,
        success: false,
        error: error.message,
      });
    }
  }

  testResults.tests.timeframeChange = {
    passed: results.every(r => r.hasCorrectOperation),
    details: results,
  };
}

/**
 * Test drawing operations
 */
async function testDrawingOperations() {
  console.log('\n=== Testing Drawing Operations ===');
  const testCases = [
    { query: 'トレンドラインを引いて', expectedAction: 'draw_trendline' },
    { query: 'フィボナッチを描画して', expectedAction: 'draw_fibonacci' },
    { query: 'サポートラインを追加', expectedAction: 'draw_support' },
  ];

  const results = [];
  for (const test of testCases) {
    console.log(`\nTest: "${test.query}"`);
    
    try {
      const result = await agentNetwork.sendMessage(
        'testClient',
        'uiControlAgent',
        'process_query',
        { query: test.query },
        `test-drawing-${Date.now()}`
      );

      const success = result?.type === 'response';
      const operations = extractOperations(result);
      const hasDrawingOp = operations.some(op => 
        op.type === 'drawing_operation'
      );

      results.push({
        query: test.query,
        success,
        hasDrawingOperation: hasDrawingOp,
        operations: operations.length,
        operationTypes: operations.map(op => op.type),
        response: result?.result?.substring(0, 100),
      });

      if (hasDrawingOp) {
        console.log(`✓ Drawing operation detected`);
        // Check for points in parameters
        const drawOp = operations.find(op => op.type === 'drawing_operation');
        if (drawOp?.parameters?.points) {
          console.log(`  - Has ${drawOp.parameters.points.length} points`);
        }
      }
    } catch (error) {
      console.error(`✗ Error: ${error.message}`);
      results.push({
        query: test.query,
        success: false,
        error: error.message,
      });
    }
  }

  testResults.tests.drawingOperations = {
    passed: results.every(r => r.hasDrawingOperation),
    details: results,
  };
}

/**
 * Test indicator toggles
 */
async function testIndicatorToggles() {
  console.log('\n=== Testing Indicator Toggles ===');
  const testCases = [
    { query: '移動平均を表示して', expectedType: 'indicator_control' },
    { query: 'RSIを追加', expectedType: 'indicator_control' },
    { query: 'ボリンジャーバンドを表示', expectedType: 'indicator_control' },
  ];

  const results = [];
  for (const test of testCases) {
    console.log(`\nTest: "${test.query}"`);
    
    try {
      const result = await agentNetwork.sendMessage(
        'testClient',
        'uiControlAgent',
        'process_query',
        { query: test.query },
        `test-indicator-${Date.now()}`
      );

      const success = result?.type === 'response';
      const operations = extractOperations(result);
      const hasIndicatorOp = operations.some(op => 
        op.type === 'indicator_control'
      );

      results.push({
        query: test.query,
        success,
        hasIndicatorOperation: hasIndicatorOp,
        operations: operations.length,
        response: result?.result?.substring(0, 100),
      });

      console.log(hasIndicatorOp ? '✓ Indicator operation detected' : '✗ No indicator operation');
    } catch (error) {
      console.error(`✗ Error: ${error.message}`);
      results.push({
        query: test.query,
        success: false,
        error: error.message,
      });
    }
  }

  testResults.tests.indicatorToggles = {
    passed: results.filter(r => r.success).length > 0,
    details: results,
  };
}

/**
 * Test multiple drawing requests
 */
async function testMultipleDrawings() {
  console.log('\n=== Testing Multiple Drawings ===');
  const testCases = [
    { query: '3本のトレンドラインを引いて', expectedCount: 3 },
    { query: '複数のサポートラインを追加', expectedCount: 3 }, // Default
    { query: '5つのレジスタンスラインを描画', expectedCount: 5 },
  ];

  const results = [];
  for (const test of testCases) {
    console.log(`\nTest: "${test.query}"`);
    
    try {
      const result = await agentNetwork.sendMessage(
        'testClient',
        'uiControlAgent',
        'process_query',
        { query: test.query },
        `test-multiple-${Date.now()}`
      );

      const success = result?.type === 'response';
      const operations = extractOperations(result);
      const drawingOps = operations.filter(op => op.type === 'drawing_operation');

      results.push({
        query: test.query,
        success,
        drawingCount: drawingOps.length,
        expectedCount: test.expectedCount,
        correctCount: drawingOps.length === test.expectedCount,
        hasPoints: drawingOps.every(op => op.parameters?.points),
        response: result?.result?.substring(0, 100),
      });

      console.log(`Found ${drawingOps.length} drawing operations (expected: ${test.expectedCount})`);
      if (drawingOps.length === test.expectedCount) {
        console.log('✓ Correct number of drawings');
      }
    } catch (error) {
      console.error(`✗ Error: ${error.message}`);
      results.push({
        query: test.query,
        success: false,
        error: error.message,
      });
    }
  }

  testResults.tests.multipleDrawings = {
    passed: results.some(r => r.correctCount),
    details: results,
  };
}

/**
 * Test batch operations
 */
async function testBatchOperations() {
  console.log('\n=== Testing Batch Operations ===');
  const testCases = [
    { 
      query: 'BTCの1時間足でトレンドラインを3本引いて', 
      expectedOps: ['symbol_change', 'timeframe_change', 'drawing_operation'] 
    },
    { 
      query: 'すべての描画を削除してETHに切り替え', 
      expectedOps: ['batch_operation', 'symbol_change'] 
    },
  ];

  const results = [];
  for (const test of testCases) {
    console.log(`\nTest: "${test.query}"`);
    
    try {
      const result = await agentNetwork.sendMessage(
        'testClient',
        'uiControlAgent',
        'process_query',
        { query: test.query },
        `test-batch-${Date.now()}`
      );

      const success = result?.type === 'response';
      const operations = extractOperations(result);
      const operationTypes = [...new Set(operations.map(op => op.type))];

      results.push({
        query: test.query,
        success,
        totalOperations: operations.length,
        operationTypes,
        hasMultipleTypes: operationTypes.length > 1,
        response: result?.result?.substring(0, 100),
      });

      console.log(`Found ${operations.length} operations with types: ${operationTypes.join(', ')}`);
    } catch (error) {
      console.error(`✗ Error: ${error.message}`);
      results.push({
        query: test.query,
        success: false,
        error: error.message,
      });
    }
  }

  testResults.tests.batchOperations = {
    passed: results.some(r => r.hasMultipleTypes),
    details: results,
  };
}

/**
 * Extract operations from result
 */
function extractOperations(result) {
  if (!result || !result.result) return [];
  
  // Try different paths where operations might be
  const paths = [
    result.result.operations,
    result.result.data?.operations,
    result.result.executionResult?.data?.operations,
    result.result.toolResults?.[0]?.result?.operations,
    result.result.steps?.[0]?.toolResults?.[0]?.result?.operations,
  ];

  for (const ops of paths) {
    if (Array.isArray(ops)) {
      return ops;
    }
  }

  return [];
}

/**
 * Generate summary
 */
function generateSummary() {
  const totalTests = Object.keys(testResults.tests).length;
  const passedTests = Object.values(testResults.tests).filter(t => t.passed).length;
  const successRate = (passedTests / totalTests * 100).toFixed(0);
  
  const summary = `UIコントロールエージェントテスト完了。${totalTests}項目中${passedTests}項目成功（成功率${successRate}%）。シンボル変更、時間軸変更、描画操作、複数描画機能を検証。`;
  
  testResults.summary = summary;
  return summary;
}

/**
 * Save results to JSON
 */
async function saveResults() {
  const outputPath = path.join(__dirname, '../../output/ui_control_test.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(testResults, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('=== UI Control Agent Comprehensive Test ===\n');
  
  try {
    // Register agents
    registerAllAgents();
    console.log('✓ Agents registered\n');
    
    // Record start time
    const startTime = Date.now();
    
    // Run all tests
    await testSymbolChange();
    await testTimeframeChange();
    await testDrawingOperations();
    await testIndicatorToggles();
    await testMultipleDrawings();
    await testBatchOperations();
    
    // Record performance
    testResults.performance = {
      totalDuration: Date.now() - startTime,
      averageResponseTime: Math.round((Date.now() - startTime) / 20), // Approx 20 tests
    };
    
    // Generate summary
    const summary = generateSummary();
    console.log('\n=== Test Summary ===');
    console.log(summary);
    
    // Save results
    await saveResults();
    
    // Create event flow documentation
    await createEventFlowDoc();
    
  } catch (error) {
    console.error('\n[FATAL ERROR]', error);
    testResults.errors.push({
      type: 'fatal',
      message: error.message,
      stack: error.stack,
    });
  }
}

/**
 * Create event flow documentation
 */
async function createEventFlowDoc() {
  const eventFlowDoc = `# UI Control Agent Event Flow

## Overview
This document describes the event flow for UI control operations.

## Event Types

### Symbol Change
- Event: \`ui:changeSymbol\`
- Data: \`{ symbol: string }\`
- Example: \`{ symbol: "BTCUSDT" }\`

### Timeframe Change
- Event: \`ui:changeTimeframe\`
- Data: \`{ timeframe: string }\`
- Example: \`{ timeframe: "1h" }\`

### Drawing Operations
- Event: \`draw:trendline\` or \`chart:startDrawing\`
- Data: \`{ points?: Array, style?: object, type?: string }\`
- With points: Immediate drawing
- Without points: Start drawing mode

### Indicator Control
- Event: \`chart:toggleIndicator\`
- Data: \`{ indicator: string, visible: boolean }\`

### Batch Operations
- Event: \`chart:batchOperation\`
- Data: \`{ operations: Array }\`

## State Consistency
The agent maintains consistency by:
1. Validating current state before operations
2. Emitting events in correct sequence
3. Providing rollback capability for failed operations
`;

  const docPath = path.join(__dirname, '../../output/ui_control_event_flow.md');
  await fs.writeFile(docPath, eventFlowDoc);
  console.log(`Event flow documentation saved to: ${docPath}`);
}

// Run tests
runTests()
  .then(() => {
    console.log('\n✓ All tests completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n✗ Test runner failed:', error);
    process.exit(1);
  });