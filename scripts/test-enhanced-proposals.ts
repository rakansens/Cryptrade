#!/usr/bin/env node
import { proposalGenerationTool } from '../lib/mastra/tools/proposal-generation.tool';
import { logger } from '../lib/utils/logger';

async function testEnhancedProposals() {
  console.log('🧪 Testing Enhanced Proposal Generation...\n');

  try {
    // Test parameters
    const params = {
      symbol: 'BTCUSDT',
      interval: '1h',
      analysisType: 'trendline' as const,
      maxProposals: 3,
    };

    console.log('📊 Parameters:', params);
    console.log('\n⏳ Generating proposals...\n');

    const result = await proposalGenerationTool.execute(params);

    if (result.success && result.proposalGroup) {
      console.log('✅ Proposal Group Generated:', {
        id: result.proposalGroup.id,
        title: result.proposalGroup.title,
        proposalCount: result.proposalGroup.proposals.length,
      });

      console.log('\n📈 Proposals:\n');

      result.proposalGroup.proposals.forEach((proposal, index) => {
        console.log(`\n${index + 1}. ${proposal.title}`);
        console.log('   Description:', proposal.description);
        console.log('   Confidence:', proposal.confidence.toFixed(3));
        console.log('   Priority:', proposal.priority);
        console.log('   Touches:', proposal.touches);
        
        if (proposal.confidenceFactors) {
          console.log('\n   📊 Confidence Factors:');
          console.log('      - Touch Points:', proposal.confidenceFactors.touchPoints.toFixed(3));
          console.log('      - Volume Weight:', proposal.confidenceFactors.volumeWeight.toFixed(3));
          console.log('      - Timeframe Confluence:', proposal.confidenceFactors.timeframeConfluence.toFixed(3));
          console.log('      - Pattern Confirmation:', proposal.confidenceFactors.patternConfirmation.toFixed(3));
          console.log('      - Statistical Fit (R²):', proposal.confidenceFactors.statisticalFit.toFixed(3));
        }

        if (proposal.timeframeConfirmation) {
          console.log('\n   ⏰ Timeframe Analysis:');
          console.log('      - Current:', proposal.timeframeConfirmation.current);
          console.log('      - Higher TFs:', proposal.timeframeConfirmation.higher.join(', '));
          console.log('      - Confirmed:', proposal.timeframeConfirmation.confirmed ? '✅' : '❌');
        }

        if (proposal.volumeAnalysis) {
          console.log('\n   📊 Volume Analysis:');
          console.log('      - Average Volume:', proposal.volumeAnalysis.averageVolume.toFixed(0));
          console.log('      - Volume at Touches:', proposal.volumeAnalysis.volumeAtTouches.map(v => v.toFixed(0)).join(', '));
          console.log('      - Volume Weighted Score:', proposal.volumeAnalysis.volumeWeightedScore.toFixed(3));
        }

        if (proposal.patterns && proposal.patterns.length > 0) {
          console.log('\n   🕯️ Patterns Detected:');
          proposal.patterns.forEach(pattern => {
            console.log(`      - ${pattern.type} at ${pattern.location} (strength: ${pattern.strength})`);
          });
        }

        if (proposal.statistics) {
          console.log('\n   📈 Statistics:');
          console.log('      - R-squared:', proposal.statistics.rSquared.toFixed(3));
          console.log('      - Standard Deviation:', proposal.statistics.standardDeviation.toFixed(2));
          console.log('      - Outliers:', proposal.statistics.outliers);
        }

        console.log('\n   💬 Reason:', proposal.reason);
      });

      // Test support/resistance proposals
      console.log('\n\n🔄 Testing Support/Resistance Proposals...\n');
      
      const srParams = {
        symbol: 'BTCUSDT',
        interval: '4h',
        analysisType: 'support-resistance' as const,
        maxProposals: 3,
      };

      const srResult = await proposalGenerationTool.execute(srParams);
      
      if (srResult.success && srResult.proposalGroup) {
        console.log('✅ Support/Resistance Proposals Generated:', srResult.proposalGroup.proposals.length);
        
        srResult.proposalGroup.proposals.forEach((proposal, index) => {
          console.log(`\n${index + 1}. ${proposal.title}`);
          console.log('   Price Level:', proposal.drawingData.price?.toFixed(2));
          console.log('   Confidence:', proposal.confidence.toFixed(3));
          console.log('   Touches:', proposal.touches);
          
          if (proposal.volumeAnalysis) {
            console.log('   Volume Score:', proposal.volumeAnalysis.volumeWeightedScore.toFixed(3));
          }
        });
      }

    } else {
      console.error('❌ Failed to generate proposals:', result.error);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    logger.error('Test failed', error);
  }
}

// Run the test
testEnhancedProposals().catch(console.error);