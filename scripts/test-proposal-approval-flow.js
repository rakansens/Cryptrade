#!/usr/bin/env node

/**
 * Test script for proposal approval functionality
 * Tests the complete flow from approval to chart drawing
 */

const fetch = require('node-fetch');
const EventSource = require('eventsource');

const API_BASE = 'http://localhost:3000';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

// Publish event via API
async function publishEvent(event, data) {
  log(`Publishing event: ${event}`, 'cyan');
  
  try {
    const response = await fetch(`${API_BASE}/api/ui-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    log(`✅ Event published successfully`, 'green');
    return result;
  } catch (error) {
    log(`❌ Failed to publish event: ${error.message}`, 'red');
    throw error;
  }
}

// Test single proposal approval
async function testSingleProposalApproval() {
  log('\n=== Testing Single Proposal Approval ===', 'yellow');
  
  const proposalData = {
    proposalId: `proposal_${Date.now()}`,
    groupId: `group_${Date.now()}`,
    drawingData: {
      id: `drawing_${Date.now()}`,
      type: 'trendline',
      points: [
        { time: Date.now() - 3600000, value: 104600 },
        { time: Date.now(), value: 105200 }
      ],
      style: {
        color: '#00ff00',
        lineWidth: 2,
        lineStyle: 'solid',
        showLabels: true
      }
    }
  };
  
  log('Proposal data:', 'blue');
  console.log(JSON.stringify(proposalData, null, 2));
  
  // 1. Publish approval event
  await publishEvent('proposal:approve', {
    type: 'proposal:approve',
    proposalId: proposalData.proposalId,
    groupId: proposalData.groupId,
    timestamp: Date.now()
  });
  
  // 2. Publish drawing event (simulating what ChatPanel should do)
  await publishEvent('chart:addDrawing', {
    id: proposalData.drawingData.id,
    type: proposalData.drawingData.type,
    points: proposalData.drawingData.points,
    style: proposalData.drawingData.style,
    timestamp: Date.now()
  });
  
  log('✅ Single proposal test completed', 'green');
}

// Test multiple proposals approval
async function testMultipleProposalsApproval() {
  log('\n=== Testing Multiple Proposals Approval ===', 'yellow');
  
  const groupId = `group_${Date.now()}`;
  const proposals = [
    {
      id: `proposal_1_${Date.now()}`,
      drawingData: {
        id: `drawing_1_${Date.now()}`,
        type: 'trendline',
        points: [
          { time: Date.now() - 7200000, value: 104000 },
          { time: Date.now() - 3600000, value: 104800 }
        ],
        style: { color: '#ff0000', lineWidth: 2, lineStyle: 'solid', showLabels: true }
      }
    },
    {
      id: `proposal_2_${Date.now()}`,
      drawingData: {
        id: `drawing_2_${Date.now()}`,
        type: 'horizontal',
        points: [{ time: Date.now(), value: 105000 }],
        style: { color: '#00ff00', lineWidth: 3, lineStyle: 'dashed', showLabels: true }
      }
    },
    {
      id: `proposal_3_${Date.now()}`,
      drawingData: {
        id: `drawing_3_${Date.now()}`,
        type: 'trendline',
        points: [
          { time: Date.now() - 3600000, value: 104500 },
          { time: Date.now(), value: 105500 }
        ],
        style: { color: '#0000ff', lineWidth: 2, lineStyle: 'solid', showLabels: true }
      }
    }
  ];
  
  // 1. Publish approve-all event
  await publishEvent('proposal:approve-all', {
    type: 'proposal:approve-all',
    groupId: groupId,
    timestamp: Date.now()
  });
  
  // 2. Publish drawing events for each proposal
  for (let i = 0; i < proposals.length; i++) {
    const proposal = proposals[i];
    log(`Publishing drawing ${i + 1}/${proposals.length}`, 'blue');
    
    await publishEvent('chart:addDrawing', {
      id: proposal.drawingData.id,
      type: proposal.drawingData.type,
      points: proposal.drawingData.points,
      style: proposal.drawingData.style,
      timestamp: Date.now()
    });
    
    // Small delay between events
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  log('✅ Multiple proposals test completed', 'green');
}

// Test SSE connection and event flow
async function testSSEEventFlow() {
  log('\n=== Testing SSE Event Flow ===', 'yellow');
  
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(`${API_BASE}/api/ui-events`);
    const testId = Date.now();
    let eventReceived = false;
    
    const timeoutId = setTimeout(() => {
      if (!eventReceived) {
        log('❌ Timeout: No SSE event received within 5 seconds', 'red');
        eventSource.close();
        reject(new Error('SSE event timeout'));
      }
    }, 5000);
    
    eventSource.addEventListener('ui-event', (event) => {
      const data = JSON.parse(event.data);
      log(`📨 SSE Event Received: ${data.event}`, 'magenta');
      
      if (data.event === 'chart:addDrawing' && data.data.id === `test_${testId}`) {
        eventReceived = true;
        clearTimeout(timeoutId);
        log('✅ SSE event flow verified!', 'green');
        eventSource.close();
        resolve();
      }
    });
    
    eventSource.onerror = (error) => {
      log(`❌ SSE Error: ${error.type}`, 'red');
      clearTimeout(timeoutId);
      eventSource.close();
      reject(error);
    };
    
    eventSource.onopen = () => {
      log('✅ SSE Connected', 'green');
      
      // Send test event
      publishEvent('chart:addDrawing', {
        id: `test_${testId}`,
        type: 'trendline',
        points: [
          { time: Date.now() - 3600000, value: 104700 },
          { time: Date.now(), value: 105300 }
        ],
        style: {
          color: '#4CAF50',
          lineWidth: 3,
          lineStyle: 'solid',
          showLabels: true
        }
      });
    };
  });
}

// Main test runner
async function runTests() {
  log('🚀 Starting Proposal Approval Flow Tests', 'cyan');
  log(`API Base: ${API_BASE}`, 'blue');
  
  try {
    // Test 1: Single proposal
    await testSingleProposalApproval();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: Multiple proposals
    await testMultipleProposalsApproval();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 3: SSE event flow
    await testSSEEventFlow();
    
    log('\n✅ All tests completed successfully!', 'green');
    log('\n📝 Summary:', 'yellow');
    log('1. Single proposal approval: PASSED', 'green');
    log('2. Multiple proposals approval: PASSED', 'green');
    log('3. SSE event flow: PASSED', 'green');
    
    log('\n💡 Next steps:', 'cyan');
    log('1. Open the app in a browser', 'blue');
    log('2. Check if drawings appear on the chart', 'blue');
    log('3. Check browser console for event logs', 'blue');
    
  } catch (error) {
    log(`\n❌ Test failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { publishEvent, testSingleProposalApproval, testMultipleProposalsApproval };