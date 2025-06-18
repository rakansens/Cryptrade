/**
 * エッジケースのマーケットデータフィクスチャ
 */

import { CandlestickData, Time } from 'lightweight-charts';

// Extreme market conditions
export const mockExtremeMarketData = {
  // Flash crash scenario
  flashCrash: {
    candles: [
      { time: 1638360000 as Time, open: 48000, high: 48100, low: 47900, close: 48050 },
      { time: 1638360300 as Time, open: 48050, high: 48150, low: 48000, close: 48100 },
      { time: 1638360600 as Time, open: 48100, high: 48100, low: 35000, close: 36000 }, // Flash crash
      { time: 1638360900 as Time, open: 36000, high: 42000, low: 35500, close: 41000 }, // Quick recovery
      { time: 1638361200 as Time, open: 41000, high: 45000, low: 40500, close: 44000 },
      { time: 1638361500 as Time, open: 44000, high: 46000, low: 43500, close: 45500 }
    ] as CandlestickData[],
    description: 'Flash crash with 27% drop and rapid recovery'
  },
  
  // Zero volume candles
  zeroVolume: {
    candles: [
      { time: 1638360000 as Time, open: 48000, high: 48000, low: 48000, close: 48000, volume: 0 },
      { time: 1638360300 as Time, open: 48000, high: 48000, low: 48000, close: 48000, volume: 0 },
      { time: 1638360600 as Time, open: 48000, high: 48000, low: 48000, close: 48000, volume: 0 }
    ] as CandlestickData[],
    description: 'No trading activity - all prices identical with zero volume'
  },
  
  // Extreme volatility
  extremeVolatility: {
    candles: [
      { time: 1638360000 as Time, open: 48000, high: 52000, low: 44000, close: 50000 },
      { time: 1638360300 as Time, open: 50000, high: 55000, low: 45000, close: 47000 },
      { time: 1638360600 as Time, open: 47000, high: 53000, low: 42000, close: 51000 },
      { time: 1638360900 as Time, open: 51000, high: 58000, low: 46000, close: 49000 }
    ] as CandlestickData[],
    description: 'Extreme price swings of 15-20% per candle'
  },
  
  // Gap scenarios
  priceGaps: {
    candles: [
      { time: 1638360000 as Time, open: 48000, high: 48500, low: 47800, close: 48200 },
      { time: 1638360300 as Time, open: 50000, high: 50500, low: 49800, close: 50200 }, // Gap up
      { time: 1638360600 as Time, open: 50200, high: 50400, low: 50000, close: 50100 },
      { time: 1638360900 as Time, open: 47000, high: 47200, low: 46800, close: 47100 }, // Gap down
      { time: 1638361200 as Time, open: 47100, high: 47300, low: 46900, close: 47200 }
    ] as CandlestickData[],
    description: 'Price gaps between candles'
  },
  
  // Limit moves
  limitMoves: {
    candles: [
      { time: 1638360000 as Time, open: 48000, high: 52800, low: 48000, close: 52800 }, // Limit up (10%)
      { time: 1638360300 as Time, open: 52800, high: 52800, low: 52800, close: 52800 }, // Locked limit
      { time: 1638360600 as Time, open: 52800, high: 52800, low: 52800, close: 52800 }, // Still locked
      { time: 1638360900 as Time, open: 52800, high: 53000, low: 52600, close: 52900 }  // Unlocked
    ] as CandlestickData[],
    description: 'Limit up move with locked trading'
  }
};

// Edge case order book data
export const mockEdgeCaseOrderBook = {
  // Extremely thin order book
  thinBook: {
    bids: [
      ['48000.00', '0.00100000'],
      ['47000.00', '0.00050000'],
      ['46000.00', '0.00025000']
    ],
    asks: [
      ['48001.00', '0.00100000'],
      ['49000.00', '0.00050000'],
      ['50000.00', '0.00025000']
    ],
    description: 'Very low liquidity with large spreads'
  },
  
  // One-sided order book
  oneSided: {
    bids: [
      ['48000.00', '100.00000000'],
      ['47999.00', '150.00000000'],
      ['47998.00', '200.00000000']
    ],
    asks: [], // No sellers
    description: 'Only buyers in the market'
  },
  
  // Spoofing pattern
  spoofing: {
    bids: [
      ['48000.00', '0.10000000'],
      ['47999.00', '0.10000000'],
      ['47998.00', '1000.00000000'], // Large spoof order
      ['47997.00', '0.10000000']
    ],
    asks: [
      ['48001.00', '0.10000000'],
      ['48002.00', '0.10000000'],
      ['48003.00', '1000.00000000'], // Large spoof order
      ['48004.00', '0.10000000']
    ],
    description: 'Large orders potentially used for market manipulation'
  },
  
  // Crossed order book (error state)
  crossed: {
    bids: [
      ['48100.00', '10.00000000'], // Bid higher than ask
      ['48050.00', '5.00000000'],
      ['48000.00', '15.00000000']
    ],
    asks: [
      ['48000.00', '10.00000000'], // Ask lower than bid
      ['48050.00', '5.00000000'],
      ['48100.00', '15.00000000']
    ],
    description: 'Invalid state where bid > ask'
  }
};

// Edge case trade data
export const mockEdgeCaseTrades = {
  // Micro trades (dust)
  dustTrades: [
    {
      id: 1,
      price: '48000.00',
      quantity: '0.00000001', // Minimum BTC amount
      time: 1638360000000,
      isBuyerMaker: true
    },
    {
      id: 2,
      price: '48000.01',
      quantity: '0.00000010',
      time: 1638360001000,
      isBuyerMaker: false
    }
  ],
  
  // Whale trades
  whaleTrades: [
    {
      id: 1000,
      price: '48000.00',
      quantity: '1000.00000000', // Very large trade
      time: 1638360000000,
      isBuyerMaker: false,
      impact: 'Market moved 2% on this trade'
    }
  ],
  
  // Rapid fire trades (HFT pattern)
  hftTrades: Array(100).fill(null).map((_, i) => ({
    id: 2000 + i,
    price: (48000 + (i % 2) * 0.01).toFixed(2),
    quantity: '0.10000000',
    time: 1638360000000 + i * 10, // 10ms apart
    isBuyerMaker: i % 2 === 0
  })),
  
  // Same price different quantity
  samePriceTrades: Array(10).fill(null).map((_, i) => ({
    id: 3000 + i,
    price: '48000.00',
    quantity: (Math.random() * 10).toFixed(8),
    time: 1638360000000 + i * 1000,
    isBuyerMaker: i % 2 === 0
  }))
};

// WebSocket edge cases
export const mockWebSocketEdgeCases = {
  // Malformed messages
  malformed: {
    missingFields: {
      e: 'kline',
      // Missing required fields
    },
    
    invalidTypes: {
      e: 'kline',
      E: 'not-a-number', // Should be number
      s: 12345, // Should be string
      k: null // Should be object
    },
    
    corrupted: '{"e":"kline","E":1638360000000,"s":"BTCUSDT"', // Incomplete JSON
  },
  
  // Out of sequence messages
  outOfSequence: [
    { e: 'trade', t: 1005, time: 1638360005000 },
    { e: 'trade', t: 1003, time: 1638360003000 }, // Earlier trade ID arrives later
    { e: 'trade', t: 1007, time: 1638360007000 },
    { e: 'trade', t: 1004, time: 1638360004000 }  // Very delayed
  ],
  
  // Duplicate messages
  duplicates: [
    { e: 'trade', t: 2001, price: '48000.00', quantity: '1.00000000' },
    { e: 'trade', t: 2001, price: '48000.00', quantity: '1.00000000' }, // Exact duplicate
    { e: 'trade', t: 2001, price: '48000.01', quantity: '1.00000000' }  // Same ID, different data
  ],
  
  // Connection state messages
  connectionStates: {
    rapidReconnects: [
      { type: 'connected', timestamp: 1638360000000 },
      { type: 'disconnected', timestamp: 1638360001000 },
      { type: 'connected', timestamp: 1638360002000 },
      { type: 'disconnected', timestamp: 1638360003000 },
      { type: 'connected', timestamp: 1638360004000 }
    ],
    
    authenticationFailures: [
      { type: 'error', code: 'AUTH_FAILED', message: 'Invalid API key' },
      { type: 'error', code: 'AUTH_EXPIRED', message: 'Session expired' },
      { type: 'error', code: 'RATE_LIMITED', message: 'Too many auth attempts' }
    ]
  }
};

// Indicator edge cases
export const mockIndicatorEdgeCases = {
  // Not enough data for calculation
  insufficientData: {
    prices: [48000, 48100], // Need at least 14 for RSI
    error: 'Insufficient data points for indicator calculation'
  },
  
  // All same values
  flatData: {
    prices: Array(100).fill(48000),
    rsi: 50, // RSI undefined behavior
    macd: { macd: 0, signal: 0, histogram: 0 },
    description: 'No price movement'
  },
  
  // Extreme values
  extremeValues: {
    prices: [1, 1000000, 0.00000001, 999999999],
    description: 'Extreme price variations that may break calculations'
  },
  
  // NaN and Infinity cases
  invalidCalculations: {
    divisionByZero: {
      input: { high: 100, low: 100, close: 100 },
      atr: NaN,
      description: 'True range is 0'
    },
    
    overflow: {
      input: { value: Number.MAX_VALUE, multiplier: 2 },
      result: Infinity,
      description: 'Calculation overflow'
    }
  }
};

// Time-related edge cases
export const mockTimeEdgeCases = {
  // Daylight saving time transitions
  dstTransition: {
    candles: [
      { time: 1636246800 as Time, open: 48000, high: 48100, low: 47900, close: 48050 }, // 2:00 AM
      { time: 1636250400 as Time, open: 48050, high: 48150, low: 48000, close: 48100 }, // 2:00 AM again
    ],
    description: 'DST fall back causing duplicate hour'
  },
  
  // Leap second
  leapSecond: {
    trades: [
      { time: 1483228799000, price: '48000.00' }, // 23:59:59
      { time: 1483228799500, price: '48000.50' }, // 23:59:59.5
      { time: 1483228800000, price: '48001.00' }, // 23:59:60 (leap second)
      { time: 1483228801000, price: '48001.50' }  // 00:00:00
    ]
  },
  
  // Weekend/holiday gaps
  weekendGap: {
    candles: [
      { time: 1638486000 as Time, open: 48000, high: 48100, low: 47900, close: 48050 }, // Friday close
      { time: 1638745200 as Time, open: 46000, high: 46500, low: 45800, close: 46200 }  // Monday open with gap
    ],
    description: 'Weekend gap in crypto markets'
  }
};