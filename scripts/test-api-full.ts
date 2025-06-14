/**
 * Full API integration test with mocked AI responses
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

// Set test mode to use mocked responses
process.env.NODE_ENV = 'test';
process.env['USE_MOCK_AI'] = 'true';

async function testAPI() {
  console.log('\n🚀 Testing API with Mock AI Responses...\n');
  
  const testCases = [
    {
      name: 'Trendline Analysis',
      request: {
        message: 'BTCUSDTのトレンドラインを分析して',
        sessionId: 'test-1'
      }
    },
    {
      name: 'Pattern Recognition',
      request: {
        message: 'チャートパターンを検出して',
        sessionId: 'test-2'
      }
    },
    {
      name: 'Entry Proposal',
      request: {
        message: 'エントリーポイントを提案して',
        sessionId: 'test-3'
      }
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log('Request:', testCase.request.message);
    
    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase.request)
      });
      
      if (!response.ok) {
        console.error('❌ API Error:', response.status, response.statusText);
        continue;
      }
      
      const data = await response.json();
      console.log('✅ Response received');
      console.log('  - Selected Agent:', data.selectedAgent);
      console.log('  - Has Proposals:', !!(data.proposalGroup || data.entryProposalGroup));
      
      if (data.proposalGroup) {
        console.log(`  - Drawing Proposals: ${data.proposalGroup.proposals.length}`);
        interface ProposalItem {
          description: string;
          confidence: number;
        }
        data.proposalGroup.proposals.forEach((p: ProposalItem, i: number) => {
          console.log(`    ${i + 1}. ${p.description} (${(p.confidence * 100).toFixed(0)}%)`);
        });
      }
      
      if (data.entryProposalGroup) {
        console.log(`  - Entry Proposals: ${data.entryProposalGroup.proposals.length}`);
        interface EntryProposalItem {
          direction: string;
          entryPrice: number;
          confidence: number;
        }
        data.entryProposalGroup.proposals.forEach((p: EntryProposalItem, i: number) => {
          console.log(`    ${i + 1}. ${p.direction} @ $${p.entryPrice} (${(p.confidence * 100).toFixed(0)}%)`);
        });
      }
      
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }
  
  console.log('\n✅ All tests completed\n');
}

// Check server health
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000/api/health');
    return response.ok;
  } catch {
    return false;
  }
}

// Main
(async () => {
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log('\n⚠️  Server not running. Starting mock server test...\n');
    
    // Import and run mock test
    const { runMockTest } = await import('./mock-api-test');
    await runMockTest();
  } else {
    await testAPI();
  }
})();