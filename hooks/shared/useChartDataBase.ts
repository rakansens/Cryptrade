/**
 * Chart Data Base Hook
 * 
 * チャートデータ処理系フックの共通基盤
 * useChartDataとuseCandlestickDataの重複パターンを統合
 */

import { useRef, useCallback, useEffect } from 'react';
import { logger } from '@/lib/utils/logger';

export interface DataHookConfig {
  hookName: string;
  enableAutoCleanup?: boolean;
  logLevel?: 'info' | 'warn' | 'error';
}

export interface MountState {
  isMounted: boolean;
  isInitialized: boolean;
  hasAutoProcessed: boolean;
}

export interface ErrorContext {
  operation: string;
  data?: any;
  symbol?: string;
  interval?: string;
  additionalInfo?: Record<string, any>;
}

/**
 * チャートデータ系フックの共通基盤
 */
export function useChartDataBase<T = any>(config: DataHookConfig) {
  const { hookName, enableAutoCleanup = true, logLevel = 'info' } = config;
  
  // マウント状態管理
  const mountState = useRef<MountState>({
    isMounted: true,
    isInitialized: false,
    hasAutoProcessed: false
  });
  
  // 前回データ追跡
  const previousData = useRef<T | null>(null);
  const dataLength = useRef(0);
  
  // クリーンアップ関数管理
  const cleanupFunctions = useRef<Array<() => void>>([]);

  /**
   * 安全なログ出力（マウント状態考慮）
   */
  const safeLog = useCallback((level: 'info' | 'warn' | 'error', message: string, context?: any) => {
    if (!mountState.current.isMounted) return;
    
    const logContext = {
      hook: hookName,
      mounted: mountState.current.isMounted,
      initialized: mountState.current.isInitialized,
      ...context
    };
    
    logger[level](message, logContext);
  }, [hookName]);

  /**
   * 統一エラーハンドリング
   */
  const handleError = useCallback((error: unknown, context: ErrorContext) => {
    if (!mountState.current.isMounted) return;
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    safeLog('error', `[${hookName}] ${context.operation} failed`, {
      error: errorMessage,
      stack: errorStack,
      operation: context.operation,
      data: context.data,
      symbol: context.symbol,
      interval: context.interval,
      ...context.additionalInfo
    });
  }, [hookName, safeLog]);

  /**
   * データ変更検出
   */
  const detectDataChange = useCallback((newData: T, lengthSelector?: (data: T) => number): boolean => {
    if (!newData) return false;
    
    const currentLength = lengthSelector ? lengthSelector(newData) : 1;
    const hasLengthChanged = currentLength !== dataLength.current;
    const hasDataChanged = JSON.stringify(newData) !== JSON.stringify(previousData.current);
    
    if (hasDataChanged) {
      previousData.current = newData;
      dataLength.current = currentLength;
    }
    
    return hasDataChanged || hasLengthChanged;
  }, []);

  /**
   * 安全な副作用実行
   */
  const executeSafely = useCallback(async <R>(
    operation: string, 
    fn: () => Promise<R> | R,
    context: Omit<ErrorContext, 'operation'> = {}
  ): Promise<R | null> => {
    if (!mountState.current.isMounted) return null;
    
    try {
      safeLog(logLevel, `[${hookName}] Starting ${operation}`, context);
      const result = await fn();
      
      if (mountState.current.isMounted) {
        safeLog(logLevel, `[${hookName}] ${operation} completed`, { ...context, hasResult: !!result });
      }
      
      return result;
    } catch (error) {
      handleError(error, { operation, ...context });
      return null;
    }
  }, [hookName, logLevel, safeLog, handleError]);

  /**
   * クリーンアップ関数登録
   */
  const registerCleanup = useCallback((cleanupFn: () => void) => {
    cleanupFunctions.current.push(cleanupFn);
  }, []);

  /**
   * マウント状態更新
   */
  const updateMountState = useCallback((updates: Partial<MountState>) => {
    mountState.current = { ...mountState.current, ...updates };
  }, []);

  /**
   * データフォーマット共通ヘルパー
   */
  const formatChartData = useCallback((data: any[], timeField = 'time') => {
    if (!Array.isArray(data) || data.length === 0) return [];
    
    return data.map(item => ({
      ...item,
      [timeField]: typeof item[timeField] === 'number' ? item[timeField] : Math.floor(Date.now() / 1000)
    }));
  }, []);

  /**
   * 初期化処理
   */
  useEffect(() => {
    updateMountState({ isMounted: true, isInitialized: true });
    safeLog('info', `[${hookName}] Hook initialized`);
    
    return () => {
      updateMountState({ isMounted: false });
      
      // 自動クリーンアップ実行
      if (enableAutoCleanup && cleanupFunctions.current.length > 0) {
        safeLog('info', `[${hookName}] Executing cleanup functions`, { 
          cleanupCount: cleanupFunctions.current.length 
        });
        
        cleanupFunctions.current.forEach((cleanup, index) => {
          try {
            cleanup();
          } catch (error) {
            logger.error(`[${hookName}] Cleanup function ${index} failed`, { 
              error: error instanceof Error ? error.message : String(error),
              index 
            });
          }
        });
        cleanupFunctions.current = [];
      }
      
      safeLog('info', `[${hookName}] Hook cleanup completed`);
    };
  }, [hookName, enableAutoCleanup, safeLog, updateMountState]);

  return {
    // State
    mountState: mountState.current,
    previousData: previousData.current,
    dataLength: dataLength.current,
    
    // Functions
    safeLog,
    handleError,
    detectDataChange,
    executeSafely,
    registerCleanup,
    updateMountState,
    formatChartData,
    
    // Utilities
    isMounted: () => mountState.current.isMounted,
    isInitialized: () => mountState.current.isInitialized,
    hasAutoProcessed: () => mountState.current.hasAutoProcessed,
    setAutoProcessed: () => updateMountState({ hasAutoProcessed: true }),
  };
}