#!/usr/bin/env node

// Direct test of proposal generation tool
const { proposalGenerationTool } = require('../lib/mastra/tools/proposal-generation.tool');

async function testProposalTool() {
  console.log('Testing Proposal Generation Tool directly...\n');

  const testCases = [
    {
      name: 'Basic trendline proposal',
      params: {
        symbol: 'BTCUSDT',
        interval: '1h',
        analysisType: 'trendline',
        maxProposals: 5
      }
    },
    {
      name: 'Missing symbol (should fail)',
      params: {
        interval: '1h',
        analysisType: 'trendline',
        maxProposals: 5
      }
    },
    {
      name: 'Support/Resistance proposal',
      params: {
        symbol: 'BTCUSDT',
        interval: '15m',
        analysisType: 'support-resistance',
        maxProposals: 3
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n=== Test: ${testCase.name} ===`);
    console.log('Params:', JSON.stringify(testCase.params, null, 2));
    
    try {
      const result = await proposalGenerationTool.execute(testCase.params);
      console.log('\nResult:', JSON.stringify(result, null, 2));
      
      if (result.success && result.proposalGroup) {
        console.log('\n✅ Success!');
        console.log(`Generated ${result.proposalGroup.proposals.length} proposals`);
        
        result.proposalGroup.proposals.forEach((proposal, index) => {
          console.log(`\n${index + 1}. ${proposal.title}`);
          console.log(`   Type: ${proposal.type}`);
          console.log(`   Confidence: ${proposal.confidence}`);
          console.log(`   Description: ${proposal.description}`);
        });
      } else {
        console.log('\n❌ Failed:', result.error);
      }
    } catch (error) {
      console.log('\n❌ Exception:', error.message);
      console.error(error.stack);
    }
  }
}

// Run the test
testProposalTool().catch(console.error);