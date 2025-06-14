'use client';

/**
 * Binance API Context and Provider
 * 
 * DIパターンによるBinance APIサービスの提供
 * シングルトンからDIへの移行により、テスタビリティと柔軟性を向上
 */

import React, { createContext, useContext, useMemo } from 'react';
import { BinanceAPIService } from './api-service';

interface BinanceAPIContextValue {
  binanceAPI: BinanceAPIService;
}

const BinanceAPIContext = createContext<BinanceAPIContextValue | undefined>(undefined);

interface BinanceAPIProviderProps {
  children: React.ReactNode;
  // テスト用にサービスインスタンスを注入可能
  service?: BinanceAPIService;
}

/**
 * Binance API Provider
 * 
 * アプリケーション全体にBinance APIサービスを提供
 * テスト時はモックサービスを注入可能
 */
export function BinanceAPIProvider({ 
  children, 
  service 
}: BinanceAPIProviderProps) {
  const binanceAPI = useMemo(() => {
    return service || new BinanceAPIService();
  }, [service]);

  return (
    <BinanceAPIContext.Provider value={{ binanceAPI }}>
      {children}
    </BinanceAPIContext.Provider>
  );
}

/**
 * Binance API Hook
 * 
 * コンポーネントからBinance APIサービスを利用するためのフック
 */
export function useBinanceAPI(): BinanceAPIService {
  const context = useContext(BinanceAPIContext);
  
  if (!context) {
    throw new Error('useBinanceAPI must be used within a BinanceAPIProvider');
  }
  
  return context.binanceAPI;
}

/**
 * Server-side / Script用のインスタンス取得
 * 
 * React Contextが使えない環境（サーバーサイド、スクリプト）用
 * デフォルトインスタンスを返す
 */
let defaultInstance: BinanceAPIService | null = null;

export function getBinanceAPI(): BinanceAPIService {
  if (!defaultInstance) {
    defaultInstance = new BinanceAPIService();
  }
  return defaultInstance;
}

/**
 * テスト用: デフォルトインスタンスをリセット
 */
export function resetBinanceAPI(): void {
  defaultInstance = null;
}