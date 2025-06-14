import { useMemo } from 'react';
import type { MarketTicker, PriceData, BinanceTradeMessage, ProcessedKline, PriceUpdate } from '@/types/market';
import type { SymbolValue } from '@/constants/chart';
import { createBaseStore, BaseState, BaseActions, createStoreHooks } from '@/lib/store/base.store';
import { logger } from '@/lib/utils/logger';

interface MarketConfig {
  maxCandles: number;
  maxSymbols: number;
}

interface MarketState extends BaseState {
  // Candlestick data (OHLCV)
  priceData: Record<string, ProcessedKline[]>;
  
  // Real-time prices and trade info
  currentPrices: Record<string, PriceUpdate>;
  tickers: Record<string, MarketTicker>;
  
  // Loading state per symbol
  loadingBySymbol: Record<string, boolean>;
  
  // Connection state
  isConnected: boolean;
  connectionError: string | null;
  
  // Configuration
  config: MarketConfig;
  
  // Batching state for performance optimization
  isBatching: boolean;
  pendingPriceUpdates: Record<string, BinanceTradeMessage>;
}

interface MarketCustomActions {
  // Candlestick data
  setPriceData: (symbol: string, data: ProcessedKline[]) => void;
  addKline: (symbol: string, kline: ProcessedKline) => void;
  updateLastKline: (symbol: string, kline: ProcessedKline) => void;
  
  // Real-time price updates  
  updatePrice: (tradeData: BinanceTradeMessage) => void;
  setCurrentPrice: (symbol: string, priceUpdate: PriceUpdate) => void;
  
  // Batched price updates for performance
  batchUpdatePrices: (tradeDataArray: BinanceTradeMessage[]) => void;
  processPendingPriceUpdates: () => void;
  
  // Loading state per symbol
  setSymbolLoading: (symbol: string, loading: boolean) => void;
  
  // Tickers
  setTicker: (symbol: string, ticker: MarketTicker) => void;
  setTickers: (tickers: Record<string, MarketTicker>) => void;
  
  // Connection
  setConnected: (connected: boolean) => void;
  setConnectionError: (error: string | null) => void;
  
  // Configuration
  updateConfig: (config: Partial<MarketConfig>) => void;
}

interface MarketActions extends BaseActions, MarketCustomActions {}

type MarketStore = MarketState & MarketActions;

const DEFAULT_CONFIG: MarketConfig = {
  maxCandles: 1000,
  maxSymbols: 10,
};

const INITIAL_STATE: MarketState = {
  priceData: {},
  currentPrices: {},
  tickers: {},
  loadingBySymbol: {},
  isConnected: false,
  connectionError: null,
  config: DEFAULT_CONFIG,
  error: null,
  isLoading: false,
  lastUpdateTime: 0,
  isBatching: false,
  pendingPriceUpdates: {},
};

const useMarketStoreBase = createBaseStore<MarketState, MarketActions>(
  {
    name: 'MarketStore',
    initialState: INITIAL_STATE,
    defaultState: INITIAL_STATE,
  },
  (set, _get, debug) => ({
    // Candlestick data actions
    setPriceData: (symbol, data) => {
      debug('setPriceData');
      set((state: MarketState) => ({
        priceData: {
          ...state.priceData,
          [symbol]: data,
        },
        lastUpdateTime: Date.now(),
      }));
    },
    
    addKline: (symbol, kline) => {
      debug('addKline');
      set((state: MarketState) => {
        const existing = state.priceData[symbol] || [];
        const maxCandles = state.config.maxCandles;
        const updated = [...existing, kline].slice(-maxCandles);
        return {
          priceData: {
            ...state.priceData,
            [symbol]: updated,
          },
          lastUpdateTime: Date.now(),
        };
      });
    },
    
    updateLastKline: (symbol, kline) => {
      debug('updateLastKline');
      set((state: MarketState) => {
        const existing = state.priceData[symbol] || [];
        if (existing.length === 0) return state;
        
        const updated = [...existing];
        updated[updated.length - 1] = kline;
        
        return {
          priceData: {
            ...state.priceData,
            [symbol]: updated,
          },
          lastUpdateTime: Date.now(),
        };
      });
    },
    
    // Real-time price updates with batching
    updatePrice: (tradeData) => {
      const { s: symbol } = tradeData;
      
      // Add to pending updates for batching
      set((state: MarketState) => ({
        pendingPriceUpdates: {
          ...state.pendingPriceUpdates,
          [symbol]: tradeData, // Latest trade data overwrites previous
        },
      }));
      
      // Schedule batch processing if not already scheduled
      const state = _get();
      if (!state.isBatching) {
        set({ isBatching: true });
        requestAnimationFrame(() => {
          const actions = _get();
          actions.processPendingPriceUpdates();
        });
      }
    },
    
    // Process all pending price updates in a single batch
    processPendingPriceUpdates: () => {
      debug('processPendingPriceUpdates');
      
      set((state: MarketState) => {
        const pendingUpdates = state.pendingPriceUpdates;
        const symbols = Object.keys(pendingUpdates);
        
        if (symbols.length === 0) {
          return { isBatching: false };
        }
        
        const newCurrentPrices = { ...state.currentPrices };
        
        // Process all pending updates
        symbols.forEach(symbol => {
          const tradeData = pendingUpdates[symbol];
          const currentPrice = parseFloat(tradeData.p);
          const existing = state.currentPrices[symbol];
          const previousPrice = existing?.price || currentPrice;
          const change = currentPrice - previousPrice;
          const changePercent = previousPrice > 0 ? (change / previousPrice) * 100 : 0;
          
          newCurrentPrices[symbol] = {
            symbol,
            price: currentPrice,
            change,
            changePercent,
            time: tradeData.T,
          };
        });
        
        // Only log batch updates occasionally to reduce spam
        if (symbols.length > 10) {
          logger.debug('[MarketStore] Batch price update', { 
            symbolCount: symbols.length,
            symbols: symbols.slice(0, 3) // Log first 3 symbols only
          });
        }
        
        return {
          currentPrices: newCurrentPrices,
          pendingPriceUpdates: {}, // Clear pending updates
          isBatching: false,
          lastUpdateTime: Date.now(),
        };
      });
    },

    // Alternative batch update for multiple symbols at once
    batchUpdatePrices: (tradeDataArray) => {
      debug('batchUpdatePrices');
      
      set((state: MarketState) => {
        const newCurrentPrices = { ...state.currentPrices };
        
        tradeDataArray.forEach(tradeData => {
          const symbol = tradeData.s;
          const currentPrice = parseFloat(tradeData.p);
          const existing = state.currentPrices[symbol];
          const previousPrice = existing?.price || currentPrice;
          const change = currentPrice - previousPrice;
          const changePercent = previousPrice > 0 ? (change / previousPrice) * 100 : 0;
          
          newCurrentPrices[symbol] = {
            symbol,
            price: currentPrice,
            change,
            changePercent,
            time: tradeData.T,
          };
        });
        
        // Only log direct batch updates if significant
        if (tradeDataArray.length > 10) {
          logger.debug('[MarketStore] Batch price update (direct)', { 
            symbolCount: tradeDataArray.length
          });
        }
        
        return {
          currentPrices: newCurrentPrices,
          lastUpdateTime: Date.now(),
        };
      });
    },
    
    setCurrentPrice: (symbol, priceUpdate) => {
      set((state: MarketState) => ({
        currentPrices: {
          ...state.currentPrices,
          [symbol]: priceUpdate,
        },
        lastUpdateTime: Date.now(),
      }));
    },
    
    // Symbol-specific loading state
    setSymbolLoading: (symbol, loading) => {
      debug('setSymbolLoading');
      set((state: MarketState) => {
        const newLoadingBySymbol = {
          ...state.loadingBySymbol,
          [symbol]: loading,
        };
        
        // Update global isLoading to be true if any symbol is loading
        const isAnyLoading = Object.values(newLoadingBySymbol).some(Boolean);
        
        return {
          loadingBySymbol: newLoadingBySymbol,
          isLoading: isAnyLoading,
          lastUpdateTime: Date.now(),
        };
      });
    },
    
    // Tickers
    setTicker: (symbol, ticker) => {
      debug('setTicker');
      set((state: MarketState) => ({
        tickers: {
          ...state.tickers,
          [symbol]: ticker,
        },
        lastUpdateTime: Date.now(),
      }));
    },
    
    setTickers: (tickers) => {
      debug('setTickers');
      set({ tickers, lastUpdateTime: Date.now() });
    },
    
    // Connection management
    setConnected: (connected) => {
      debug('setConnected');
      set({ 
        isConnected: connected, 
        connectionError: connected ? null : 'Disconnected',
        lastUpdateTime: Date.now(),
      });
      logger.debug('[MarketStore] Connection status changed', { connected });
    },
    
    setConnectionError: (error) => {
      debug('setConnectionError');
      set({ connectionError: error, lastUpdateTime: Date.now() });
    },
    
    // Configuration
    updateConfig: (config) => {
      debug('updateConfig');
      set((state: MarketState) => ({
        config: { ...state.config, ...config },
        lastUpdateTime: Date.now(),
      }));
      logger.info('[MarketStore] Config updated', config);
    },
  })
);

// Store hooks
export const useMarketStore = <T>(
  selector: (state: MarketStore) => T
) => {
  return useMarketStoreBase(selector);
};

// Base store hooks
const baseHooks = createStoreHooks<MarketStore>(useMarketStore);
export const useMarketError = baseHooks.useError;
export const useMarketLoading = baseHooks.useLoading;
export const useMarketLastUpdate = baseHooks.useLastUpdateTime;

// Data hooks with memoization
export const usePriceData = (symbol: string) => {
  const priceData = useMarketStore(state => state.priceData[symbol]);
  return useMemo(() => priceData || [], [priceData]);
};

export const useSymbolLoading = (symbol: string) => {
  const loading = useMarketStore(state => state.loadingBySymbol[symbol]);
  return useMemo(() => loading || false, [loading]);
};

export const useCurrentPrice = (symbol: string) => {
  const priceUpdate = useMarketStore(state => state.currentPrices[symbol]);
  return useMemo(() => priceUpdate?.price || 0, [priceUpdate]);
};

export const usePriceUpdate = (symbol: string) => 
  useMarketStore(state => state.currentPrices[symbol]);

export const useTicker = (symbol: string) => 
  useMarketStore(state => state.tickers[symbol]);

export const useMarketConnection = () => {
  const isConnected = useMarketStore(state => state.isConnected);
  const error = useMarketStore(state => state.connectionError);
  
  return useMemo(() => ({
    isConnected,
    error
  }), [isConnected, error]);
};

export const useMarketStats = (symbol: string) => {
  const priceUpdate = useMarketStore(state => state.currentPrices[symbol]);
  const ticker = useMarketStore(state => state.tickers[symbol]);
  
  return useMemo(() => ({
    currentPrice: priceUpdate?.price || 0,
    change: priceUpdate?.change || 0,
    changePercent: priceUpdate?.changePercent || 0,
    volume: ticker?.volume24h || '0',
    high24h: ticker?.high24h || '0',
    low24h: ticker?.low24h || '0',
  }), [priceUpdate, ticker]);
};

// Configuration hooks
export const useMarketConfig = () => 
  useMarketStore(state => state.config);

// Batching state hooks
export const useMarketBatching = () => {
  const isBatching = useMarketStore(state => state.isBatching);
  const pendingUpdatesCount = useMarketStore(state => Object.keys(state.pendingPriceUpdates).length);
  
  return useMemo(() => ({
    isBatching,
    pendingUpdatesCount,
    hasPendingUpdates: pendingUpdatesCount > 0,
  }), [isBatching, pendingUpdatesCount]);
};

// Selective action hooks for better performance
export const useMarketDataActions = () => {
  const setPriceData = useMarketStoreBase(state => state.setPriceData);
  const addKline = useMarketStoreBase(state => state.addKline);
  const updateLastKline = useMarketStoreBase(state => state.updateLastKline);
  const setSymbolLoading = useMarketStoreBase(state => state.setSymbolLoading);
  return { setPriceData, addKline, updateLastKline, setSymbolLoading };
};

export const useMarketPriceActions = () => {
  const updatePrice = useMarketStoreBase(state => state.updatePrice);
  const setCurrentPrice = useMarketStoreBase(state => state.setCurrentPrice);
  const batchUpdatePrices = useMarketStoreBase(state => state.batchUpdatePrices);
  const processPendingPriceUpdates = useMarketStoreBase(state => state.processPendingPriceUpdates);
  return { updatePrice, setCurrentPrice, batchUpdatePrices, processPendingPriceUpdates };
};

export const useMarketConnectionActions = () => {
  const setConnected = useMarketStoreBase(state => state.setConnected);
  const setConnectionError = useMarketStoreBase(state => state.setConnectionError);
  return { setConnected, setConnectionError };
};

// All actions hook (use sparingly)
export const useMarketActions = () => {
  const dataActions = useMarketDataActions();
  const priceActions = useMarketPriceActions();
  const connectionActions = useMarketConnectionActions();
  const setTicker = useMarketStoreBase(state => state.setTicker);
  const setTickers = useMarketStoreBase(state => state.setTickers);
  const updateConfig = useMarketStoreBase(state => state.updateConfig);
  const setLoading = useMarketStoreBase(state => state.setLoading);
  const setError = useMarketStoreBase(state => state.setError);
  const reset = useMarketStoreBase(state => state.reset);
  
  return {
    ...dataActions,
    ...priceActions,
    ...connectionActions,
    setTicker,
    setTickers,
    updateConfig,
    setLoading,
    setError,
    reset,
  };
};