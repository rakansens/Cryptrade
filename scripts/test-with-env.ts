/**
 * Test with proper environment loading
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local file
const envPath = resolve(process.cwd(), '.env.local');
console.log('Loading environment from:', envPath);

const result = config({ path: envPath });
if (result.error) {
  console.error('Error loading .env.local:', result.error);
} else {
  console.log('✅ Environment loaded successfully');
  console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
  console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY?.length);
}

// Now run the actual test
async function runAPITest() {
  console.log('\n🚀 Testing API Endpoint...\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'BTCUSDTのトレンドラインを分析して',
        sessionId: 'test-env-1'
      })
    });
    
    if (!response.ok) {
      console.error('❌ API request failed:', response.status, response.statusText);
      const text = await response.text();
      console.error('Response:', text);
      return;
    }
    
    const data = await response.json();
    console.log('✅ API Response received');
    console.log('Selected Agent:', data.selectedAgent);
    console.log('Has Drawing Proposals:', !!data.proposalGroup);
    console.log('Has Entry Proposals:', !!data.entryProposalGroup);
    console.log('Has Unified Proposals:', !!data.proposals);
    
    if (data.proposalGroup) {
      console.log('\n📊 Drawing Proposals:');
      interface Proposal {
        title?: string;
        description?: string;
        confidence: number;
      }
      data.proposalGroup.proposals.forEach((p: Proposal, i: number) => {
        console.log(`  ${i + 1}. ${p.title || p.description} (confidence: ${(p.confidence * 100).toFixed(0)}%)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000/api/health');
    return response.ok;
  } catch {
    return false;
  }
}

// Main execution
(async () => {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.error('\n❌ Server is not running at http://localhost:3000');
    console.error('Please start the server with: npm run dev\n');
    process.exit(1);
  }
  
  await runAPITest();
})();