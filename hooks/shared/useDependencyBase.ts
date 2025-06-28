/**
 * 複雑な依存配列管理の基盤
 * useChartInstance ↔ useWebSocket ↔ useStreamBase の依存配列重複（Score 265.6+）を解消
 */

import { useCallback, useMemo, DependencyList } from 'react';

export interface DependencyGroup {
  id: string;
  dependencies: DependencyList;
  description?: string;
}

export interface DependencyConfig {
  hookName: string;
  groups: DependencyGroup[];
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * 複雑な依存配列を管理するフック
 * 長い依存配列パターンの重複を解消し、統一された管理を提供
 */
export function useDependencyBase(config: DependencyConfig) {
  const { hookName, groups, logLevel = 'info' } = config;

  const safeLog = useCallback((level: string, message: string, data?: any) => {
    const shouldLog = 
      (level === 'error') ||
      (level === 'warn' && ['debug', 'info', 'warn', 'error'].includes(logLevel)) ||
      (level === 'info' && ['debug', 'info'].includes(logLevel)) ||
      (level === 'debug' && logLevel === 'debug');

    if (shouldLog) {
      switch (level) {
        case 'error':
          console.error(`[${hookName}] ${message}`, data || '');
          break;
        case 'warn':
          console.warn(`[${hookName}] ${message}`, data || '');
          break;
        case 'info':
          console.info(`[${hookName}] ${message}`, data || '');
          break;
        case 'debug':
          console.log(`[${hookName}] ${message}`, data || '');
          break;
      }
    }
  }, [hookName, logLevel]);

  /**
   * 依存配列グループを統合
   */
  const mergedDependencies = useMemo(() => {
    const allDeps: any[] = [];
    const groupInfo: string[] = [];

    groups.forEach(group => {
      allDeps.push(...group.dependencies);
      groupInfo.push(group.id);
    });

    safeLog('debug', `Merged dependencies from groups: ${groupInfo.join(', ')}`, {
      totalDependencies: allDeps.length,
      groups: groupInfo
    });

    return allDeps;
  }, [groups, safeLog]);

  /**
   * 依存配列の変化を検出
   */
  const dependencyChangeDetector = useMemo(() => {
    return {
      current: mergedDependencies,
      hasChanged: (prev: any[]) => {
        if (prev.length !== mergedDependencies.length) return true;
        return prev.some((dep, index) => dep !== mergedDependencies[index]);
      }
    };
  }, [mergedDependencies]);

  /**
   * 特定のグループの依存配列を取得
   */
  const getDependencyGroup = useCallback((groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) {
      safeLog('warn', `Dependency group not found: ${groupId}`);
      return [];
    }
    return group.dependencies;
  }, [groups, safeLog]);

  /**
   * 依存配列付きuseCallbackの生成
   */
  const createStableCallback = useCallback(<T extends (...args: any[]) => any>(
    fn: T,
    dependencyGroupId?: string
  ): T => {
    const deps = dependencyGroupId 
      ? getDependencyGroup(dependencyGroupId)
      : mergedDependencies;

    return useCallback(fn, deps) as T;
  }, [getDependencyGroup, mergedDependencies]);

  /**
   * 依存配列付きuseMemoの生成
   */
  const createStableMemo = useCallback(<T>(
    factory: () => T,
    dependencyGroupId?: string
  ): T => {
    const deps = dependencyGroupId 
      ? getDependencyGroup(dependencyGroupId)
      : mergedDependencies;

    return useMemo(factory, deps);
  }, [getDependencyGroup, mergedDependencies]);

  /**
   * 条件付き依存配列の生成
   */
  const createConditionalDeps = useCallback((
    condition: boolean,
    trueDeps: DependencyList,
    falseDeps: DependencyList = []
  ) => {
    return useMemo(() => 
      condition ? trueDeps : falseDeps, 
      [condition, trueDeps, falseDeps]
    );
  }, []);

  /**
   * 依存配列の統計情報
   */
  const getDependencyStats = useCallback(() => {
    const stats = {
      totalGroups: groups.length,
      totalDependencies: mergedDependencies.length,
      groupDetails: groups.map(group => ({
        id: group.id,
        count: group.dependencies.length,
        description: group.description
      }))
    };

    safeLog('debug', 'Dependency statistics', stats);
    return stats;
  }, [groups, mergedDependencies, safeLog]);

  return {
    // 基本機能
    mergedDependencies,
    dependencyChangeDetector,
    getDependencyGroup,
    
    // 高次機能
    createStableCallback,
    createStableMemo,
    createConditionalDeps,
    
    // ユーティリティ
    getDependencyStats,
    safeLog,
    
    // 設定情報
    hookName,
    groups: groups.map(g => ({ id: g.id, description: g.description }))
  };
}

/**
 * 一般的な依存配列パターンのヘルパー
 */
export const createCommonDependencyGroups = {
  /**
   * イベントハンドラー系の依存配列
   */
  eventHandlers: (callbacks: any[]): DependencyGroup => ({
    id: 'event-handlers',
    dependencies: callbacks,
    description: 'Event handler callbacks'
  }),

  /**
   * 設定オプション系の依存配列
   */
  options: (options: any[]): DependencyGroup => ({
    id: 'options',
    dependencies: options,
    description: 'Configuration options'
  }),

  /**
   * 状態管理系の依存配列
   */
  stateManagement: (state: any[]): DependencyGroup => ({
    id: 'state-management',
    dependencies: state,
    description: 'State management values'
  }),

  /**
   * 外部リソース系の依存配列
   */
  externalResources: (resources: any[]): DependencyGroup => ({
    id: 'external-resources',
    dependencies: resources,
    description: 'External resources and refs'
  })
};

export type DependencyBase = ReturnType<typeof useDependencyBase>;