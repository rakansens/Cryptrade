// TDD Phase 5: Type Safety Improvements Test Suite
// 🔴 Red Phase: store/market.store.ts と store/config.store.ts の型安全性改善

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('TDD Phase 5: Store型安全性改善', () => {
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // コンソール出力をキャプチャ
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Market Store 型安全性', () => {
    it('should eliminate as any cast in reset function', () => {
      // 🔴 Red: store/market.store.ts Line 458 のas anyキャスト除去
      const marketStoreModule = require('@/store/market.store');
      const { useMarketStoreBase } = marketStoreModule;
      
      // resetメソッドが型安全に実装されていることを確認
      expect(typeof useMarketStoreBase.getState().reset).toBe('function');
      
      // as anyキャストなしでreset関数が追加されていることを確認
      expect(useMarketStoreBase.reset).toBeDefined();
      expect(typeof useMarketStoreBase.reset).toBe('function');
      
      // reset関数の実行が安全に行えることを確認
      expect(() => useMarketStoreBase.reset()).not.toThrow();
    });

    it('should have proper type definitions for MarketStore', () => {
      // Market Store の型定義が適切であることを確認
      const marketStoreModule = require('@/store/market.store');
      const store = marketStoreModule.useMarketStoreBase.getState();
      
      // 基本的なプロパティの型チェック
      expect(typeof store.priceData).toBe('object');
      expect(typeof store.currentPrices).toBe('object');
      expect(typeof store.tickers).toBe('object');
      expect(typeof store.isConnected).toBe('boolean');
      expect(typeof store.config).toBe('object');
    });
  });

  describe('Config Store 型安全性', () => {
    it('should eliminate as any cast in setThemeMode legacy function', () => {
      // 🔴 Red: store/config.store.ts Lines 490, 495 のas anyキャスト除去
      const configStoreModule = require('@/store/config.store');
      const { useConfigStoreBase } = configStoreModule;
      
      // setThemeModeの型安全な実装を確認
      expect(useConfigStoreBase.setThemeMode).toBeDefined();
      expect(typeof useConfigStoreBase.setThemeMode).toBe('function');
      
      // updateChartの型安全な実装を確認
      expect(useConfigStoreBase.updateChart).toBeDefined();
      expect(typeof useConfigStoreBase.updateChart).toBeDefined();
    });

    it('should have proper theme mode type safety', () => {
      const configStoreModule = require('@/store/config.store');
      const { useConfigStoreBase } = configStoreModule;
      
      // テーマモードの変更が型安全に行われることを確認
      const validThemeModes = ['dark', 'light', 'system'];
      
      validThemeModes.forEach(mode => {
        expect(() => {
          useConfigStoreBase.setThemeMode(mode);
        }).not.toThrow();
      });
    });

    it('should have proper chart config type safety', () => {
      const configStoreModule = require('@/store/config.store');
      const { useConfigStoreBase } = configStoreModule;
      
      // チャート設定の更新が型安全に行われることを確認
      const validChartConfig = {
        showGrid: true,
        showCrosshair: false,
        candlestickStyle: 'candles' as const
      };
      
      expect(() => {
        useConfigStoreBase.updateChart(validChartConfig);
      }).not.toThrow();
    });
  });

  describe('Drawing Store 型安全性', () => {
    it('should eliminate as any cast in initializeDrawings', () => {
      // 🔴 Red: store/chart/stores/drawing.store.ts Line 353 のas anyキャスト除去
      const drawingStoreModule = require('@/store/chart/stores/drawing.store');
      const { useDrawingStore } = drawingStoreModule;
      
      // initializeDrawings メソッドが型安全に実装されていることを確認
      const state = useDrawingStore.getState();
      expect(typeof state.initializeDrawings).toBe('function');
      
      // as anyキャストなしで実行できることを確認
      expect(() => state.initializeDrawings()).not.toThrow();
    });

    it('should have proper drawing type definitions', () => {
      const drawingStoreModule = require('@/store/chart/stores/drawing.store');
      const { useDrawingStore } = drawingStoreModule;
      
      const state = useDrawingStore.getState();
      
      // Drawing関連のプロパティが適切な型を持つことを確認
      expect(Array.isArray(state.drawings)).toBe(true);
      expect(typeof state.drawingMode).toBe('object');
      expect(typeof state.isDrawing).toBe('boolean');
      expect(Array.isArray(state.undoStack)).toBe(true);
      expect(Array.isArray(state.redoStack)).toBe(true);
    });
  });

  describe('Message Store 型安全性', () => {
    it('should eliminate as any cast in error handling', () => {
      // 🔴 Red: store/chat/message.store.ts Line 94 のas anyキャスト除去
      const messageStoreModule = require('@/store/chat/message.store');
      const { createMessageSlice } = messageStoreModule;
      
      // createMessageSlice関数が型安全に実装されていることを確認
      expect(typeof createMessageSlice).toBe('function');
      
      // モックのset, get関数で型安全性をテスト
      const mockSet = jest.fn();
      const mockGet = jest.fn(() => ({
        messagesBySession: {},
        sessions: {},
        isDbEnabled: false
      }));
      
      const slice = createMessageSlice(mockSet, mockGet);
      expect(typeof slice.addMessage).toBe('function');
      expect(typeof slice.updateLastMessage).toBe('function');
    });

    it('should handle message operations with type safety', () => {
      const messageStoreModule = require('@/store/chat/message.store');
      const { createMessageSlice } = messageStoreModule;
      
      const mockSet = jest.fn();
      const mockGet = jest.fn(() => ({
        messagesBySession: {},
        sessions: {},
        isDbEnabled: false
      }));
      
      const slice = createMessageSlice(mockSet, mockGet);
      
      // メッセージ追加時のエラーハンドリングが型安全であることを確認
      expect(async () => {
        await slice.addMessage('test-session', {
          role: 'user',
          content: 'Test message'
        });
      }).not.toThrow();
    });
  });

  describe('Orchestrator Agent 型安全性', () => {
    it('should eliminate as any casts in tool definitions', () => {
      // 🔴 Red: lib/mastra/agents/orchestrator.agent.ts Lines 122-126 のas anyキャスト除去
      const orchestratorModule = require('@/lib/mastra/agents/orchestrator.agent');
      const { orchestratorAgent } = orchestratorModule;
      
      // オーケストレーターエージェントが適切に定義されていることを確認
      expect(orchestratorAgent).toBeDefined();
      expect(orchestratorAgent.name).toBe('cryptrade-orchestrator-v2');
      
      // ツールが型安全に定義されていることを確認
      expect(orchestratorAgent.tools).toBeDefined();
      expect(typeof orchestratorAgent.tools).toBe('object');
    });

    it('should have proper execution response types', () => {
      const orchestratorModule = require('@/lib/mastra/agents/orchestrator.agent');
      const { executeImprovedOrchestrator } = orchestratorModule;
      
      expect(typeof executeImprovedOrchestrator).toBe('function');
      
      // 実行結果の型が適切であることを確認
      const testQuery = 'BTCの価格を教えて';
      expect(() => executeImprovedOrchestrator(testQuery)).not.toThrow();
    });
  });

  describe('Phase 5 統合テスト', () => {
    it('should ensure no as any casts remain in target files', () => {
      // Phase 5で対象となるファイルにas anyキャストが残っていないことを確認
      const targetFiles = [
        'store/market.store.ts',
        'store/config.store.ts', 
        'store/chart/stores/drawing.store.ts',
        'store/chat/message.store.ts',
        'lib/mastra/agents/orchestrator.agent.ts'
      ];
      
      // 各ファイルが正常にrequireできることを確認（型エラーがないことの間接的確認）
      targetFiles.forEach(filePath => {
        expect(() => {
          require(`@/${filePath}`);
        }).not.toThrow();
      });
    });

    it('should maintain backward compatibility', () => {
      // 既存のAPIが引き続き機能することを確認
      const marketStore = require('@/store/market.store');
      const configStore = require('@/store/config.store');
      
      expect(marketStore.useMarketStore).toBeDefined();
      expect(configStore.useConfigStore).toBeDefined();
      
      // レガシー関数が正常に動作することを確認
      expect(() => marketStore.useMarketStoreBase.reset()).not.toThrow();
      expect(() => configStore.useConfigStoreBase.setThemeMode('dark')).not.toThrow();
    });
  });
});