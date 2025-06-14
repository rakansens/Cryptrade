#!/usr/bin/env node

const http = require('http');

async function testProposalAPI() {
  console.log('Testing Proposal API...\n');

  const url = 'http://localhost:3000/api/ai/chat';
  const body = {
    message: 'トレンドラインを提案して',
    sessionId: 'test-session-' + Date.now()
  };

  try {
    console.log('Request:', JSON.stringify(body, null, 2));
    console.log('\nSending request to:', url);
    
    const data = await new Promise((resolve, reject) => {
      const postData = JSON.stringify(body);
      
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/ai/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = http.request(options, (res) => {
        console.log('\nResponse Status:', res.statusCode);
        
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            console.log('\nResponse Body:', JSON.stringify(parsed, null, 2));
            resolve(parsed);
          } catch (e) {
            console.error('Failed to parse response:', data);
            reject(e);
          }
        });
      });
      
      req.on('error', (e) => {
        reject(e);
      });
      
      req.write(postData);
      req.end();
    });

    // Check for proposal data
    if (data.proposalGroup) {
      console.log('\n✅ Proposal Group Found!');
      console.log('Title:', data.proposalGroup.title);
      console.log('Description:', data.proposalGroup.description);
      console.log('Proposals Count:', data.proposalGroup.proposals?.length || 0);
      
      if (data.proposalGroup.proposals) {
        console.log('\nProposal Details:');
        data.proposalGroup.proposals.forEach((proposal, index) => {
          console.log(`\n${index + 1}. ${proposal.title}`);
          console.log(`   Type: ${proposal.type}`);
          console.log(`   Confidence: ${proposal.confidence}`);
          console.log(`   Priority: ${proposal.priority}`);
          console.log(`   Reason: ${proposal.reason}`);
        });
      }
    } else {
      console.log('\n❌ No Proposal Group in Response');
      console.log('Message:', data.message);
      console.log('Selected Agent:', data.selectedAgent);
      console.log('Intent:', data.analysis?.intent);
      console.log('Is Proposal Mode:', data.analysis?.isProposalMode);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

// Run the test
testProposalAPI();