/**
 * Database Connection Management Utility
 * 
 * データベース接続の管理とエラーハンドリング
 * - 接続の再試行
 * - 接続プールの管理
 * - トランザクション管理
 * - エラー時のフォールバック
 */

import { logger } from '@/lib/utils/logger';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { env } from '@/config/env';

export interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

export class DatabaseConnection {
  private static isConnected = false;
  private static connectionAttempts = 0;
  private static readonly MAX_CONNECTION_ATTEMPTS = 5;
  private static readonly CONNECTION_RETRY_DELAY = 1000;

  /**
   * データベース接続を確立
   */
  static async ensureConnection(): Promise<boolean> {
    if (this.isConnected) {
      return true;
    }

    while (this.connectionAttempts < this.MAX_CONNECTION_ATTEMPTS) {
      try {
        await prisma.$connect();
        this.isConnected = true;
        this.connectionAttempts = 0;
        logger.info('[DatabaseConnection] Connected to database');
        return true;
      } catch (error) {
        this.connectionAttempts++;
        logger.error('[DatabaseConnection] Connection attempt failed', {
          attempt: this.connectionAttempts,
          error: error instanceof Error ? error.message : String(error)
        });

        if (this.connectionAttempts >= this.MAX_CONNECTION_ATTEMPTS) {
          throw new Error(`Failed to connect to database after ${this.MAX_CONNECTION_ATTEMPTS} attempts`);
        }

        // 指数バックオフで待機
        const delay = this.CONNECTION_RETRY_DELAY * Math.pow(2, this.connectionAttempts - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return false;
  }

  /**
   * データベース接続を切断
   */
  static async disconnect(): Promise<void> {
    try {
      await prisma.$disconnect();
      this.isConnected = false;
      logger.info('[DatabaseConnection] Disconnected from database');
    } catch (error) {
      logger.error('[DatabaseConnection] Failed to disconnect', { error });
    }
  }

  /**
   * トランザクション内で処理を実行
   */
  static async transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    await this.ensureConnection();

    try {
      return await prisma.$transaction(fn, {
        maxWait: options?.maxWait ?? 2000,
        timeout: options?.timeout ?? 5000,
        isolationLevel: options?.isolationLevel ?? Prisma.TransactionIsolationLevel.ReadCommitted
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw this.handlePrismaError(error);
      }
      throw error;
    }
  }

  /**
   * Prismaエラーを処理
   */
  static handlePrismaError(error: Prisma.PrismaClientKnownRequestError): Error {
    switch (error.code) {
      case 'P2002':
        const target = error.meta?.['target'];
        const targetStr = Array.isArray(target) ? target.join(', ') : target;
        return new Error(`Unique constraint violation: ${targetStr}`);
      case 'P2003':
        return new Error(`Foreign key constraint violation: ${error.meta?.['field_name']}`);
      case 'P2025':
        return new Error('Record not found');
      case 'P2024':
        return new Error('Connection pool timeout');
      default:
        return new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * 接続状態を確認
   */
  static isHealthy(): boolean {
    return this.isConnected;
  }
}

/**
 * データベース操作のラッパー（エラーハンドリング付き）
 */
export async function withDatabase<T>(
  operation: () => Promise<T>,
  fallback?: () => T | Promise<T>
): Promise<T> {
  try {
    await DatabaseConnection.ensureConnection();
    return await operation();
  } catch (error) {
    logger.error('[withDatabase] Operation failed', { error });

    // 開発環境またはフォールバックが提供されている場合
    if (env.NODE_ENV === 'development' || fallback) {
      if (fallback) {
        logger.warn('[withDatabase] Using fallback due to database error');
        return await fallback();
      }
      throw error;
    }

    // 本番環境ではより詳細なエラーを投げる
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw DatabaseConnection.handlePrismaError(error);
    }
    
    throw new Error(`Database operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * バッチ操作用のヘルパー
 */
export async function batchOperation<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  batchSize: number = 10
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(operation));
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * データベースヘルスチェック
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - startTime;
    
    return {
      healthy: true,
      latency
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}