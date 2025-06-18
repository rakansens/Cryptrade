/**
 * Proposal System Validation Test
 * AGENT-009: Proposal System Tester
 * 
 * このスクリプトは、全ての提案タイプの生成と構造を検証します
 */

import { logger } from '@/lib/utils/logger';
import { 
  ExtendedProposalSchema,
  ProposalGroupSchema,
  validateExtendedProposal,
  validateProposalGroup,
  type ProposalGroup,
  type ExtendedProposal
} from '@/lib/mastra/tools/proposal-generation/types';
import {
  DrawingProposalSchema,
  DrawingProposalGroupSchema,
  EntryProposalSchema,
  EntryProposalGroupSchema,
  type DrawingProposal,
  type DrawingProposalGroup,
  type EntryProposal,
  type EntryProposalGroup,
  isDrawingProposal,
  isEntryProposal,
  ProposalType,
  ProposalStatus
} from '@/types/proposals';
import {
  RiskParametersSchema,
  EntryConditionsSchema,
  MarketContextSchema,
  EntryReasoningSchema
} from '@/types/trading';
import { z } from 'zod';

interface ValidationResult {
  proposalType: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  structure: Record<string, unknown>;
  sampleData?: unknown;
}

interface TestReport {
  timestamp: number;
  totalTests: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
  summary: string;
}

/**
 * Generate sample trendline proposal
 */
function generateTrendlineProposal(): DrawingProposal {
  return {
    id: `tl_${Date.now()}_test`,
    type: ProposalType.TRENDLINE,
    analysisType: 'trendline',
    coordinates: {
      start: { x: 1732000000000, y: 50000 },
      end: { x: 1732100000000, y: 52000 },
    },
    confidence: 0.85,
    reasoning: '上昇トレンドラインが3回のタッチポイントで確認されました',
    priority: 'high',
    status: ProposalStatus.PENDING,
    createdAt: Date.now(),
    title: '上昇トレンドライン',
    description: 'BTCUSDTの4時間足で明確な上昇トレンドを検出',
    touches: 3,
    drawingData: {
      type: 'trendline',
      points: [
        { time: 1732000000000, value: 50000 },
        { time: 1732050000000, value: 51000 },
        { time: 1732100000000, value: 52000 }
      ],
      style: {
        color: '#22c55e',
        lineWidth: 2,
        lineStyle: 'solid'
      },
      metadata: {
        angle: 15.5,
        strength: 0.9
      }
    },
    metadata: {
      touchPoints: 3,
      angle: 15.5,
      strength: 0.9
    }
  };
}

/**
 * Generate sample support/resistance proposal
 */
function generateSupportResistanceProposal(): DrawingProposal {
  return {
    id: `sr_${Date.now()}_test`,
    type: ProposalType.SUPPORT_RESISTANCE,
    analysisType: 'support',
    coordinates: {
      start: { x: 1732000000000, y: 48000 },
      end: { x: 1732200000000, y: 48000 },
    },
    confidence: 0.92,
    reasoning: '強力なサポートレベル: 5回の反発を確認',
    priority: 'high',
    status: ProposalStatus.PENDING,
    createdAt: Date.now(),
    title: 'サポートライン $48,000',
    description: '重要な心理的価格レベルでの強いサポート',
    touches: 5,
    drawingData: {
      type: 'horizontalLine',
      points: [
        { time: 1732000000000, value: 48000 },
        { time: 1732200000000, value: 48000 }
      ],
      price: 48000,
      style: {
        color: '#22c55e',
        lineWidth: 3,
        lineStyle: 'solid',
        showLabels: true
      }
    },
    metadata: {
      touchPoints: 5,
      volumeAnalysis: {
        averageVolume: 1500000,
        volumeTrend: 'increasing',
        significantVolumeBars: [
          { timestamp: 1732050000000, volume: 2500000, priceAction: 'bullish' }
        ]
      }
    }
  };
}

/**
 * Generate sample pattern proposal
 */
function generatePatternProposal(): DrawingProposal {
  return {
    id: `pt_${Date.now()}_test`,
    type: ProposalType.PATTERN,
    analysisType: 'pattern',
    coordinates: {
      start: { x: 1731900000000, y: 47000 },
      end: { x: 1732100000000, y: 51000 },
      additionalPoints: [
        { x: 1731950000000, y: 49000 },
        { x: 1732000000000, y: 48000 },
        { x: 1732050000000, y: 50000 }
      ]
    },
    confidence: 0.78,
    reasoning: 'ダブルボトムパターンの形成を検出',
    priority: 'medium',
    status: ProposalStatus.PENDING,
    createdAt: Date.now(),
    title: 'ダブルボトムパターン',
    description: '反転パターンの可能性が高い',
    drawingData: {
      type: 'pattern',
      points: [
        { time: 1731900000000, value: 47000 },
        { time: 1731950000000, value: 49000 },
        { time: 1732000000000, value: 48000 },
        { time: 1732050000000, value: 50000 },
        { time: 1732100000000, value: 51000 }
      ],
      metadata: {
        patternType: 'doubleBottom',
        neckline: 49000,
        target: 52000
      }
    },
    metadata: {
      pattern: {
        type: 'doubleBottom',
        confidence: 0.78,
        points: [
          { x: 1731900000000, y: 47000 },
          { x: 1732000000000, y: 48000 }
        ],
        description: 'Classic reversal pattern'
      }
    }
  };
}

/**
 * Generate sample fibonacci proposal
 */
function generateFibonacciProposal(): DrawingProposal {
  return {
    id: `fib_${Date.now()}_test`,
    type: ProposalType.FIBONACCI,
    analysisType: 'fibonacci',
    coordinates: {
      start: { x: 1731800000000, y: 45000 },
      end: { x: 1732000000000, y: 52000 },
    },
    confidence: 0.82,
    reasoning: 'フィボナッチリトレースメントレベルを特定',
    priority: 'medium',
    status: ProposalStatus.PENDING,
    createdAt: Date.now(),
    title: 'フィボナッチリトレースメント',
    description: '重要な価格レベルを示すフィボナッチ分析',
    drawingData: {
      type: 'fibonacci',
      points: [
        { time: 1731800000000, value: 45000 },
        { time: 1732000000000, value: 52000 }
      ],
      levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1],
      metadata: {
        swing: 'upward',
        levelPrices: {
          '0': 45000,
          '0.236': 46652,
          '0.382': 47674,
          '0.5': 48500,
          '0.618': 49326,
          '0.786': 50484,
          '1': 52000
        }
      }
    }
  };
}

/**
 * Generate sample entry proposal
 */
function generateEntryProposal(): EntryProposal {
  return {
    id: `ep_${Date.now()}_test`,
    type: 'entry',
    direction: 'long',
    entryPrice: 51500,
    entryZone: {
      min: 51000,
      max: 52000
    },
    strategy: 'swingTrading',
    timeframe: '4h',
    symbol: 'BTCUSDT',
    confidence: 0.88,
    priority: 'high',
    riskParameters: {
      stopLoss: 49500,
      stopLossPercent: 3.88,
      takeProfitTargets: [
        { price: 53500, percentage: 50 },
        { price: 55000, percentage: 30 },
        { price: 57000, percentage: 20 }
      ],
      riskRewardRatio: 2.5,
      positionSizePercent: 2,
      maxRiskPercent: 1
    },
    conditions: {
      trigger: 'breakout',
      confirmationRequired: [
        {
          indicator: 'RSI',
          condition: 'above 50',
          value: 50,
          description: 'RSIが50を超えて上昇モメンタムを確認'
        }
      ],
      invalidationPrice: 49000,
      timeLimit: {
        hours: 24,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000
      }
    },
    marketContext: {
      trend: 'uptrend',
      volatility: 'medium',
      momentum: 'strong',
      volume: 'increasing',
      keyLevels: {
        support: [50000, 48000, 45000],
        resistance: [52000, 54000, 57000]
      }
    },
    reasoning: {
      primary: 'ブレイクアウトパターンの完成とモメンタムの強さ',
      technicalFactors: [
        {
          indicator: 'Trendline Break',
          signal: 'Bullish breakout',
          weight: 0.4,
          description: '下降トレンドラインの明確なブレイクアウト'
        },
        {
          indicator: 'Volume',
          signal: 'Increasing',
          weight: 0.3,
          description: 'ブレイクアウト時の出来高増加'
        },
        {
          indicator: 'Moving Average',
          signal: 'Golden Cross',
          weight: 0.3,
          description: '50MAが200MAを上抜け'
        }
      ],
      risks: [
        'フェイクブレイクアウトの可能性',
        '直上のレジスタンスレベル（$52,000）',
        '週末の流動性低下リスク'
      ],
      alternativeScenarios: [
        {
          condition: '$49,000を下回った場合',
          action: 'ポジションをクローズし、再評価'
        }
      ]
    },
    status: ProposalStatus.PENDING,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    metadata: {
      relatedDrawings: ['tl_123_abc', 'sr_456_def'],
      backtestResults: {
        winRate: 0.65,
        avgReturn: 0.085,
        maxDrawdown: 0.045
      }
    }
  };
}

/**
 * Generate mixed proposal group
 */
function generateMixedProposalGroup(): DrawingProposalGroup {
  return {
    id: `pg_${Date.now()}_mixed`,
    title: 'BTCUSDT 総合分析',
    description: '複数の分析手法を組み合わせた総合的な市場分析',
    proposals: [
      generateTrendlineProposal(),
      generateSupportResistanceProposal(),
      generatePatternProposal(),
      generateFibonacciProposal()
    ],
    groupType: 'mixed',
    summary: {
      totalProposals: 4,
      averageConfidence: 0.84,
      priorityBreakdown: {
        high: 2,
        medium: 2,
        low: 0
      }
    },
    createdAt: Date.now(),
    metadata: {
      timeframe: '4h',
      symbol: 'BTCUSDT'
    }
  };
}

/**
 * Validate proposal structure
 */
function validateProposalStructure(proposal: unknown, type: string): ValidationResult {
  const result: ValidationResult = {
    proposalType: type,
    isValid: false,
    errors: [],
    warnings: [],
    structure: {},
    sampleData: proposal
  };

  try {
    switch (type) {
      case 'trendline':
      case 'support_resistance':
      case 'pattern':
      case 'fibonacci':
        // Validate as DrawingProposal
        const drawingResult = DrawingProposalSchema.safeParse(proposal);
        result.isValid = drawingResult.success;
        if (!drawingResult.success) {
          result.errors = drawingResult.error.errors.map(e => 
            `${e.path.join('.')}: ${e.message}`
          );
        } else {
          result.structure = {
            hasCoordinates: true,
            hasDrawingData: true,
            hasConfidence: true,
            hasMetadata: !!drawingResult.data.metadata
          };
        }
        break;

      case 'entry':
        // Validate as EntryProposal
        const entryResult = EntryProposalSchema.safeParse(proposal);
        result.isValid = entryResult.success;
        if (!entryResult.success) {
          result.errors = entryResult.error.errors.map(e => 
            `${e.path.join('.')}: ${e.message}`
          );
        } else {
          result.structure = {
            hasRiskParameters: true,
            hasMarketContext: true,
            hasConditions: true,
            hasReasoning: true
          };
        }
        break;

      case 'extended':
        // Validate as ExtendedProposal (from proposal-generation tool)
        const extendedResult = ExtendedProposalSchema.safeParse(proposal);
        result.isValid = extendedResult.success;
        if (!extendedResult.success) {
          result.errors = extendedResult.error.errors.map(e => 
            `${e.path.join('.')}: ${e.message}`
          );
        } else {
          result.structure = {
            hasDrawingData: true,
            hasMLPrediction: !!extendedResult.data.mlPrediction,
            hasStatistics: !!extendedResult.data.statistics,
            hasTechnicalContext: !!extendedResult.data.technicalContext
          };
        }
        break;

      default:
        result.errors.push(`Unknown proposal type: ${type}`);
    }

    // Check UI compatibility
    if (result.isValid && type !== 'extended') {
      const hasUIRequiredFields = checkUICompatibility(proposal, type);
      if (!hasUIRequiredFields.isCompatible) {
        result.warnings = hasUIRequiredFields.missingFields;
      }
    }

  } catch (error) {
    result.errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

/**
 * Check UI compatibility
 */
function checkUICompatibility(proposal: unknown, type: string): { 
  isCompatible: boolean; 
  missingFields: string[] 
} {
  const missingFields: string[] = [];
  const p = proposal as any;

  // Common fields required by UI
  if (!p.id) missingFields.push('id');
  if (!p.confidence) missingFields.push('confidence');
  if (!p.createdAt) missingFields.push('createdAt');

  if (type === 'entry') {
    // Entry-specific UI requirements
    if (!p.entryPrice) missingFields.push('entryPrice');
    if (!p.direction) missingFields.push('direction');
    if (!p.riskParameters) missingFields.push('riskParameters');
  } else {
    // Drawing-specific UI requirements
    if (!p.coordinates) missingFields.push('coordinates');
    if (!p.drawingData) missingFields.push('drawingData');
  }

  return {
    isCompatible: missingFields.length === 0,
    missingFields
  };
}

/**
 * Run all validation tests
 */
async function runValidationTests(): Promise<TestReport> {
  const startTime = Date.now();
  const results: ValidationResult[] = [];

  logger.info('[ProposalValidation] Starting comprehensive proposal validation tests');

  // Test 1: Trendline proposals
  logger.info('[ProposalValidation] Testing trendline proposals...');
  const trendlineProposal = generateTrendlineProposal();
  results.push(validateProposalStructure(trendlineProposal, 'trendline'));

  // Test 2: Support/Resistance proposals
  logger.info('[ProposalValidation] Testing support/resistance proposals...');
  const srProposal = generateSupportResistanceProposal();
  results.push(validateProposalStructure(srProposal, 'support_resistance'));

  // Test 3: Pattern proposals
  logger.info('[ProposalValidation] Testing pattern proposals...');
  const patternProposal = generatePatternProposal();
  results.push(validateProposalStructure(patternProposal, 'pattern'));

  // Test 4: Fibonacci proposals
  logger.info('[ProposalValidation] Testing fibonacci proposals...');
  const fibProposal = generateFibonacciProposal();
  results.push(validateProposalStructure(fibProposal, 'fibonacci'));

  // Test 5: Entry proposals
  logger.info('[ProposalValidation] Testing entry proposals...');
  const entryProposal = generateEntryProposal();
  results.push(validateProposalStructure(entryProposal, 'entry'));

  // Test 6: Mixed proposal group
  logger.info('[ProposalValidation] Testing mixed proposal groups...');
  const mixedGroup = generateMixedProposalGroup();
  const groupResult = DrawingProposalGroupSchema.safeParse(mixedGroup);
  results.push({
    proposalType: 'mixed_group',
    isValid: groupResult.success,
    errors: groupResult.success ? [] : groupResult.error.errors.map(e => 
      `${e.path.join('.')}: ${e.message}`
    ),
    warnings: [],
    structure: {
      proposalCount: mixedGroup.proposals.length,
      hasValidProposals: mixedGroup.proposals.every(p => isDrawingProposal(p))
    },
    sampleData: {
      id: mixedGroup.id,
      title: mixedGroup.title,
      proposalCount: mixedGroup.proposals.length
    }
  });

  // Test 7: Type guards
  logger.info('[ProposalValidation] Testing type guards...');
  const typeGuardTests = {
    isDrawingProposal_valid: isDrawingProposal(trendlineProposal),
    isDrawingProposal_invalid: isDrawingProposal(entryProposal),
    isEntryProposal_valid: isEntryProposal(entryProposal),
    isEntryProposal_invalid: isEntryProposal(trendlineProposal),
  };

  results.push({
    proposalType: 'type_guards',
    isValid: typeGuardTests.isDrawingProposal_valid && 
             !typeGuardTests.isDrawingProposal_invalid &&
             typeGuardTests.isEntryProposal_valid &&
             !typeGuardTests.isEntryProposal_invalid,
    errors: [],
    warnings: [],
    structure: typeGuardTests
  });

  // Calculate summary
  const passed = results.filter(r => r.isValid).length;
  const failed = results.filter(r => !r.isValid).length;
  const totalTime = Date.now() - startTime;

  const summary = `提案検証完了: ${passed}/${results.length}成功。` +
    `トレンドライン、SR、パターン、フィボナッチ、エントリー提案を検証。` +
    `UI互換性${results.filter(r => r.warnings.length === 0).length}/${results.length}`;

  const report: TestReport = {
    timestamp: Date.now(),
    totalTests: results.length,
    passed,
    failed,
    results,
    summary
  };

  logger.info('[ProposalValidation] Validation complete', {
    totalTests: results.length,
    passed,
    failed,
    executionTime: totalTime
  });

  return report;
}

/**
 * Save validation results
 */
async function saveResults(report: TestReport): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const outputPath = path.join(process.cwd(), 'proposal_test_results.json');
  
  await fs.writeFile(
    outputPath,
    JSON.stringify(report, null, 2),
    'utf-8'
  );
  
  logger.info('[ProposalValidation] Results saved to proposal_test_results.json');
}

// Main execution
async function main() {
  try {
    const report = await runValidationTests();
    await saveResults(report);
    
    // Display summary
    console.log('\n=== PROPOSAL VALIDATION SUMMARY ===');
    console.log(`Total Tests: ${report.totalTests}`);
    console.log(`Passed: ${report.passed}`);
    console.log(`Failed: ${report.failed}`);
    console.log(`\nSummary (100-200 chars):`);
    console.log(report.summary);
    
    // Display any errors
    if (report.failed > 0) {
      console.log('\n=== ERRORS ===');
      report.results.forEach((result, index) => {
        if (!result.isValid) {
          console.log(`\n${result.proposalType}:`);
          result.errors.forEach(error => console.log(`  - ${error}`));
        }
      });
    }
    
    // Display any warnings
    const warnings = report.results.filter(r => r.warnings.length > 0);
    if (warnings.length > 0) {
      console.log('\n=== WARNINGS (UI Compatibility) ===');
      warnings.forEach(result => {
        console.log(`\n${result.proposalType}:`);
        result.warnings.forEach(warning => console.log(`  - Missing: ${warning}`));
      });
    }
    
  } catch (error) {
    logger.error('[ProposalValidation] Fatal error', { error });
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { runValidationTests, generateTrendlineProposal, generateEntryProposal };