import { z } from 'zod';
import { createApiHandler, createOptionsHandler } from '@/lib/api/create-api-handler';
import { createApiMiddleware, validateBinanceSymbol, validateInterval } from '@/lib/api/middleware';
import { BinanceKlinesResponseSchema, validateBinanceKlines } from '@/types/market';
import { ApiError, ValidationError } from '@/lib/errors/base-error';

// Request validation schema
const klinesQuerySchema = z.object({
  symbol: z.string().min(1),
  interval: z.string().min(1),
  limit: z.string().optional(),
});

// Rate limiting middleware
const rateLimitMiddleware = createApiMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute for klines
});

export const GET = createApiHandler({
  middleware: rateLimitMiddleware,
  schema: klinesQuerySchema,
  handler: async ({ data }) => {
    const { symbol, interval, limit } = data;

    // Validate symbol format
    if (!validateBinanceSymbol(symbol)) {
      throw new ValidationError(
        'Invalid symbol format',
        'symbol',
        symbol
      );
    }

    // Validate interval
    if (!validateInterval(interval)) {
      throw new ValidationError(
        'Invalid interval format',
        'interval',
        interval
      );
    }

    // Validate and sanitize limit
    const limitNum = limit ? parseInt(limit, 10) : 1000;
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      throw new ValidationError(
        'Invalid limit: must be between 1 and 1000',
        'limit',
        limit
      );
    }

    const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limitNum}`;
    
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
          context: { symbol, interval, limit: limitNum },
          retryable: response.status >= 500 || response.status === 429
        }
      );
    }

    const rawData = await response.json();

    // Validate response data with Zod schema
    const validationResult = BinanceKlinesResponseSchema.safeParse(rawData);
    if (!validationResult.success) {
      throw new ApiError(
        'Invalid data format from upstream API',
        502,
        {
          context: { 
            symbol, 
            interval, 
            validationError: validationResult.error 
          }
        }
      );
    }

    // Process and validate the data using our helper
    return validateBinanceKlines(validationResult.data);
  }
});

export const OPTIONS = createOptionsHandler();