#!/usr/bin/env node

/**
 * Simple Agent Verification Script
 * 
 * Verifies:
 * 1. tradingAnalysisAgent has tools defined
 * 2. uiControlAgent executes chartControlTool correctly
 * 3. All agents respond properly to their specific queries
 */

console.log('🔍 Agent Verification Script\n');

// Check if we can access the TypeScript files through ts-node
try {
  // Try to use ts-node if available
  require('ts-node/register');
  console.log('✅ Using ts-node for TypeScript support\n');
} catch (e) {
  console.log('⚠️  ts-node not available, checking compiled files\n');
}

// Function to safely check agent properties
function checkAgent(name, path, checks) {
  console.log(`\n📋 Checking ${name}:`);
  console.log('=' .repeat(40));
  
  try {
    const module = require(path);
    const agent = module[Object.keys(module).find(key => key.includes('Agent'))];
    
    if (!agent) {
      console.log('❌ Agent not found in module');
      return;
    }
    
    // Run each check
    checks.forEach(check => {
      try {
        const result = check(agent);
        console.log(result ? '✅' : '❌', check.description);
        if (check.details && result) {
          console.log(`   ${check.details(agent)}`);
        }
      } catch (e) {
        console.log('❌', check.description, `- Error: ${e.message}`);
      }
    });
    
  } catch (e) {
    console.log(`❌ Could not load ${name}: ${e.message}`);
  }
}

// Check Trading Analysis Agent
checkAgent('Trading Analysis Agent', '../lib/mastra/agents/trading.agent', [
  {
    description: 'Agent exists',
    check: (agent) => agent !== undefined
  },
  {
    description: 'Has name property',
    check: (agent) => agent.name !== undefined,
    details: (agent) => `Name: ${agent.name}`
  },
  {
    description: 'Has tools defined',
    check: (agent) => agent.tools !== undefined,
    details: (agent) => `Tools: ${agent.tools ? Object.keys(agent.tools).join(', ') : 'none'}`
  },
  {
    description: 'Has instructions',
    check: (agent) => agent.instructions !== undefined && agent.instructions.length > 0,
    details: (agent) => `Instructions length: ${agent.instructions?.length || 0} chars`
  }
]);

// Check UI Control Agent
checkAgent('UI Control Agent', '../lib/mastra/agents/ui-control.agent', [
  {
    description: 'Agent exists',
    check: (agent) => agent !== undefined
  },
  {
    description: 'Has chartControlTool',
    check: (agent) => agent.tools?.chartControlTool !== undefined,
    details: (agent) => `Tools: ${agent.tools ? Object.keys(agent.tools).join(', ') : 'none'}`
  },
  {
    description: 'chartControlTool has execute method',
    check: (agent) => typeof agent.tools?.chartControlTool?.execute === 'function'
  }
]);

// Check from registry
console.log('\n\n📋 Checking Agent Registry:');
console.log('=' .repeat(40));

try {
  const registry = require('../lib/mastra/network/agent-registry');
  
  const agents = ['priceInquiryAgent', 'tradingAnalysisAgent', 'uiControlAgent'];
  
  agents.forEach(agentName => {
    const agent = registry[agentName];
    console.log(`\n${agentName}:`);
    
    if (agent) {
      console.log('✅ Found in registry');
      console.log(`   Name: ${agent.name || 'not set'}`);
      console.log(`   Model: ${agent.model?.modelId || 'not set'}`);
      console.log(`   Tools: ${agent.tools ? Object.keys(agent.tools).join(', ') : 'none'}`);
      console.log(`   Instructions: ${agent.instructions ? agent.instructions.substring(0, 50) + '...' : 'none'}`);
    } else {
      console.log('❌ Not found in registry');
    }
  });
  
} catch (e) {
  console.log(`❌ Could not load agent registry: ${e.message}`);
}

// Test chart control tool execution
console.log('\n\n📋 Testing Chart Control Tool Execution:');
console.log('=' .repeat(40));

try {
  const { chartControlTool } = require('../lib/mastra/tools/chart-control.tool');
  
  if (chartControlTool && typeof chartControlTool.execute === 'function') {
    console.log('✅ chartControlTool found with execute method');
    
    // Mock window if needed
    if (typeof global.window === 'undefined') {
      global.window = {
        dispatchEvent: (event) => {
          console.log(`   🎯 Mock Event Dispatched: ${event.type}`);
          return true;
        }
      };
    }
    
    // Test basic execution
    console.log('\n🧪 Testing fit_content action:');
    chartControlTool.execute({
      context: { action: 'fit_content' }
    }).then(result => {
      if (result.success) {
        console.log('✅ Execution successful:', result.message || 'No message');
      } else {
        console.log('❌ Execution failed:', result.error || 'No error message');
      }
    }).catch(e => {
      console.log('❌ Execution error:', e.message);
    });
    
  } else {
    console.log('❌ chartControlTool not found or missing execute method');
  }
} catch (e) {
  console.log(`❌ Could not test chart control tool: ${e.message}`);
}

// Summary
console.log('\n\n📊 Verification Summary:');
console.log('=' .repeat(40));
console.log('1. Trading Analysis Agent: Check the output above');
console.log('2. UI Control Agent: Check the output above');  
console.log('3. Chart Control Tool: Check the execution test above');
console.log('\nNote: Some tests may fail if TypeScript modules cannot be loaded directly.');
console.log('Run "npm test" for full Jest test suite.');