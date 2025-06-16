/**
 * Binance WebSocket レスポンスのフィクスチャ
 */

export const mockKlineData = {
  e: 'kline',
  E: 1638360000000,
  s: 'BTCUSDT',
  k: {
    t: 1638360000000,
    T: 1638363599999,
    s: 'BTCUSDT',
    i: '1h',
    f: 100,
    L: 200,
    o: '48000.00',
    c: '48500.00',
    h: '49000.00',
    l: '47500.00',
    v: '1000.00000000',
    n: 100,
    x: false,
    q: '48000000.00000000',
    V: '500.00000000',
    Q: '24250000.00000000',
    B: '0'
  }
};

export const mockDepthData = {
  e: 'depthUpdate',
  E: 1638360000000,
  s: 'BTCUSDT',
  U: 400900217,
  u: 400900218,
  b: [
    ['48000.00', '10.00000000'],
    ['47999.00', '5.00000000'],
    ['47998.00', '15.00000000']
  ],
  a: [
    ['48001.00', '10.00000000'],
    ['48002.00', '5.00000000'],
    ['48003.00', '15.00000000']
  ]
};

export const mockTradeData = {
  e: 'trade',
  E: 1638360000000,
  s: 'BTCUSDT',
  t: 12345,
  p: '48000.00',
  q: '0.10000000',
  b: 88,
  a: 50,
  T: 1638360000000,
  m: true,
  M: true
};

export const mockTickerData = {
  e: '24hrTicker',
  E: 1638360000000,
  s: 'BTCUSDT',
  p: '500.00',
  P: '1.04',
  w: '48250.00',
  x: '48000.00',
  c: '48500.00',
  Q: '0.50000000',
  b: '48499.00',
  B: '10.00000000',
  a: '48501.00',
  A: '10.00000000',
  o: '48000.00',
  h: '49000.00',
  l: '47500.00',
  v: '10000.00000000',
  q: '482500000.00000000',
  O: 1638273600000,
  C: 1638360000000,
  F: 100,
  L: 200,
  n: 100
};

export const mockAggTradeData = {
  e: 'aggTrade',
  E: 1638360000000,
  s: 'BTCUSDT',
  a: 12345,
  p: '48000.00',
  q: '1.00000000',
  f: 100,
  l: 105,
  T: 1638360000000,
  m: true,
  M: true
};

export const mockMiniTickerData = {
  e: '24hrMiniTicker',
  E: 1638360000000,
  s: 'BTCUSDT',
  c: '48500.00',
  o: '48000.00',
  h: '49000.00',
  l: '47500.00',
  v: '10000.00000000',
  q: '482500000.00000000'
};

export const mockBookTickerData = {
  e: 'bookTicker',
  u: 400900217,
  s: 'BTCUSDT',
  b: '48499.00',
  B: '10.00000000',
  a: '48501.00',
  A: '10.00000000'
};

export const mockErrorResponse = {
  error: {
    code: -1121,
    msg: 'Invalid symbol.'
  }
};

export const mockConnectionAck = {
  result: null,
  id: 1
};

export const mockSubscriptionConfirm = {
  result: null,
  id: 2
};

export const generateKlineStream = (count: number = 100) => {
  const klines = [];
  const baseTime = 1638360000000;
  const interval = 3600000; // 1 hour in ms
  let price = 48000;
  
  for (let i = 0; i < count; i++) {
    const time = baseTime + (i * interval);
    const open = price;
    const change = (Math.random() - 0.5) * 1000;
    const high = price + Math.abs(change) + Math.random() * 500;
    const low = price - Math.abs(change) - Math.random() * 500;
    const close = price + change;
    
    klines.push({
      e: 'kline',
      E: time,
      s: 'BTCUSDT',
      k: {
        t: time,
        T: time + interval - 1,
        s: 'BTCUSDT',
        i: '1h',
        f: 100 + i * 10,
        L: 100 + i * 10 + 9,
        o: open.toFixed(2),
        c: close.toFixed(2),
        h: high.toFixed(2),
        l: low.toFixed(2),
        v: (Math.random() * 1000 + 100).toFixed(8),
        n: Math.floor(Math.random() * 1000 + 100),
        x: i === count - 1,
        q: (Math.random() * 50000000 + 10000000).toFixed(8),
        V: (Math.random() * 500 + 50).toFixed(8),
        Q: (Math.random() * 25000000 + 5000000).toFixed(8),
        B: '0'
      }
    });
    
    price = close;
  }
  
  return klines;
};