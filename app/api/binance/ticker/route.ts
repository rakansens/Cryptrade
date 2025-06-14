import { z } from 'zod';
import { createApiHandler, createOptionsHandler } from '@/lib/api/create-api-handler';
import { createApiMiddleware, validateBinanceSymbol } from '@/lib/api/middleware';
import { BinanceTicker24hrSchema } from '@/types/market';
import { ApiError, ValidationError } from '@/lib/errors/base-error';

// Request validation schema  
const tickerQuerySchema = z.object({
  symbol: z.string().optional(),
});

// Rate limiting middleware
const rateLimitMiddleware = createApiMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 requests per minute for ticker (less frequent updates)
});

export const GET = createApiHandler({
  middleware: rateLimitMiddleware,
  schema: tickerQuerySchema,
  handler: async ({ data }) => {
    const { symbol } = data;

    // Validate symbol if provided
    if (symbol && !validateBinanceSymbol(symbol)) {
      throw new ValidationError(
        'Invalid symbol format',
        'symbol',
        symbol
      );
    }

    const binanceUrl = symbol 
      ? `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`
      : 'https://api.binance.com/api/v3/ticker/24hr';
    
    const response = await fetch(binanceUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Cryptrade-API-Proxy/1.0',
      },
      signal: AbortSignal.timeout(25000), // 25 second timeout
    });

    if (!response.ok) {
      throw new ApiError(
        `Binance API error: ${response.statusText}`,
        response.status,
        { 
          context: { symbol },
          retryable: response.status >= 500 || response.status === 429
        }
      );
    }

    const rawData = await response.json();

    // Validate response data with Zod schema
    let validationResult;
    if (Array.isArray(rawData)) {
      // Multiple tickers
      validationResult = BinanceTicker24hrSchema.array().safeParse(rawData);
    } else {
      // Single ticker
      validationResult = BinanceTicker24hrSchema.safeParse(rawData);
    }

    if (!validationResult.success) {
      throw new ApiError(
        'Invalid data format from upstream API',
        502,
        {
          context: { 
            symbol,
            validationError: validationResult.error 
          }
        }
      );
    }

    return validationResult.data;
  }
});

export const OPTIONS = createOptionsHandler();