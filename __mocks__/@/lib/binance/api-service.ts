// 2025-01-26: BinanceAPIServiceモックを完全修正 - 実装に合わせてエラーハンドリング、validateBinanceKlines、ログパターンを同期

// Mock for BinanceAPIService with proper error handling and data processing
import { jest } from '@jest/globals';

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock validateBinanceKlines function
const mockValidateBinanceKlines = jest.fn();

// BaseServiceのget/post/put/deleteメソッドをモック
export const mockGet = jest.fn();
export const mockPost = jest.fn();
export const mockPut = jest.fn();
export const mockDelete = jest.fn();

// BinanceAPIServiceの各メソッドをモック
export const mockFetchKlines = jest.fn();
export const mockFetchTicker24hr = jest.fn();
export const mockFetchCurrentPrice = jest.fn();
export const mockFetchExchangeInfo = jest.fn();
export const mockIsValidSymbol = jest.fn();

// BaseServiceのモッククラス
class MockBaseService {
  basePath: string;
  
  constructor(basePath: string) {
    this.basePath = basePath;
  }
  
  protected get = mockGet;
  protected post = mockPost;
  protected put = mockPut;
  protected delete = mockDelete;
}

// BinanceAPIServiceのモッククラス（BaseServiceを継承）
export class BinanceAPIService extends MockBaseService {
  constructor() {
    const basePath = typeof window === 'undefined'
      ? 'https://api.binance.com/api/v3'
      : '/api/binance';
    super(basePath);
  }

  // 実際の実装に合わせたfetchKlines
  public async fetchKlines(
    symbol: string,
    interval: string = '1h',
    limit: number = 1000,
    startTime?: number,
    endTime?: number,
  ): Promise<any> {
    try {
      const params: Record<string, string> = {
        symbol: symbol.toUpperCase(),
        interval,
        limit: limit.toString(),
      };

      if (startTime !== undefined) {
        params['startTime'] = startTime.toString();
      }
      if (endTime !== undefined) {
        params['endTime'] = endTime.toString();
      }

      const response: any = await this.get('/klines', params);
      const responseData = response.data;

      mockLogger.debug('[BinanceAPI] Klines response from API route', {
        symbol,
        interval,
        dataType: Array.isArray(responseData) ? 'array' : typeof responseData,
        dataLength: Array.isArray(responseData) ? responseData.length : 'N/A',
        isProcessed: Array.isArray(responseData) && responseData.length > 0 && 
                     typeof responseData[0] === 'object' && 'time' in responseData[0],
        sample: JSON.stringify(responseData).slice(0, 200)
      });

      // validateBinanceKlinesを使用してデータ処理
      const processedData = mockValidateBinanceKlines(responseData);
      
      mockLogger.info('[BinanceAPI] Fetched and validated klines', {
        symbol,
        interval,
        count: Array.isArray(processedData) ? processedData.length : 0
      });

      return processedData;

    } catch (error) {
      mockLogger.error('[BinanceAPI] Failed to fetch klines', {
        symbol,
        interval,
        limit,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }, error);
      throw error;
    }
  }

  // 実際の実装に合わせたfetchTicker24hr
  public async fetchTicker24hr(symbol?: string): Promise<any> {
    try {
      const params = symbol ? { symbol: symbol.toUpperCase() } : undefined;
      const response: any = await this.get('/ticker', params);
      const rawData = response.data;

      // Check if Binance returned an error object
      if (rawData && typeof rawData === 'object' && 'code' in rawData && 'msg' in rawData) {
        mockLogger.warn('[BinanceAPI] Binance ticker error response', {
          symbol,
          errorCode: rawData.code,
          errorMsg: rawData.msg,
          rawData
        });
        
        throw new Error(`Binance API error: ${rawData.code} - ${rawData.msg}`);
      }

      mockLogger.info('[BinanceAPI] Fetched 24hr ticker', { 
        symbol,
        dataType: Array.isArray(rawData) ? 'array' : typeof rawData
      });
      return rawData;

    } catch (error) {
      mockLogger.error('[BinanceAPI] Failed to fetch 24hr ticker', { 
        symbol,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }, error);
      throw error;
    }
  }

  // 実際の実装に合わせたfetchCurrentPrice
  public async fetchCurrentPrice(symbol: string): Promise<any> {
    try {
      const params = { symbol: symbol.toUpperCase() };
      const response: any = await this.get('/ticker', params);
      
      if (response.data && typeof response.data === 'object' && 'price' in response.data) {
        mockLogger.info('[BinanceAPI] Fetched current price', {
          symbol,
          price: response.data.price
        });
      }
      
      return response.data;

    } catch (error) {
      mockLogger.error('[BinanceAPI] Failed to fetch current price', { 
        symbol,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }, error);
      throw error;
    }
  }

  // 実際の実装に合わせたfetchExchangeInfo
  public async fetchExchangeInfo(): Promise<any> {
    try {
      const response: any = await this.get('/exchangeInfo');
      mockLogger.info('[BinanceAPI] Fetched exchange info');
      return response.data;
    } catch (error) {
      mockLogger.error('[BinanceAPI] Failed to fetch exchange info', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }, error);
      throw error;
    }
  }

  // 実際の実装に合わせたisValidSymbol（USD/USDTの両方をサポート）
  public isValidSymbol(symbol: string): boolean {
    return /^[A-Z]{2,10}(USD|USDT)$/.test(symbol.toUpperCase());
  }
}

// Export individual mocks for test access
export const mockBinanceAPI = {
  fetchKlines: mockFetchKlines,
  fetchTicker24hr: mockFetchTicker24hr,
  fetchCurrentPrice: mockFetchCurrentPrice,
  fetchExchangeInfo: mockFetchExchangeInfo,
  isValidSymbol: mockIsValidSymbol,
  // BaseService methods
  get: mockGet,
  post: mockPost,
  put: mockPut,
  delete: mockDelete
};

// Export additional mocks
export { mockValidateBinanceKlines, mockLogger };

// Create instance for method delegation
const serviceInstance = new BinanceAPIService();

// Default mock implementations - 実際のメソッドを委譲
mockFetchKlines.mockImplementation((...args: any[]) => {
  return serviceInstance.fetchKlines.apply(serviceInstance, args);
});

mockFetchTicker24hr.mockImplementation((...args: any[]) => {
  return serviceInstance.fetchTicker24hr.apply(serviceInstance, args);
});

mockFetchCurrentPrice.mockImplementation((...args: any[]) => {
  return serviceInstance.fetchCurrentPrice.apply(serviceInstance, args);
});

mockFetchExchangeInfo.mockImplementation((...args: any[]) => {
  return serviceInstance.fetchExchangeInfo.apply(serviceInstance, args);
});

mockIsValidSymbol.mockImplementation((...args: any[]) => {
  return serviceInstance.isValidSymbol.apply(serviceInstance, args);
});

// Legacy exports
export const binanceAPI = serviceInstance;
export const fetchKlines = mockFetchKlines;
export const fetchTicker24hr = mockFetchTicker24hr;
export const isValidSymbol = mockIsValidSymbol;