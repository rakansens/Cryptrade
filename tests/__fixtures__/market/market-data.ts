/**
 * 市場データのフィクスチャ
 */

export const mockMarketOverview = {
  timestamp: Date.now(),
  global: {
    totalMarketCap: 1850000000000,
    total24hVolume: 95000000000,
    btcDominance: 52.5,
    ethDominance: 16.8,
    altcoinMarketCap: 877500000000,
    defiMarketCap: 45000000000,
    stablecoinMarketCap: 135000000000
  },
  topMovers: {
    gainers: [
      { symbol: 'SOLUSDT', change24h: 12.5, price: 98.50, volume: 2500000000 },
      { symbol: 'AVAXUSDT', change24h: 8.3, price: 42.30, volume: 850000000 },
      { symbol: 'DOTUSDT', change24h: 6.7, price: 7.85, volume: 450000000 }
    ],
    losers: [
      { symbol: 'ADAUSDT', change24h: -5.2, price: 0.58, volume: 650000000 },
      { symbol: 'XRPUSDT', change24h: -3.8, price: 0.62, volume: 1200000000 },
      { symbol: 'LINKUSDT', change24h: -2.9, price: 14.20, volume: 380000000 }
    ]
  },
  fearGreedIndex: {
    value: 65,
    valueText: 'Greed',
    timestamp: Date.now(),
    previousValue: 58,
    weekAgo: 45,
    monthAgo: 72
  }
};

export const mockOrderBookData = {
  symbol: 'BTCUSDT',
  timestamp: Date.now(),
  bids: Array.from({ length: 50 }, (_, i) => ({
    price: 48500 - i * 10,
    amount: Math.random() * 5 + 0.1,
    total: 0 // Will be calculated
  })).map((bid, i, arr) => ({
    ...bid,
    total: arr.slice(0, i + 1).reduce((sum, b) => sum + b.amount, 0)
  })),
  asks: Array.from({ length: 50 }, (_, i) => ({
    price: 48501 + i * 10,
    amount: Math.random() * 5 + 0.1,
    total: 0 // Will be calculated
  })).map((ask, i, arr) => ({
    ...ask,
    total: arr.slice(0, i + 1).reduce((sum, a) => sum + a.amount, 0)
  })),
  spread: {
    amount: 1,
    percentage: 0.002
  },
  imbalance: {
    ratio: 1.15,
    side: 'buy',
    strength: 'moderate'
  }
};

export const mockTradeHistory = Array.from({ length: 100 }, (_, i) => ({
  id: `trade-${i}`,
  timestamp: Date.now() - i * 1000,
  price: 48500 + (Math.random() - 0.5) * 100,
  amount: Math.random() * 2 + 0.01,
  side: Math.random() > 0.5 ? 'buy' : 'sell',
  maker: Math.random() > 0.5
}));

export const mockLiquidationData = {
  symbol: 'BTCUSDT',
  timestamp: Date.now(),
  recent: [
    {
      timestamp: Date.now() - 60000,
      side: 'long',
      price: 47800,
      amount: 2.5,
      value: 119500
    },
    {
      timestamp: Date.now() - 120000,
      side: 'short',
      price: 48600,
      amount: 1.8,
      value: 87480
    }
  ],
  summary: {
    last24h: {
      long: { count: 145, volume: 6800000 },
      short: { count: 98, volume: 4200000 },
      total: { count: 243, volume: 11000000 }
    },
    last1h: {
      long: { count: 12, volume: 580000 },
      short: { count: 8, volume: 320000 },
      total: { count: 20, volume: 900000 }
    }
  },
  largestLiquidations: [
    { timestamp: Date.now() - 3600000, side: 'long', amount: 25, value: 1200000 },
    { timestamp: Date.now() - 7200000, side: 'short', amount: 18, value: 864000 }
  ]
};

export const mockFundingRateData = {
  symbol: 'BTCUSDT',
  timestamp: Date.now(),
  current: {
    rate: 0.0015,
    nextFundingTime: Date.now() + 14400000, // 4 hours
    intervalHours: 8
  },
  history: Array.from({ length: 30 }, (_, i) => ({
    timestamp: Date.now() - i * 28800000, // 8 hour intervals
    rate: 0.001 + (Math.random() - 0.5) * 0.002,
    markPrice: 48000 + (Math.random() - 0.5) * 2000,
    indexPrice: 48000 + (Math.random() - 0.5) * 2000
  })),
  statistics: {
    avg7d: 0.0012,
    avg30d: 0.0014,
    max30d: 0.0035,
    min30d: -0.0008,
    cumulativeLast7d: 0.0252
  }
};

export const mockOpenInterestData = {
  symbol: 'BTCUSDT',
  timestamp: Date.now(),
  current: {
    contracts: 245000,
    notional: 11876500000,
    change24h: 5.2,
    change24hNotional: 587000000
  },
  history: Array.from({ length: 168 }, (_, i) => ({ // 7 days hourly
    timestamp: Date.now() - i * 3600000,
    contracts: 245000 + (Math.random() - 0.5) * 20000,
    notional: 11876500000 + (Math.random() - 0.5) * 1000000000
  })),
  byExchange: [
    { exchange: 'Binance', percentage: 35.2, notional: 4180530000 },
    { exchange: 'OKX', percentage: 18.5, notional: 2197152500 },
    { exchange: 'Bybit', percentage: 15.3, notional: 1817104500 },
    { exchange: 'Others', percentage: 31.0, notional: 3681715000 }
  ]
};

export const mockCorrelationData = {
  timestamp: Date.now(),
  timeframe: '30d',
  correlations: {
    BTCUSDT: {
      ETHUSDT: 0.85,
      BNBUSDT: 0.72,
      SOLUSDT: 0.68,
      SP500: 0.45,
      DXY: -0.38,
      GOLD: 0.32
    },
    ETHUSDT: {
      BTCUSDT: 0.85,
      BNBUSDT: 0.78,
      SOLUSDT: 0.73,
      SP500: 0.42,
      DXY: -0.35,
      GOLD: 0.28
    }
  },
  changes: {
    BTCUSDT: {
      ETHUSDT: { current: 0.85, previous: 0.82, change: 0.03 },
      SP500: { current: 0.45, previous: 0.52, change: -0.07 }
    }
  }
};

export const mockSocialSentimentData = {
  symbol: 'BTCUSDT',
  timestamp: Date.now(),
  overall: {
    score: 0.72,
    trend: 'bullish',
    confidence: 0.85
  },
  sources: {
    twitter: {
      mentions: 45200,
      sentiment: 0.68,
      influential_mentions: 120,
      top_influencers: [
        { handle: '@crypto_whale', followers: 250000, sentiment: 'bullish' },
        { handle: '@btc_analyst', followers: 180000, sentiment: 'bullish' }
      ]
    },
    reddit: {
      posts: 320,
      comments: 4500,
      sentiment: 0.75,
      top_subreddits: [
        { name: 'r/cryptocurrency', sentiment: 0.72, activity: 'high' },
        { name: 'r/bitcoin', sentiment: 0.78, activity: 'very_high' }
      ]
    },
    news: {
      articles: 85,
      sentiment: 0.70,
      major_headlines: [
        { 
          title: 'Institutional Adoption Continues to Grow',
          source: 'CoinDesk',
          sentiment: 'positive',
          impact: 'high'
        }
      ]
    }
  },
  keywords: {
    trending: ['bullish', 'institutional', 'etf', 'adoption', 'halving'],
    declining: ['bearish', 'crash', 'regulation', 'ban']
  }
};