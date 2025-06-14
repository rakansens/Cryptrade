/**
 * Enhanced Market Data Tool with Error Tracking
 * 
 * Example of integrating error tracking and compatibility layer
 */

import { z } from 'zod';
import { createTool } from '@/lib/tools/base-tool';
import { ApiError, ToolError } from '@/lib/errors/base-error';
import { trackToolError, trackException } from '@/lib/errors/error-tracker';
import { createCompatibleTool } from '@/lib/tools/compatibility/tool-compatibility';
import { logger } from '@/lib/utils/logger';
import { BaseService } from '@/lib/api/base-service';
import { APP_CONSTANTS } from '@/config/app-constants';

// Enhanced Binance API service using BaseService
class EnhancedBinanceAPI extends BaseService {
  constructor() {
    super('/api/binance'); // Use internal API proxy
  }

  async getKlines(symbol: string, interval: string, limit: number) {
    const response = await this.get<any[]>('/klines', {
      symbol,
      interval,
      limit: limit.toString()
    });
    return response.data;
  }

  async get24hrTicker(symbol: string) {
    const response = await this.get<any>('/ticker', { symbol });
    return response.data;
  }
}

const enhancedBinanceAPI = new EnhancedBinanceAPI();

// Tool schema
const marketDataSchema = z.object({
  symbol: z.string().describe('Trading symbol (e.g., BTCUSDT)'),
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).optional().default('1h'),
  limit: z.number().min(1).max(500).optional().default(100),
});

// Base tool definition
const baseMarketDataTool = createTool({
  id: 'enhanced-market-data',
  name: 'Enhanced Market Data Tool',
  description: 'Fetch market data with error tracking and compatibility',
  inputSchema: marketDataSchema,
  
  execute: async ({ symbol, interval, limit }) => {
    const correlationId = `market-data-${Date.now()}`;
    
    try {
      logger.info('[MarketDataTool] Fetching data', {
        symbol,
        interval,
        limit,
        correlationId,
      });

      // API呼び出し
      const [klines, ticker] = await Promise.all([
        enhancedBinanceAPI.getKlines(symbol, interval, limit).catch(error => {
          // APIエラーをトラッキング
          const apiError = new ApiError(
            `Failed to fetch klines for ${symbol}`,
            error.response?.status || 500,
            {
              correlationId,
              data: {
                symbol,
                interval,
                limit,
                originalError: error.message,
              },
            }
          );
          
          trackException(apiError);
          throw apiError;
        }),
        
        enhancedBinanceAPI.get24hrTicker(symbol).catch(error => {
          // APIエラーをトラッキング
          const apiError = new ApiError(
            `Failed to fetch ticker for ${symbol}`,
            error.response?.status || 500,
            {
              correlationId,
              data: {
                symbol,
                originalError: error.message,
              },
              retryable: true,
              retryAfter: 5000,
            }
          );
          
          trackException(apiError);
          // tickerは必須ではないので、エラーでも続行
          return null;
        }),
      ]);

      // データ検証
      if (!klines || klines.length === 0) {
        const validationError = new ToolError(
          'No kline data returned',
          'enhanced-market-data',
          {
            correlationId,
            data: { symbol, interval },
            severity: 'WARNING',
          }
        );
        
        trackException(validationError);
        throw validationError;
      }

      // 成功レスポンス
      const result = {
        symbol,
        interval,
        klines: klines.map(k => ({
          time: k.openTime,
          open: parseFloat(k.open),
          high: parseFloat(k.high),
          low: parseFloat(k.low),
          close: parseFloat(k.close),
          volume: parseFloat(k.volume),
        })),
        ticker: ticker ? {
          lastPrice: parseFloat(ticker.lastPrice),
          priceChange: parseFloat(ticker.priceChange),
          priceChangePercent: parseFloat(ticker.priceChangePercent),
          volume: parseFloat(ticker.volume),
          quoteVolume: parseFloat(ticker.quoteVolume),
        } : null,
        timestamp: new Date().toISOString(),
      };

      logger.info('[MarketDataTool] Data fetched successfully', {
        symbol,
        klineCount: result.klines.length,
        hasTicker: !!result.ticker,
        correlationId,
      });

      return result;

    } catch (error) {
      // 未処理のエラーをキャッチ
      if (!(error instanceof ApiError || error instanceof ToolError)) {
        const unknownError = new ToolError(
          `Unexpected error in market data tool: ${error.message}`,
          'enhanced-market-data',
          {
            correlationId,
            data: { symbol, interval, limit },
            context: { originalError: String(error) },
          }
        );
        
        trackToolError(unknownError, 'enhanced-market-data', {
          symbol,
          interval,
          correlationId,
        });
        
        throw unknownError;
      }
      
      // 既知のエラーは再スロー
      throw error;
    }
  },
});

/**
 * Export provider-specific versions
 */

// OpenAI版
export const marketDataToolForOpenAI = createCompatibleTool(
  baseMarketDataTool,
  'openai'
);

// OpenAI Reasoning (o1)版
export const marketDataToolForO1 = createCompatibleTool(
  baseMarketDataTool,
  'openai-reasoning'
);

// Anthropic版
export const marketDataToolForAnthropic = createCompatibleTool(
  baseMarketDataTool,
  'anthropic'
);

// デフォルトエクスポート
export const enhancedMarketDataTool = marketDataToolForOpenAI;