import { PrismaClient, Prisma } from '@prisma/client'
import { logger } from '@/lib/utils/logger'

// Prismaイベントの型定義
type PrismaQueryEvent = {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
}

type PrismaLogEvent = {
  timestamp: Date;
  message: string;
  target?: string;
}

type PrismaErrorEvent = {
  timestamp: Date;
  message: string;
  target?: string;
}

// Singleton pattern for Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create Prisma client with enhanced configuration
function createPrismaClient() {
  const client = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
    errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
  })

  // Log queries in development
  if (process.env.NODE_ENV === 'development') {
    client.$on('query' as never, (e: PrismaQueryEvent) => {
      logger.debug('[Prisma Query]', {
        query: e.query,
        params: e.params,
        duration: e.duration,
      })
    })
  }

  // Always log errors
  client.$on('error' as never, (e: PrismaErrorEvent) => {
    logger.error('[Prisma Error]', { error: e })
  })

  // Log warnings
  client.$on('warn' as never, (e: PrismaLogEvent) => {
    logger.warn('[Prisma Warning]', { warning: e })
  })

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// BigIntを持つ可能性があるデータの型
type SerializableData = 
  | string 
  | number 
  | boolean 
  | bigint 
  | null 
  | undefined
  | SerializableData[]
  | { [key: string]: SerializableData };

// Helper function to handle BigInt serialization
export function serializeBigInt<T extends SerializableData>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  ) as T
}

// Prismaトランザクションヘルパー
export type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'
>

// トランザクションオプション
export interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

// トランザクション実行ヘルパー
export async function withTransaction<T>(
  fn: (tx: PrismaTransactionClient) => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
  return prisma.$transaction(fn, options)
}