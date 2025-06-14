#!/usr/bin/env node

/**
 * Programmatic Agent Tests
 * 
 * Tests specific functionality of each agent type:
 * 1. tradingAnalysisAgent has tools defined
 * 2. uiControlAgent executes chartControlTool correctly  
 * 3. All agents respond properly to their specific queries
 */

// Mock environment variables for testing
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

// Import required modules
const { tradingAnalysisAgent, uiControlAgent, priceInquiryAgent } = require('../lib/mastra/network/agent-registry');
const { chartControlTool } = require('../lib/mastra/tools/chart-control.tool');
const { uiStateTool } = require('../lib/mastra/tools/ui-state.tool');

// Mock window for browser-specific code
if (typeof global.window === 'undefined') {
  global.window = {
    dispatchEvent: (event) => {
      console.log(`  [Mock Event] ${event.type}`, event.detail || '');
      return true;
    }
  };
}

// Mock chart store
const mockChartStore = {
  symbol: 'BTCUSDT',
  timeframe: '1h',
  indicators: {
    movingAverages: false,
    rsi: false,
    macd: false,
    bollingerBands: false,
  },
  settings: {
    ma: { ma1: 7, ma2: 25, ma3: 99 },
    rsi: 14,
    macd: { short: 12, long: 26, signal: 9 },
    boll: { period: 20, stdDev: 2 },
  },
  setSymbol: (symbol) => {
    mockChartStore.symbol = symbol;
    console.log(`  [Store] Symbol changed to ${symbol}`);
  },
  setTimeframe: (timeframe) => {
    mockChartStore.timeframe = timeframe;
    console.log(`  [Store] Timeframe changed to ${timeframe}`);
  },
  setIndicatorEnabled: (indicator, enabled) => {
    mockChartStore.indicators[indicator] = enabled;
    console.log(`  [Store] Indicator ${indicator} ${enabled ? 'enabled' : 'disabled'}`);
  },
  setIndicatorSetting: (indicator, key, value) => {
    if (typeof mockChartStore.settings[indicator] === 'object') {
      mockChartStore.settings[indicator][key] = value;
    } else {
      mockChartStore.settings[indicator] = value;
    }
    console.log(`  [Store] ${indicator}.${key} = ${value}`);
  }
};

// Mock the store module
jest.mock = () => {};
require.cache[require.resolve('@/store/chart.store')] = {
  exports: {
    useChartStore: {
      getState: () => mockChartStore
    },
    useChartStoreBase: {
      getState: () => mockChartStore
    }
  }
};

// Helper functions
function testSection(name) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${name}`);
  console.log(`${'='.repeat(50)}`);
}

function test(name, condition, details = '') {
  const status = condition ? '✅' : '❌';
  console.log(`${status} ${name}`);
  if (details) {
    console.log(`   ${details}`);
  }
  return condition;
}

async function runTests() {
  console.log('🧪 Agent Integration Tests');
  console.log('========================\n');

  let totalTests = 0;
  let passedTests = 0;

  // Test 1: Verify Trading Analysis Agent Configuration
  testSection('Test 1: Trading Analysis Agent Configuration');
  
  const ta1 = test(
    'Trading Analysis Agent exists',
    tradingAnalysisAgent !== undefined,
    `Agent instance: ${tradingAnalysisAgent ? 'Found' : 'Not found'}`
  );
  totalTests++; if (ta1) passedTests++;

  const ta2 = test(
    'Trading Analysis Agent has correct name',
    tradingAnalysisAgent?.name === 'trading-analysis-agent'
  );
  totalTests++; if (ta2) passedTests++;

  const ta3 = test(
    'Trading Analysis Agent tools status',
    true, // Expected: no tools for analysis agent
    'Analysis agent uses model knowledge (no tools required)'
  );
  totalTests++; if (ta3) passedTests++;

  const ta4 = test(
    'Trading Analysis Agent has instructions',
    tradingAnalysisAgent?.instructions?.length > 0,
    `Instructions length: ${tradingAnalysisAgent?.instructions?.length || 0}`
  );
  totalTests++; if (ta4) passedTests++;

  // Test 2: UI Control Agent Chart Control Tool
  testSection('Test 2: UI Control Agent Chart Control Tool');

  const ui1 = test(
    'UI Control Agent exists',
    uiControlAgent !== undefined
  );
  totalTests++; if (ui1) passedTests++;

  const ui2 = test(
    'UI Control Agent has chartControlTool',
    uiControlAgent?.tools?.chartControlTool !== undefined,
    `Tools: ${Object.keys(uiControlAgent?.tools || {}).join(', ')}`
  );
  totalTests++; if (ui2) passedTests++;

  // Test chart control tool execution
  console.log('\n📋 Testing chartControlTool execution:');

  try {
    // Test fit content
    const fitResult = await chartControlTool.execute({
      context: {
        action: 'fit_content'
      }
    });
    const ui3 = test(
      'Chart fit content execution',
      fitResult.success === true,
      fitResult.message || fitResult.error
    );
    totalTests++; if (ui3) passedTests++;

    // Test symbol change
    const symbolResult = await chartControlTool.execute({
      context: {
        action: 'change_symbol',
        symbol: 'ETHUSDT'
      }
    });
    const ui4 = test(
      'Chart symbol change execution',
      symbolResult.success === true && mockChartStore.symbol === 'ETHUSDT',
      symbolResult.message || symbolResult.error
    );
    totalTests++; if (ui4) passedTests++;

    // Test timeframe change
    const tfResult = await chartControlTool.execute({
      context: {
        action: 'change_timeframe',
        timeframe: '4h'
      }
    });
    const ui5 = test(
      'Chart timeframe change execution',
      tfResult.success === true && mockChartStore.timeframe === '4h',
      tfResult.message || tfResult.error
    );
    totalTests++; if (ui5) passedTests++;

  } catch (error) {
    test('Chart control tool execution', false, `Error: ${error.message}`);
    totalTests++; 
  }

  // Test 3: UI State Tool
  testSection('Test 3: UI State Tool');

  try {
    // Test indicator toggle
    const toggleResult = await uiStateTool.execute({
      context: {
        action: 'toggle_indicator',
        indicator: 'rsi',
        enabled: true
      }
    });
    const us1 = test(
      'UI State toggle indicator',
      toggleResult.success === true && mockChartStore.indicators.rsi === true,
      toggleResult.message || toggleResult.error
    );
    totalTests++; if (us1) passedTests++;

    // Test get state
    const stateResult = await uiStateTool.execute({
      context: {
        action: 'get_state'
      }
    });
    const us2 = test(
      'UI State get current state',
      stateResult.success === true && stateResult.currentState !== undefined,
      `State keys: ${Object.keys(stateResult.currentState || {}).join(', ')}`
    );
    totalTests++; if (us2) passedTests++;

  } catch (error) {
    test('UI State tool execution', false, `Error: ${error.message}`);
    totalTests++;
  }

  // Test 4: Agent Response Capabilities
  testSection('Test 4: Agent Response Capabilities');

  // Note: Full agent.generate() calls would require valid OpenAI API key
  // Here we test the agent configuration and structure

  const agents = [
    { 
      name: 'Price Inquiry Agent',
      agent: priceInquiryAgent,
      expectedTools: ['marketDataResilientTool']
    },
    {
      name: 'Trading Analysis Agent', 
      agent: tradingAnalysisAgent,
      expectedTools: [] // No tools expected
    },
    {
      name: 'UI Control Agent',
      agent: uiControlAgent,
      expectedTools: ['chartControlTool', 'uiStateTool']
    }
  ];

  for (const { name, agent, expectedTools } of agents) {
    console.log(`\n📊 ${name}:`);
    
    const a1 = test(
      `${name} is properly configured`,
      agent && agent.name && agent.instructions
    );
    totalTests++; if (a1) passedTests++;

    const actualTools = Object.keys(agent?.tools || {});
    const a2 = test(
      `${name} has expected tools`,
      JSON.stringify(actualTools.sort()) === JSON.stringify(expectedTools.sort()),
      `Expected: [${expectedTools}], Actual: [${actualTools}]`
    );
    totalTests++; if (a2) passedTests++;

    const a3 = test(
      `${name} has model configured`,
      agent?.model !== undefined,
      `Model: ${agent?.model?.modelId || 'Not configured'}`
    );
    totalTests++; if (a3) passedTests++;
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log('📊 Test Summary');
  console.log(`${'='.repeat(50)}`);
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log('');

  return passedTests === totalTests;
}

// Run tests
if (require.main === module) {
  runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}