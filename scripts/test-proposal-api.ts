/**
 * Test script for proposal generation API
 */

import { logger } from '../lib/utils/logger';

const API_URL = 'http://localhost:3000/api';

interface TestCase {
  name: string;
  request: {
    message: string;
    sessionId?: string;
  };
  expectedIntent?: string;
  expectProposals?: boolean;
}

const testCases: TestCase[] = [
  {
    name: 'Trendline Analysis',
    request: {
      message: 'BTCUSDTのトレンドラインを分析して',
      sessionId: 'test-trendline-1'
    },
    expectedIntent: 'chart_analysis',
    expectProposals: true
  },
  {
    name: 'Pattern Recognition',
    request: {
      message: 'チャートパターンを検出して',
      sessionId: 'test-pattern-1'
    },
    expectedIntent: 'chart_analysis',
    expectProposals: true
  },
  {
    name: 'Entry Proposal',
    request: {
      message: 'エントリーポイントを提案して',
      sessionId: 'test-entry-1'
    },
    expectedIntent: 'proposal_request',
    expectProposals: true
  },
  {
    name: 'Support/Resistance',
    request: {
      message: 'サポートとレジスタンスラインを表示して',
      sessionId: 'test-support-1'
    },
    expectedIntent: 'chart_analysis',
    expectProposals: true
  }
];

async function testProposalAPI() {
  logger.info('[ProposalAPITest] Starting API tests...');
  
  const results = [];
  
  for (const testCase of testCases) {
    logger.info(`[ProposalAPITest] Running test: ${testCase.name}`);
    
    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase.request)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Verify response structure
      const hasValidStructure = data.message && data.selectedAgent && data.analysis;
      
      // Check for proposals
      const hasProposals = !!(data.proposalGroup || data.entryProposalGroup || data.proposals);
      
      // Check intent
      const intentMatches = !testCase.expectedIntent || data.selectedAgent === testCase.expectedIntent;
      
      // Check proposals expectation
      const proposalExpectationMet = !testCase.expectProposals || hasProposals;
      
      const success = hasValidStructure && intentMatches && proposalExpectationMet;
      
      results.push({
        test: testCase.name,
        success,
        details: {
          hasValidStructure,
          hasProposals,
          intentMatches,
          proposalExpectationMet,
          actualIntent: data.selectedAgent,
          proposalTypes: {
            hasDrawingProposals: !!data.proposalGroup,
            hasEntryProposals: !!data.entryProposalGroup,
            hasUnifiedProposals: !!data.proposals
          }
        }
      });
      
      logger.info(`[ProposalAPITest] ${testCase.name}: ${success ? '✅ PASS' : '❌ FAIL'}`);
      
      if (hasProposals) {
        // Log proposal details
        if (data.proposalGroup) {
          logger.info(`  - Drawing proposals: ${data.proposalGroup.proposals.length}`);
        }
        if (data.entryProposalGroup) {
          logger.info(`  - Entry proposals: ${data.entryProposalGroup.proposals.length}`);
        }
        if (data.proposals) {
          logger.info(`  - Unified proposals: ${data.proposals.length}`);
        }
      }
      
      // Wait a bit between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      logger.error(`[ProposalAPITest] ${testCase.name} failed:`, error);
      results.push({
        test: testCase.name,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  // Summary
  logger.info('[ProposalAPITest] Test Summary:');
  const passed = results.filter(r => r.success).length;
  logger.info(`  Total: ${results.length}, Passed: ${passed}, Failed: ${results.length - passed}`);
  
  results.forEach(result => {
    logger.info(`  ${result.test}: ${result.success ? '✅' : '❌'}`);
    if (!result.success && result.error) {
      logger.error(`    Error: ${result.error}`);
    }
  });
  
  return results;
}

// Run tests if this file is executed directly
if (require.main === module) {
  testProposalAPI()
    .then(results => {
      const allPassed = results.every(r => r.success);
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      logger.error('[ProposalAPITest] Fatal error:', error);
      process.exit(1);
    });
}

export { testProposalAPI };