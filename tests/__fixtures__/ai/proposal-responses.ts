/**
 * AI提案レスポンスのフィクスチャ
 */

export const mockTradingProposal = {
  id: 'proposal-1',
  timestamp: Date.now(),
  marketAnalysis: {
    trend: 'bullish',
    strength: 0.75,
    timeframe: '4h',
    keyLevels: {
      support: [47500, 47000, 46500],
      resistance: [48500, 49000, 49500]
    },
    indicators: {
      rsi: { value: 58, signal: 'neutral' },
      macd: { value: 150, signal: 'bullish', histogram: 50 },
      ma20: { value: 47800, trend: 'up' },
      ma50: { value: 47200, trend: 'up' },
      bollingerBands: {
        upper: 48800,
        middle: 48000,
        lower: 47200,
        width: 1600
      }
    }
  },
  patterns: [
    {
      type: 'ascending_triangle',
      confidence: 0.85,
      target: 49500,
      stopLoss: 47500,
      description: '上昇三角形パターンが形成されています。レジスタンスラインのブレイクアウトを待ちましょう。'
    },
    {
      type: 'support_bounce',
      confidence: 0.72,
      target: 48500,
      stopLoss: 47000,
      description: '強いサポートラインからの反発が確認されました。'
    }
  ],
  tradingStrategy: {
    entry: {
      price: 48200,
      condition: 'レジスタンスライン48500を上抜けした場合',
      timing: '4時間足の確定を待つ'
    },
    targets: [
      { price: 48800, percentage: 50, reason: '最初の利確ポイント' },
      { price: 49200, percentage: 30, reason: 'フィボナッチ61.8%' },
      { price: 49500, percentage: 20, reason: 'パターン目標値' }
    ],
    stopLoss: {
      price: 47500,
      reason: 'サポートライン下抜け',
      riskRewardRatio: '1:2.5'
    },
    positionSize: {
      recommendation: '総資金の2%',
      calculation: 'リスク額 / (エントリー価格 - ストップロス価格)'
    }
  },
  riskAssessment: {
    marketRisk: 'medium',
    volatility: 'moderate',
    correlations: {
      sp500: 0.65,
      dxy: -0.45,
      gold: 0.35
    },
    warnings: [
      'FOMCの発表が控えているため、ボラティリティが高まる可能性があります',
      'ビットコインのドミナンスが低下傾向にあります'
    ]
  },
  confidence: 0.78,
  reasoning: `現在の市場環境は上昇トレンドを示しており、テクニカル指標も買いシグナルを支持しています。
  上昇三角形パターンの形成により、ブレイクアウトの可能性が高まっています。
  ただし、マクロ経済の不確実性があるため、適切なリスク管理が必要です。`,
  alternativeScenarios: [
    {
      scenario: 'レンジ継続',
      probability: 0.3,
      action: '47500-48500のレンジでの取引を検討'
    },
    {
      scenario: '下方ブレイク',
      probability: 0.2,
      action: '47000でのサポート確認を待つ'
    }
  ]
};

export const mockDrawingProposal = {
  id: 'drawing-proposal-1',
  timestamp: Date.now(),
  drawings: [
    {
      type: 'trendline',
      points: [
        { time: 1638360000, price: 47500 },
        { time: 1638619200, price: 49000 }
      ],
      style: {
        color: '#4CAF50',
        width: 2,
        lineStyle: 'solid'
      },
      description: '主要な上昇トレンドライン'
    },
    {
      type: 'horizontal',
      price: 48500,
      style: {
        color: '#FF5252',
        width: 2,
        lineStyle: 'dashed'
      },
      description: 'キーレジスタンスレベル'
    },
    {
      type: 'fibonacci',
      points: [
        { time: 1638360000, price: 47000 },
        { time: 1638446400, price: 49500 }
      ],
      levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1],
      style: {
        color: '#2196F3',
        width: 1,
        lineStyle: 'dotted'
      },
      description: 'フィボナッチリトレースメント'
    },
    {
      type: 'channel',
      points: [
        { time: 1638360000, price: 47500, line: 'lower' },
        { time: 1638360000, price: 48500, line: 'upper' },
        { time: 1638619200, price: 49000, line: 'lower' },
        { time: 1638619200, price: 50000, line: 'upper' }
      ],
      style: {
        color: '#9C27B0',
        width: 2,
        lineStyle: 'solid',
        fillOpacity: 0.1
      },
      description: '上昇チャネル'
    }
  ],
  analysis: '複数の重要な価格レベルとパターンが確認されています。特に48500のレジスタンスラインは過去3回テストされており、ブレイクアウトすれば強い上昇が期待できます。',
  recommendations: [
    'トレンドラインのサポートでのエントリーを検討',
    'フィボナッチ61.8%レベルでの反発を確認',
    'チャネル上限でのレジスタンスに注意'
  ]
};

export const mockIndicatorAnalysis = {
  id: 'indicator-analysis-1',
  timestamp: Date.now(),
  timeframe: '1h',
  indicators: {
    movingAverages: {
      sma20: { value: 48200, trend: 'up', price_position: 'above' },
      sma50: { value: 47800, trend: 'up', price_position: 'above' },
      sma200: { value: 47000, trend: 'up', price_position: 'above' },
      ema20: { value: 48300, trend: 'up', price_position: 'above' },
      ema50: { value: 47900, trend: 'up', price_position: 'above' },
      crossovers: [
        { type: 'golden_cross', ma1: 'sma20', ma2: 'sma50', time: 1638446400 }
      ]
    },
    rsi: {
      value: 62,
      oversold: false,
      overbought: false,
      divergence: null,
      trend: 'rising',
      signal: 'neutral-bullish'
    },
    macd: {
      macd: 120,
      signal: 80,
      histogram: 40,
      trend: 'bullish',
      crossover: { type: 'bullish', time: 1638360000 },
      divergence: null
    },
    bollingerBands: {
      upper: 48800,
      middle: 48000,
      lower: 47200,
      bandwidth: 1600,
      percentB: 0.75,
      squeeze: false,
      trend: 'expanding'
    },
    stochastic: {
      k: 72,
      d: 68,
      oversold: false,
      overbought: false,
      crossover: { type: 'bullish', time: 1638403200 },
      signal: 'bullish'
    },
    atr: {
      value: 250,
      trend: 'increasing',
      volatility: 'moderate'
    },
    volume: {
      current: 15000,
      average: 12000,
      trend: 'increasing',
      obv_trend: 'bullish'
    }
  },
  summary: {
    trend: 'bullish',
    strength: 'moderate',
    momentum: 'positive',
    volatility: 'normal',
    signals: {
      buy: 7,
      neutral: 2,
      sell: 1
    }
  },
  recommendations: [
    {
      action: 'buy',
      confidence: 0.75,
      reason: '複数の指標が買いシグナルを示しています'
    },
    {
      action: 'wait',
      condition: 'RSIが70を超えた場合は一旦利確を検討'
    }
  ]
};

export const mockMarketSentiment = {
  id: 'sentiment-1',
  timestamp: Date.now(),
  overall: 'bullish',
  score: 0.68,
  sources: {
    technical: { score: 0.75, weight: 0.4 },
    onChain: { score: 0.65, weight: 0.3 },
    social: { score: 0.60, weight: 0.2 },
    fundamental: { score: 0.70, weight: 0.1 }
  },
  fearGreedIndex: {
    value: 65,
    classification: 'greed',
    change: '+5'
  },
  keyMetrics: {
    longShortRatio: 1.35,
    openInterest: '$2.5B',
    fundingRate: 0.015,
    spotPremium: 0.2
  },
  newsEvents: [
    {
      timestamp: Date.now() - 3600000,
      impact: 'high',
      sentiment: 'positive',
      title: 'Major institution announces Bitcoin allocation'
    },
    {
      timestamp: Date.now() - 7200000,
      impact: 'medium',
      sentiment: 'neutral',
      title: 'Fed maintains current interest rate policy'
    }
  ]
};

export const generateStreamingResponse = (baseResponse: any, chunks: number = 10) => {
  const responses = [];
  const fullText = JSON.stringify(baseResponse);
  const chunkSize = Math.ceil(fullText.length / chunks);
  
  for (let i = 0; i < chunks; i++) {
    const start = i * chunkSize;
    const end = Math.min((i + 1) * chunkSize, fullText.length);
    responses.push({
      chunk: fullText.slice(start, end),
      done: i === chunks - 1,
      progress: ((i + 1) / chunks) * 100
    });
  }
  
  return responses;
};