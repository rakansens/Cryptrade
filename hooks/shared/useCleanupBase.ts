/**
 * 共通クリーンアップパターンの基盤
 * useChartInstance ↔ useStreamBase の重複（Score 246.5）を解消
 */

import { useRef, useCallback, useEffect } from 'react';
import { logger } from '@/lib/utils/logger';

export interface CleanupTask {
  id: string;
  cleanup: () => void | Promise<void>;
  priority?: 'high' | 'medium' | 'low';
}

export interface UseCleanupBaseConfig {
  hookName: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  autoCleanupOnUnmount?: boolean;
}

/**
 * 共通クリーンアップ管理フック
 * 複数のref、observer、listenerの安全なクリーンアップを提供
 */
export function useCleanupBase(config: UseCleanupBaseConfig = { hookName: 'unknown' }) {
  const {
    hookName,
    logLevel = 'info',
    autoCleanupOnUnmount = true
  } = config;

  const tasksRef = useRef<Map<string, CleanupTask>>(new Map());
  const isCleaningUpRef = useRef(false);
  const isMountedRef = useRef(true);

  const safeLog = useCallback((level: string, message: string, data?: any) => {
    if (!isMountedRef.current) return;
    
    const shouldLog = 
      (level === 'error') ||
      (level === 'warn' && ['debug', 'info', 'warn', 'error'].includes(logLevel)) ||
      (level === 'info' && ['debug', 'info'].includes(logLevel)) ||
      (level === 'debug' && logLevel === 'debug');

    if (shouldLog) {
      const formattedMessage = `[${hookName}] ${message}`;
      const logData = data ? { ...data } : undefined;
      
      switch (level) {
        case 'error':
          logger.error(formattedMessage, logData);
          break;
        case 'warn':
          logger.warn(formattedMessage, logData);
          break;
        case 'info':
          logger.info(formattedMessage, logData);
          break;
        case 'debug':
          logger.debug(formattedMessage, logData);
          break;
      }
    }
  }, [hookName, logLevel]);

  /**
   * クリーンアップタスクを登録
   */
  const registerCleanupTask = useCallback((task: CleanupTask) => {
    if (isCleaningUpRef.current) {
      safeLog('warn', `Cannot register cleanup task "${task.id}" - cleanup in progress`);
      return;
    }

    tasksRef.current.set(task.id, task);
    safeLog('debug', `Registered cleanup task: ${task.id}`, { priority: task.priority });
  }, [safeLog]);

  /**
   * 特定のクリーンアップタスクを削除
   */
  const unregisterCleanupTask = useCallback((id: string) => {
    const removed = tasksRef.current.delete(id);
    if (removed) {
      safeLog('debug', `Unregistered cleanup task: ${id}`);
    }
    return removed;
  }, [safeLog]);

  /**
   * Refの安全なクリーンアップ
   */
  const cleanupRef = useCallback(<T>(
    ref: React.MutableRefObject<T | null>,
    cleanupFn?: (current: T) => void | Promise<void>,
    taskId?: string
  ): (() => Promise<void>) | void => {
    const cleanup = async () => {
      if (ref.current) {
        try {
          if (cleanupFn) {
            await cleanupFn(ref.current);
          }
          ref.current = null;
          safeLog('debug', `Cleaned up ref: ${taskId || 'unnamed'}`);
        } catch (error) {
          safeLog('error', `Error cleaning up ref ${taskId || 'unnamed'}`, { 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }
    };

    if (taskId) {
      registerCleanupTask({
        id: taskId,
        cleanup,
        priority: 'medium'
      });
      return;
    } else {
      return cleanup;
    }
  }, [registerCleanupTask, safeLog]);

  /**
   * EventListenerの安全なクリーンアップ
   */
  const cleanupEventListener = useCallback((
    target: EventTarget,
    eventType: string,
    listener: EventListener,
    taskId: string
  ) => {
    registerCleanupTask({
      id: taskId,
      cleanup: () => {
        try {
          target.removeEventListener(eventType, listener);
          safeLog('debug', `Removed event listener: ${eventType} from ${taskId}`);
        } catch (error) {
          safeLog('error', `Error removing event listener ${eventType}`, { 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      },
      priority: 'high'
    });
  }, [registerCleanupTask, safeLog]);

  /**
   * Timeoutの安全なクリーンアップ
   */
  const cleanupTimeout = useCallback((
    timeoutRef: React.MutableRefObject<NodeJS.Timeout | null>,
    taskId: string
  ) => {
    registerCleanupTask({
      id: taskId,
      cleanup: () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
          safeLog('debug', `Cleared timeout: ${taskId}`);
        }
      },
      priority: 'high'
    });
  }, [registerCleanupTask, safeLog]);

  /**
   * ObserverのクリーンアップHelper
   */
  const cleanupObserver = useCallback(<T extends { disconnect(): void }>(
    observerRef: React.MutableRefObject<T | null>,
    taskId: string
  ) => {
    cleanupRef(observerRef, (observer) => observer.disconnect(), taskId);
  }, [cleanupRef]);

  /**
   * 全てのクリーンアップタスクを実行
   */
  const executeAllCleanupTasks = useCallback(async () => {
    if (isCleaningUpRef.current) {
      safeLog('warn', 'Cleanup already in progress');
      return;
    }

    isCleaningUpRef.current = true;
    isMountedRef.current = false;

    const tasks = Array.from(tasksRef.current.values());
    
    // 優先度順でソート（high -> medium -> low）
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    tasks.sort((a, b) => 
      (priorityOrder[b.priority || 'medium'] - priorityOrder[a.priority || 'medium'])
    );

    safeLog('info', `Executing ${tasks.length} cleanup tasks`);

    let completed = 0;
    let errors = 0;

    for (const task of tasks) {
      try {
        await task.cleanup();
        completed++;
        safeLog('debug', `Completed cleanup task: ${task.id}`);
      } catch (error) {
        errors++;
        safeLog('error', `Failed to cleanup task ${task.id}`, { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    tasksRef.current.clear();
    safeLog('info', `Cleanup completed: ${completed} successful, ${errors} failed`);
  }, [safeLog]);

  // 自動クリーンアップ
  useEffect(() => {
    if (!autoCleanupOnUnmount) return;

    return () => {
      executeAllCleanupTasks();
    };
  }, [executeAllCleanupTasks, autoCleanupOnUnmount]);

  /**
   * 特定タスクの存在確認
   */
  const hasTask = useCallback((taskId: string): boolean => {
    return tasksRef.current.has(taskId);
  }, []);

  /**
   * 特定タスクの実行と削除
   */
  const executeCleanupTask = useCallback(async (taskId: string): Promise<boolean> => {
    const task = tasksRef.current.get(taskId);
    if (!task || !isMountedRef.current) {
      return false;
    }

    try {
      await task.cleanup();
      tasksRef.current.delete(taskId);
      safeLog('debug', `Executed cleanup task: ${taskId}`);
      return true;
    } catch (error) {
      safeLog('error', `Error in cleanup task ${taskId}`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }, [safeLog]);

  /**
   * 全クリーンアップタスクの実行（エイリアス）
   */
  const cleanupAll = executeAllCleanupTasks;

  return {
    // Registration
    registerCleanupTask,
    unregisterCleanupTask,
    
    // Specialized helpers
    cleanupRef,
    cleanupEventListener,
    cleanupTimeout,
    cleanupObserver,
    
    // Execution
    executeAllCleanupTasks,
    executeCleanupTask,
    cleanupAll,
    
    // State
    isMounted: () => isMountedRef.current,
    isCleaningUp: () => isCleaningUpRef.current,
    getTaskCount: () => tasksRef.current.size,
    hasTask,
    
    // Utilities
    safeLog
  };
}

export type CleanupBase = ReturnType<typeof useCleanupBase>;