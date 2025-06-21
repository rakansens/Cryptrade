// Mock for lib/binance/api-service

export class BinanceAPIService {
  constructor() {}
  
  async fetchKlines(
    symbol: string,
    interval: string = '1h',
    limit: number = 1000,
    startTime?: number,
    endTime?: number,
  ) {
    return [];
  }
  
  async fetchTicker24hr(symbol?: string) {
    if (symbol) {
      return {
        symbol: symbol.toUpperCase(),
        priceChange: '0.00',
        priceChangePercent: '0.00',
        weightedAvgPrice: '100.00',
        prevClosePrice: '100.00',
        lastPrice: '100.00',
        lastQty: '1.00',
        bidPrice: '99.99',
        bidQty: '10.00',
        askPrice: '100.01',
        askQty: '10.00',
        openPrice: '100.00',
        highPrice: '101.00',
        lowPrice: '99.00',
        volume: '1000.00',
        quoteVolume: '100000.00',
        openTime: Date.now() - 86400000,
        closeTime: Date.now(),
        firstId: 1,
        lastId: 100,
        count: 100
      };
    }
    return [];
  }
  
  async fetchCurrentPrice(symbol: string) {
    return { symbol: symbol.toUpperCase(), price: '100.00' };
  }
  
  isValidSymbol(symbol: string) {
    return /^[A-Z]{2,10}USDT?$/.test(symbol.toUpperCase());
  }
  
  async fetchExchangeInfo() {
    return {
      timezone: 'UTC',
      serverTime: Date.now(),
      rateLimits: [],
      exchangeFilters: [],
      symbols: []
    };
  }
}

// Create singleton instance
export const binanceAPIInstance = new BinanceAPIService();
export const binanceAPI = binanceAPIInstance;

// Export standalone functions
export const fetchKlines = binanceAPIInstance.fetchKlines.bind(binanceAPIInstance);
export const fetchTicker24hr = binanceAPIInstance.fetchTicker24hr.bind(binanceAPIInstance);
export const isValidSymbol = binanceAPIInstance.isValidSymbol.bind(binanceAPIInstance);