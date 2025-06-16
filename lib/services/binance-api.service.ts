/**
 * Binance API Service Facade
 * 
 * This file provides a convenient re-export of the BinanceAPIService
 * and its methods from the main implementation location.
 * It serves as a facade to maintain backward compatibility
 * with imports expecting the service in this location.
 */

// Re-export everything from the main implementation
export { 
  BinanceAPIService,
  binanceAPI,
  fetchKlines,
  fetchTicker24hr,
  isValidSymbol
} from '@/lib/binance/api-service';

// Re-export types that might be used with this service
export type { 
  ProcessedKline, 
  BinanceTicker24hr, 
  BinanceKlineTuple 
} from '@/types/market';