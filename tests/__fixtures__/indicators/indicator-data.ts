/**
 * テクニカル指標データのフィクスチャ
 */

export const mockRSIData = [
  { time: 1638360000, value: 45 },
  { time: 1638363600, value: 48 },
  { time: 1638367200, value: 52 },
  { time: 1638370800, value: 58 },
  { time: 1638374400, value: 62 },
  { time: 1638378000, value: 65 },
  { time: 1638381600, value: 68 },
  { time: 1638385200, value: 70 },
  { time: 1638388800, value: 72 },
  { time: 1638392400, value: 69 }
];

export const mockMACDData = [
  {
    time: 1638360000,
    macd: 120,
    signal: 100,
    histogram: 20
  },
  {
    time: 1638363600,
    macd: 125,
    signal: 105,
    histogram: 20
  },
  {
    time: 1638367200,
    macd: 130,
    signal: 110,
    histogram: 20
  },
  {
    time: 1638370800,
    macd: 140,
    signal: 118,
    histogram: 22
  },
  {
    time: 1638374400,
    macd: 150,
    signal: 125,
    histogram: 25
  },
  {
    time: 1638378000,
    macd: 155,
    signal: 132,
    histogram: 23
  },
  {
    time: 1638381600,
    macd: 160,
    signal: 140,
    histogram: 20
  },
  {
    time: 1638385200,
    macd: 158,
    signal: 145,
    histogram: 13
  },
  {
    time: 1638388800,
    macd: 155,
    signal: 148,
    histogram: 7
  },
  {
    time: 1638392400,
    macd: 152,
    signal: 150,
    histogram: 2
  }
];

export const mockBollingerBandsData = [
  {
    time: 1638360000,
    upper: 48800,
    middle: 48000,
    lower: 47200
  },
  {
    time: 1638363600,
    upper: 48850,
    middle: 48050,
    lower: 47250
  },
  {
    time: 1638367200,
    upper: 48900,
    middle: 48100,
    lower: 47300
  },
  {
    time: 1638370800,
    upper: 48950,
    middle: 48150,
    lower: 47350
  },
  {
    time: 1638374400,
    upper: 49000,
    middle: 48200,
    lower: 47400
  },
  {
    time: 1638378000,
    upper: 49050,
    middle: 48250,
    lower: 47450
  },
  {
    time: 1638381600,
    upper: 49100,
    middle: 48300,
    lower: 47500
  },
  {
    time: 1638385200,
    upper: 49120,
    middle: 48320,
    lower: 47520
  },
  {
    time: 1638388800,
    upper: 49150,
    middle: 48350,
    lower: 47550
  },
  {
    time: 1638392400,
    upper: 49200,
    middle: 48400,
    lower: 47600
  }
];

export const mockStochasticData = [
  { time: 1638360000, k: 30, d: 35 },
  { time: 1638363600, k: 35, d: 32 },
  { time: 1638367200, k: 42, d: 36 },
  { time: 1638370800, k: 50, d: 42 },
  { time: 1638374400, k: 58, d: 50 },
  { time: 1638378000, k: 65, d: 58 },
  { time: 1638381600, k: 72, d: 65 },
  { time: 1638385200, k: 78, d: 72 },
  { time: 1638388800, k: 82, d: 77 },
  { time: 1638392400, k: 80, d: 80 }
];

export const mockATRData = [
  { time: 1638360000, value: 200 },
  { time: 1638363600, value: 210 },
  { time: 1638367200, value: 220 },
  { time: 1638370800, value: 230 },
  { time: 1638374400, value: 240 },
  { time: 1638378000, value: 250 },
  { time: 1638381600, value: 245 },
  { time: 1638385200, value: 240 },
  { time: 1638388800, value: 235 },
  { time: 1638392400, value: 230 }
];

export const mockMovingAverageData = {
  sma20: [
    { time: 1638360000, value: 47900 },
    { time: 1638363600, value: 47950 },
    { time: 1638367200, value: 48000 },
    { time: 1638370800, value: 48050 },
    { time: 1638374400, value: 48100 },
    { time: 1638378000, value: 48150 },
    { time: 1638381600, value: 48200 },
    { time: 1638385200, value: 48250 },
    { time: 1638388800, value: 48300 },
    { time: 1638392400, value: 48350 }
  ],
  sma50: [
    { time: 1638360000, value: 47600 },
    { time: 1638363600, value: 47650 },
    { time: 1638367200, value: 47700 },
    { time: 1638370800, value: 47750 },
    { time: 1638374400, value: 47800 },
    { time: 1638378000, value: 47850 },
    { time: 1638381600, value: 47900 },
    { time: 1638385200, value: 47950 },
    { time: 1638388800, value: 48000 },
    { time: 1638392400, value: 48050 }
  ],
  ema20: [
    { time: 1638360000, value: 47950 },
    { time: 1638363600, value: 48000 },
    { time: 1638367200, value: 48050 },
    { time: 1638370800, value: 48100 },
    { time: 1638374400, value: 48150 },
    { time: 1638378000, value: 48200 },
    { time: 1638381600, value: 48250 },
    { time: 1638385200, value: 48300 },
    { time: 1638388800, value: 48350 },
    { time: 1638392400, value: 48400 }
  ]
};

export const generateIndicatorSignals = (indicatorType: string, data: any[]) => {
  const signals = [];
  
  switch (indicatorType) {
    case 'rsi':
      for (let i = 1; i < data.length; i++) {
        if (data[i].value > 70 && data[i-1].value <= 70) {
          signals.push({
            time: data[i].time,
            type: 'overbought',
            action: 'sell',
            strength: 'medium'
          });
        } else if (data[i].value < 30 && data[i-1].value >= 30) {
          signals.push({
            time: data[i].time,
            type: 'oversold',
            action: 'buy',
            strength: 'medium'
          });
        }
      }
      break;
      
    case 'macd':
      for (let i = 1; i < data.length; i++) {
        if (data[i].macd > data[i].signal && data[i-1].macd <= data[i-1].signal) {
          signals.push({
            time: data[i].time,
            type: 'bullish_crossover',
            action: 'buy',
            strength: 'strong'
          });
        } else if (data[i].macd < data[i].signal && data[i-1].macd >= data[i-1].signal) {
          signals.push({
            time: data[i].time,
            type: 'bearish_crossover',
            action: 'sell',
            strength: 'strong'
          });
        }
      }
      break;
  }
  
  return signals;
};

export const mockCombinedIndicatorAnalysis = {
  timestamp: Date.now(),
  summary: {
    trend: 'bullish',
    strength: 0.75,
    signals: {
      rsi: 'neutral',
      macd: 'bullish',
      stochastic: 'overbought',
      bollingerBands: 'upper_band_touch'
    },
    recommendation: 'hold_or_partial_profit'
  },
  details: {
    rsi: {
      current: 68,
      previous: 65,
      trend: 'rising',
      signal: 'approaching_overbought'
    },
    macd: {
      current: { macd: 155, signal: 132, histogram: 23 },
      trend: 'bullish',
      lastCrossover: { type: 'bullish', daysAgo: 3 }
    },
    movingAverages: {
      price_vs_ma20: 'above',
      price_vs_ma50: 'above',
      ma20_vs_ma50: 'above',
      alignment: 'bullish'
    },
    volatility: {
      atr: 245,
      atr_percentage: 0.51,
      bollinger_width: 1900,
      volatility_rank: 'moderate'
    }
  }
};