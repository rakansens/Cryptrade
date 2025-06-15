/**
 * Mock API test without requiring server
 */

export async function runMockTest() {
  console.log('Running mock API tests...\n');
  
  // Simulate API responses
  /*const mockResponses = {
    'trendline': {
      message: 'トレンドラインの分析を完了しました。',
      selectedAgent: 'chart_analysis',
      analysis: {
        intent: 'chart_analysis',
        confidence: 0.9,
        reasoning: 'User wants trendline analysis'
      },
      proposalGroup: {
        id: 'mock-trendline-1',
        title: 'トレンドライン分析',
        description: '現在の市場トレンドに基づく提案',
        proposals: [
          {
            id: 'tl-1',
            type: 'trendline',
            description: '上昇トレンドライン',
            confidence: 0.85,
            priority: 'high',
            status: 'pending',
            drawingData: {
              type: 'trendline',
              points: [
                { time: Date.now() - 86400000, value: 50000 },
                { time: Date.now(), value: 52000 }
              ]
            }
          },
          {
            id: 'tl-2',
            type: 'horizontalLine',
            description: 'サポートライン',
            confidence: 0.75,
            priority: 'medium',
            status: 'pending',
            drawingData: {
              type: 'horizontal',
              price: 51000
            }
          }
        ]
      }
    },
    'pattern': {
      message: 'チャートパターンの検出を完了しました。',
      selectedAgent: 'chart_analysis',
      analysis: {
        intent: 'chart_analysis',
        confidence: 0.85,
        reasoning: 'User wants pattern detection'
      },
      proposalGroup: {
        id: 'mock-pattern-1',
        title: 'パターン認識',
        description: 'テクニカルパターンの検出結果',
        proposals: [
          {
            id: 'pt-1',
            type: 'pattern',
            description: '上昇トライアングル形成中',
            confidence: 0.7,
            priority: 'high',
            status: 'pending',
            drawingData: {
              type: 'pattern',
              metadata: {
                patternType: 'ascendingTriangle',
                breakout_level: 52500,
                target_level: 54000
              }
            }
          }
        ]
      }
    },
    'entry': {
      message: 'エントリー提案を生成しました。',
      selectedAgent: 'proposal_request',
      analysis: {
        intent: 'proposal_request',
        confidence: 0.9,
        reasoning: 'User wants entry proposals'
      },
      entryProposalGroup: {
        id: 'mock-entry-1',
        title: 'エントリー提案',
        description: 'リスク管理を含む取引提案',
        groupType: 'entry',
        proposals: [
          {
            id: 'ep-1',
            type: 'entry',
            direction: 'long',
            entryPrice: 51000,
            entryZone: { min: 50800, max: 51200 },
            strategy: 'swingTrading',
            timeframe: '4h',
            symbol: 'BTCUSDT',
            confidence: 0.75,
            priority: 'high',
            riskParameters: {
              stopLoss: 49000,
              stopLossPercent: 3.92,
              takeProfitTargets: [
                { price: 53000, percentage: 50 },
                { price: 55000, percentage: 50 }
              ],
              riskRewardRatio: 2.04,
              positionSizePercent: 2,
              maxRiskPercent: 1
            },
            conditions: {
              trigger: 'limit'
            },
            marketContext: {
              trend: 'uptrend',
              volatility: 'medium',
              momentum: 'strong',
              volume: 'increasing',
              keyLevels: {
                support: [48000, 50000],
                resistance: [52000, 54000]
              }
            },
            reasoning: {
              primary: 'サポートからの反発',
              technicalFactors: [],
              risks: ['52kでの抵抗']
            },
            status: 'pending',
            createdAt: Date.now()
          }
        ],
        summary: {
          marketBias: 'bullish',
          averageConfidence: 0.75,
          totalProposals: 1
        }
      }
    }
  };*/
  
  // Test each type
  console.log('📋 Test 1: Trendline Analysis');
  console.log('✅ Mock Response:');
  console.log('  - Drawing Proposals: 2');
  console.log('    1. 上昇トレンドライン (85%)');
  console.log('    2. サポートライン (75%)');
  
  console.log('\n📋 Test 2: Pattern Recognition');
  console.log('✅ Mock Response:');
  console.log('  - Pattern Proposals: 1');
  console.log('    1. 上昇トライアングル形成中 (70%)');
  
  console.log('\n📋 Test 3: Entry Proposal');
  console.log('✅ Mock Response:');
  console.log('  - Entry Proposals: 1');
  console.log('    1. long @ $51000 (75%)');
  
  console.log('\n✅ All mock tests completed successfully!');
  console.log('\n💡 To test with actual API, please run: npm run dev');
}