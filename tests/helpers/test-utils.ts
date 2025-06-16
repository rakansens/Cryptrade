import type { PriceUpdate, BinanceTradeMessage } from '../../types/market';

/**
 * Create a mock fetch response for testing
 */
export function createMockFetchResponse(data: any, options?: { status?: number; ok?: boolean }): Promise<any> {
  return Promise.resolve({
    ok: options?.ok ?? true,
    status: options?.status ?? 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data))
  });
}

/**
 * Create a PriceUpdate object from trade data
 */
export function createPriceUpdate(symbol: string, price: number): PriceUpdate {
  return {
    symbol,
    price,
    change: 0,
    changePercent: 0,
    time: Date.now()
  };
}

/**
 * Create a BinanceTradeMessage for testing
 */
export function createTradeMessage(symbol: string, price: string): BinanceTradeMessage {
  return {
    e: 'trade',
    E: Date.now(),
    s: symbol,
    t: 12345,
    p: price,
    q: '1.0',
    b: 88,
    a: 50,
    T: Date.now(),
    m: false,
    M: true
  };
} 