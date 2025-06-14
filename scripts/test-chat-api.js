const fetch = require('node-fetch');

async function testChatApi() {
  console.log('Testing refactored chat API...\n');
  
  const testCases = [
    {
      name: 'Simple message',
      body: {
        message: 'BTCの価格を教えて',
        sessionId: 'test-session-1'
      }
    },
    {
      name: 'Proposal request',
      body: {
        message: 'BTCのトレンドラインを提案して',
        sessionId: 'test-session-2',
        runtimeContext: {
          isProposalMode: true,
          queryComplexity: 'complex'
        }
      }
    },
    {
      name: 'Invalid request',
      body: {
        // Missing message field
        sessionId: 'test-session-3'
      }
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n--- Testing: ${testCase.name} ---`);
    
    try {
      const response = await fetch('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase.body)
      });
      
      const data = await response.json();
      
      console.log(`Status: ${response.status}`);
      console.log('Response:', JSON.stringify(data, null, 2));
      
      // Validate response structure
      if (response.ok) {
        console.log('✅ Response structure validation:');
        console.log(`  - Has message: ${!!data.message}`);
        console.log(`  - Has selectedAgent: ${!!data.selectedAgent}`);
        console.log(`  - Has analysis: ${!!data.analysis}`);
        console.log(`  - Has metadata: ${!!data.metadata}`);
      }
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
  
  console.log('\n\nAll tests completed!');
}

// Note: Make sure the dev server is running before executing this
console.log('Note: This test requires the Next.js dev server to be running on port 3000');
console.log('Run "npm run dev" in another terminal before running this test.\n');

testChatApi().catch(console.error);