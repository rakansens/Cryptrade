/**
 * データベースモックデータ
 */

export const mockUsers = [
  {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'user-2',
    email: 'trader@example.com',
    name: 'Pro Trader',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02')
  }
];

export const mockChartDrawings = [
  {
    id: 'drawing-1',
    userId: 'user-1',
    symbol: 'BTCUSDT',
    type: 'trendline',
    data: {
      points: [
        { time: 1638360000, price: 47500 },
        { time: 1638619200, price: 49000 }
      ],
      style: { color: '#4CAF50', width: 2 }
    },
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10')
  },
  {
    id: 'drawing-2',
    userId: 'user-1',
    symbol: 'BTCUSDT',
    type: 'horizontal',
    data: {
      price: 48500,
      style: { color: '#FF5252', width: 2, lineStyle: 'dashed' }
    },
    createdAt: new Date('2024-01-11'),
    updatedAt: new Date('2024-01-11')
  },
  {
    id: 'drawing-3',
    userId: 'user-2',
    symbol: 'ETHUSDT',
    type: 'fibonacci',
    data: {
      points: [
        { time: 1638360000, price: 3200 },
        { time: 1638446400, price: 3500 }
      ],
      levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1],
      style: { color: '#2196F3', width: 1 }
    },
    createdAt: new Date('2024-01-12'),
    updatedAt: new Date('2024-01-12')
  }
];

export const mockChatMessages = [
  {
    id: 'msg-1',
    userId: 'user-1',
    conversationId: 'conv-1',
    role: 'user',
    content: 'BTCUSDTの現在の分析を教えてください',
    createdAt: new Date('2024-01-15T10:00:00'),
    updatedAt: new Date('2024-01-15T10:00:00')
  },
  {
    id: 'msg-2',
    userId: 'user-1',
    conversationId: 'conv-1',
    role: 'assistant',
    content: 'BTCUSDTは現在上昇トレンドにあります。主要なサポートは47,500ドル、レジスタンスは48,500ドルです。',
    metadata: {
      model: 'gpt-4',
      tokens: 150,
      confidence: 0.85
    },
    createdAt: new Date('2024-01-15T10:00:30'),
    updatedAt: new Date('2024-01-15T10:00:30')
  },
  {
    id: 'msg-3',
    userId: 'user-1',
    conversationId: 'conv-1',
    role: 'user',
    content: 'エントリーポイントはどこがいいですか？',
    createdAt: new Date('2024-01-15T10:01:00'),
    updatedAt: new Date('2024-01-15T10:01:00')
  },
  {
    id: 'msg-4',
    userId: 'user-1',
    conversationId: 'conv-1',
    role: 'assistant',
    content: '47,800ドル付近でのサポートテストを待つことをお勧めします。ストップロスは47,500ドル下に設定してください。',
    metadata: {
      model: 'gpt-4',
      tokens: 120,
      confidence: 0.82
    },
    createdAt: new Date('2024-01-15T10:01:30'),
    updatedAt: new Date('2024-01-15T10:01:30')
  }
];

export const mockConversations = [
  {
    id: 'conv-1',
    userId: 'user-1',
    title: 'BTCUSDT分析セッション',
    symbol: 'BTCUSDT',
    messageCount: 4,
    lastMessageAt: new Date('2024-01-15T10:01:30'),
    createdAt: new Date('2024-01-15T10:00:00'),
    updatedAt: new Date('2024-01-15T10:01:30')
  },
  {
    id: 'conv-2',
    userId: 'user-1',
    title: 'ETH相場見通し',
    symbol: 'ETHUSDT',
    messageCount: 2,
    lastMessageAt: new Date('2024-01-14T15:30:00'),
    createdAt: new Date('2024-01-14T15:00:00'),
    updatedAt: new Date('2024-01-14T15:30:00')
  },
  {
    id: 'conv-3',
    userId: 'user-2',
    title: '仮想通貨市場分析',
    symbol: null,
    messageCount: 10,
    lastMessageAt: new Date('2024-01-13T20:00:00'),
    createdAt: new Date('2024-01-13T18:00:00'),
    updatedAt: new Date('2024-01-13T20:00:00')
  }
];

export const mockAnalysisResults = [
  {
    id: 'analysis-1',
    userId: 'user-1',
    symbol: 'BTCUSDT',
    timeframe: '4h',
    type: 'pattern_recognition',
    result: {
      patterns: ['ascending_triangle', 'support_bounce'],
      confidence: 0.85,
      signals: ['bullish'],
      keyLevels: {
        support: [47500, 47000],
        resistance: [48500, 49000]
      }
    },
    createdAt: new Date('2024-01-15T09:00:00'),
    updatedAt: new Date('2024-01-15T09:00:00')
  },
  {
    id: 'analysis-2',
    userId: 'user-1',
    symbol: 'BTCUSDT',
    timeframe: '1h',
    type: 'indicator_analysis',
    result: {
      indicators: {
        rsi: { value: 62, signal: 'neutral' },
        macd: { value: 120, signal: 'bullish' },
        ma20: { value: 48200, position: 'below_price' }
      },
      overallSignal: 'bullish',
      strength: 0.72
    },
    createdAt: new Date('2024-01-15T10:00:00'),
    updatedAt: new Date('2024-01-15T10:00:00')
  }
];

export const mockTradingProposals = [
  {
    id: 'proposal-1',
    userId: 'user-1',
    symbol: 'BTCUSDT',
    type: 'long',
    status: 'active',
    entry: {
      price: 48200,
      condition: 'break_above_resistance',
      timing: '4h_close'
    },
    targets: [
      { price: 48800, percentage: 50 },
      { price: 49200, percentage: 30 },
      { price: 49500, percentage: 20 }
    ],
    stopLoss: {
      price: 47500,
      type: 'fixed'
    },
    riskReward: 2.5,
    confidence: 0.78,
    analysis: {
      patterns: ['ascending_triangle'],
      indicators: ['macd_bullish', 'rsi_neutral'],
      marketCondition: 'trending_up'
    },
    createdAt: new Date('2024-01-15T11:00:00'),
    updatedAt: new Date('2024-01-15T11:00:00'),
    expiresAt: new Date('2024-01-16T11:00:00')
  },
  {
    id: 'proposal-2',
    userId: 'user-2',
    symbol: 'ETHUSDT',
    type: 'short',
    status: 'expired',
    entry: {
      price: 3400,
      condition: 'rejection_at_resistance',
      timing: 'immediate'
    },
    targets: [
      { price: 3350, percentage: 40 },
      { price: 3300, percentage: 40 },
      { price: 3250, percentage: 20 }
    ],
    stopLoss: {
      price: 3450,
      type: 'trailing',
      trailingDistance: 50
    },
    riskReward: 3.0,
    confidence: 0.82,
    analysis: {
      patterns: ['double_top'],
      indicators: ['rsi_overbought', 'macd_bearish'],
      marketCondition: 'range_bound'
    },
    createdAt: new Date('2024-01-14T14:00:00'),
    updatedAt: new Date('2024-01-14T14:00:00'),
    expiresAt: new Date('2024-01-15T14:00:00')
  }
];

export const mockUserSettings = [
  {
    id: 'settings-1',
    userId: 'user-1',
    preferences: {
      theme: 'dark',
      language: 'ja',
      timezone: 'Asia/Tokyo',
      notifications: {
        email: true,
        push: false,
        priceAlerts: true,
        analysisComplete: true
      }
    },
    tradingPreferences: {
      defaultSymbol: 'BTCUSDT',
      defaultTimeframe: '4h',
      riskPerTrade: 0.02,
      preferredIndicators: ['rsi', 'macd', 'bollinger'],
      autoSaveDrawings: true
    },
    apiKeys: {
      binance: {
        isConfigured: true,
        permissions: ['read', 'trade'],
        lastUsed: new Date('2024-01-15T10:00:00')
      }
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15')
  }
];