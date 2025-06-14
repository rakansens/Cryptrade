import { logger } from '@/lib/utils/logger';
import { validateBinanceKlines, type BinanceTicker24hr, type ProcessedKline, type BinanceKlineTuple } from '@/types/market';
import { BaseService } from '@/lib/api/base-service';

// Binance Exchange Info types
interface BinanceSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  baseAssetPrecision: number;
  quoteAsset: string;
  quotePrecision: number;
  quoteAssetPrecision: number;
  orderTypes: string[];
  icebergAllowed: boolean;
  ocoAllowed: boolean;
  isSpotTradingAllowed: boolean;
  isMarginTradingAllowed: boolean;
  filters: Array<{
    filterType: string;
    [key: string]: string | number | boolean;
  }>;
  permissions: string[];
}

interface BinanceExchangeInfo {
  timezone: string;
  serverTime: number;
  rateLimits: Array<{
    rateLimitType: string;
    interval: string;
    intervalNum: number;
    limit: number;
  }>;
  exchangeFilters: Array<Record<string, unknown>>;
  symbols: BinanceSymbol[];
}

interface BinanceErrorResponse {
  code: number;
  msg: string;
}

type KlinesResponse = ProcessedKline[] | BinanceKlineTuple[];

export class BinanceAPIService extends BaseService {
  constructor() {
    // ブラウザ側は Next.js API ルートを経由、サーバ・スクリプト側は直接 Binance Public API
    const basePath = typeof window === 'undefined'
      ? 'https://api.binance.com/api/v3'
      : '/api/binance';
    super(basePath);
  }

  public async fetchKlines(
    symbol: string,
    interval: string = '1h',
    limit: number = 1000,
    startTime?: number,
    endTime?: number,
  ): Promise<ProcessedKline[]> {
    try {
      const params: Record<string, string> = {
        symbol: symbol.toUpperCase(),
        interval,
        limit: limit.toString(),
      };

      // 追加クエリ（Binance は ms 指定）
      if (startTime !== undefined) {
        params.startTime = startTime.toString();
      }
      if (endTime !== undefined) {
        params.endTime = endTime.toString();
      }

      const response = await this.get<KlinesResponse>('/klines', params);
      const responseData = response.data;

      // Log response for debugging (truncated)
      logger.debug('[BinanceAPI] Klines response from API route', {
        symbol,
        interval,
        dataType: Array.isArray(responseData) ? 'array' : typeof responseData,
        dataLength: Array.isArray(responseData) ? responseData.length : 'N/A',
        isProcessed: Array.isArray(responseData) && responseData.length > 0 && 
                     typeof responseData[0] === 'object' && 'time' in responseData[0],
        sample: JSON.stringify(responseData).slice(0, 200)
      });

      // The data might be already processed by API route OR raw from direct Binance calls
      // validateBinanceKlines handles both cases intelligently
      const processedData = validateBinanceKlines(responseData);
      
      logger.info('[BinanceAPI] Fetched and validated klines', {
        symbol,
        interval,
        count: processedData.length
      });

      return processedData;

    } catch (error) {
      logger.error('[BinanceAPI] Failed to fetch klines', {
        symbol,
        interval,
        limit,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }, error);
      throw error;
    }
  }

  public async fetchTicker24hr(symbol?: string): Promise<BinanceTicker24hr | BinanceTicker24hr[]> {
    try {
      const params = symbol ? { symbol: symbol.toUpperCase() } : undefined;
      const response = await this.get<BinanceTicker24hr | BinanceTicker24hr[] | BinanceErrorResponse>('/ticker', params);
      const rawData = response.data;

      // Check if Binance returned an error object
      if (rawData && typeof rawData === 'object' && 'code' in rawData && 'msg' in rawData) {
        const errorData = rawData as BinanceErrorResponse;
        logger.warn('[BinanceAPI] Binance ticker error response', {
          symbol,
          errorCode: errorData.code,
          errorMsg: errorData.msg,
          rawData
        });
        
        throw new Error(`Binance API error: ${errorData.code} - ${errorData.msg}`);
      }

      logger.info('[BinanceAPI] Fetched 24hr ticker', { 
        symbol,
        dataType: Array.isArray(rawData) ? 'array' : typeof rawData
      });
      return rawData as BinanceTicker24hr | BinanceTicker24hr[];

    } catch (error) {
      logger.error('[BinanceAPI] Failed to fetch 24hr ticker', { 
        symbol,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }, error);
      throw error;
    }
  }

  public async fetchCurrentPrice(symbol: string): Promise<{ symbol: string; price: string }> {
    try {
      const params = { symbol: symbol.toUpperCase() };
      const response = await this.get<{ symbol: string; price: string }>('/ticker', params);
      
      logger.info('[BinanceAPI] Fetched current price', { 
        symbol, 
        price: response.data.price 
      });
      
      return response.data;

    } catch (error) {
      logger.error('[BinanceAPI] Failed to fetch current price', { symbol }, error);
      throw error;
    }
  }


  // Utility method to validate symbol format
  public isValidSymbol(symbol: string): boolean {
    return /^[A-Z]{2,10}USDT?$/.test(symbol.toUpperCase());
  }

  // Get exchange info (optional - for symbol validation)
  public async fetchExchangeInfo(): Promise<BinanceExchangeInfo> {
    try {
      const response = await this.get<BinanceExchangeInfo>('/exchangeInfo');
      logger.info('[BinanceAPI] Fetched exchange info');
      return response.data;
    } catch (error) {
      logger.error('[BinanceAPI] Failed to fetch exchange info', {}, error);
      throw error;
    }
  }
}

// Legacy singleton export for backward compatibility
// TODO: Migrate all usages to DI pattern
export const binanceAPI = new BinanceAPIService();