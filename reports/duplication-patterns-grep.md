# Code Duplication Patterns Analysis
Generated on: 2025年 6月29日 日曜日 07時16分39秒 +07

# API Route Patterns

## NextResponse patterns
Path: app/api

Found in 23 files
### Sample occurrences:
```
  27     return NextResponse.json(
  23       return NextResponse.json(
   9     return NextResponse.json({ success: true });
   6     return NextResponse.json({ 
   5     return NextResponse.json({
   2     return NextResponse.json({ records });
   2       return NextResponse.json({
   1   return NextResponse.json<ApiSuccessResponse<T>>(
   1   return NextResponse.json<ApiErrorResponse>(
   1   return NextResponse.json({
```

## Error responses
Path: app/api

Found in 0 files
### Sample occurrences:
```
```

## Try-catch blocks
Path: app/api

Found in 31 files
### Sample occurrences:
```
  37   } catch (error) {
   4     } catch (error) {
   2       } catch (error) {
   1   runTests().catch(error => {
   1     } catch (toolError) {
   1     } catch (orchestratorError) {
   1       } catch (err) {
   1         } catch (error) {
   1           } catch (error) {
   1                 } catch (e) {
```

# Store Patterns

## Zustand set patterns
Path: store

Found in 13 files
### Sample occurrences:
```
  20         set((state) => ({
   7         set((state) => {
   6         set({
   5       set((state: MarketState) => {
   5       set((state: MarketState) => ({
   4     set({
   4       set((state) => {
   3       set({
   2     set((state: any) => {
   2         set({ 
```

## State reset patterns
Path: store

Found in 15 files
### Sample occurrences:
```
   5 // Define initial state for consistency
   5   reset: () => void;
   4       reset: () => {
   4         debug('reset');
   3       ...initialState,
   2 const initialState = {
   2     reset: () => {
   2     reset,
   2         set(initialState);
   1 } satisfies { reset: ResetFunction });
```

# Hook Patterns

## useEffect patterns
Path: hooks

Found in 23 files
### Sample occurrences:
```
  37   useEffect(() => {
```

## useState patterns
Path: hooks

Found in 9 files
### Sample occurrences:
```
   2   const [isStreaming, setIsStreaming] = useState(false);
   2   const [isConnecting, setIsConnecting] = useState(false);
   1 \n/**\n * 非同期操作の共通基盤Hook\n * エラーハンドリング、ローディング状態、リトライ機能を提供\n * \n * Created: 2025-06-28 - コード重複解消のための共通基盤実装\n */\n\n'use client';\n\nimport { useState, useCallback, useRef } from 'react';\nimport { logger } from '@/lib/utils/logger';\n\nexport interface AsyncOperationOptions<T, P extends unknown[]> {\n  /** オペレーション名（ログ用） */\n  operationName: string;\n  /** リトライ回数 */\n  maxRetries?: number;\n  /** リトライ間隔（ms） */\n  retryDelay?: number;\n  /** エラー時のコールバック */\n  onError?: (error: Error, context?: Record<string, unknown>) => void;\n  /** 成功時のコールバック */\n  onSuccess?: (result: T, context?: Record<string, unknown>) => void;\n  /** バリデーション関数 */\n  validate?: (params: P) => { valid: boolean; error?: string; context?: Record<string, unknown> };\n}\n\nexport interface AsyncOperationReturn<T, P extends unknown[]> {\n  execute: (...params: P) => Promise<T>;\n  loading: boolean;\n  error: string | null;\n  reset: () => void;\n}\n\nexport function useAsyncOperation<T, P extends unknown[]>(\n  operation: (...params: P) => Promise<T>,\n  options: AsyncOperationOptions<T, P>\n): AsyncOperationReturn<T, P> {\n  const {\n    operationName,\n    maxRetries = 0,\n    retryDelay = 1000,\n    onError,\n    onSuccess,\n    validate\n  } = options;\n\n  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState<string | null>(null);\n  const abortControllerRef = useRef<AbortController | null>(null);\n\n  const execute = useCallback(async (...params: P): Promise<T> => {\n    // 既存の処理をキャンセル\n    if (abortControllerRef.current) {\n      abortControllerRef.current.abort();\n    }\n\n    // バリデーション\n    if (validate) {\n      const validation = validate(params);\n      if (!validation.valid) {\n        const errorMsg = validation.error || 'Validation failed';\n        logger.error(`[${operationName}] Validation failed`, { \n          error: errorMsg, \n          context: validation.context \n        });\n        setError(errorMsg);\n        throw new Error(errorMsg);\n      }\n    }\n\n    abortControllerRef.current = new AbortController();\n    setLoading(true);\n    setError(null);\n\n    let attempt = 0;\n    while (attempt <= maxRetries) {\n      try {\n        logger.debug(`[${operationName}] Starting operation`, { attempt: attempt + 1 });\n        \n        const result = await operation(...params);\n        \n        setLoading(false);\n        logger.info(`[${operationName}] Operation completed successfully`, { attempt: attempt + 1 });\n        \n        onSuccess?.(result, validate?.(params)?.context);\n        return result;\n\n      } catch (err) {\n        const error = err instanceof Error ? err : new Error(String(err));\n        \n        if (error.name === 'AbortError') {\n          setLoading(false);\n          throw error;\n        }\n\n        attempt++;\n        if (attempt > maxRetries) {\n          setLoading(false);\n          setError(error.message);\n          \n          logger.error(`[${operationName}] Operation failed after ${attempt} attempts`, {\n            error: error.message,\n            stack: error.stack\n          });\n          \n          onError?.(error, validate?.(params)?.context);\n          throw error;\n        }\n\n        logger.warn(`[${operationName}] Attempt ${attempt} failed, retrying...`, {\n          error: error.message,\n          nextAttemptIn: retryDelay\n        });\n\n        await new Promise(resolve => setTimeout(resolve, retryDelay));\n      }\n    }\n\n    throw new Error('Unexpected end of retry loop');\n  }, [operation, operationName, maxRetries, retryDelay, onError, onSuccess, validate]);\n\n  const reset = useCallback(() => {\n    if (abortControllerRef.current) {\n      abortControllerRef.current.abort();\n      abortControllerRef.current = null;\n    }\n    setLoading(false);\n    setError(null);\n  }, []);\n\n  return {\n    execute,\n    loading,\n    error,\n    reset\n  };\n}\n
   1   const [matches, setMatches] = useState(false);
   1   const [loading, setLoading] = useState(false);
   1   const [isConnected, setIsConnected] = useState(false);
   1   const [isClient, setIsClient] = useState(false);
   1   const [currentStepIndex, setCurrentStepIndex] = useState(-1);
```

## Error handling in hooks
Path: hooks

Found in 28 files
### Sample occurrences:
```
  18     } catch (error) {
  14       } catch (error) {
   5         } catch (error) {
   2   } catch (error) {
   2     } catch (err) {
   2     } catch (e) {
   2       } catch (err) {
   2           } catch (error) {
   1 \n/**\n * 非同期操作の共通基盤Hook\n * エラーハンドリング、ローディング状態、リトライ機能を提供\n * \n * Created: 2025-06-28 - コード重複解消のための共通基盤実装\n */\n\n'use client';\n\nimport { useState, useCallback, useRef } from 'react';\nimport { logger } from '@/lib/utils/logger';\n\nexport interface AsyncOperationOptions<T, P extends unknown[]> {\n  /** オペレーション名（ログ用） */\n  operationName: string;\n  /** リトライ回数 */\n  maxRetries?: number;\n  /** リトライ間隔（ms） */\n  retryDelay?: number;\n  /** エラー時のコールバック */\n  onError?: (error: Error, context?: Record<string, unknown>) => void;\n  /** 成功時のコールバック */\n  onSuccess?: (result: T, context?: Record<string, unknown>) => void;\n  /** バリデーション関数 */\n  validate?: (params: P) => { valid: boolean; error?: string; context?: Record<string, unknown> };\n}\n\nexport interface AsyncOperationReturn<T, P extends unknown[]> {\n  execute: (...params: P) => Promise<T>;\n  loading: boolean;\n  error: string | null;\n  reset: () => void;\n}\n\nexport function useAsyncOperation<T, P extends unknown[]>(\n  operation: (...params: P) => Promise<T>,\n  options: AsyncOperationOptions<T, P>\n): AsyncOperationReturn<T, P> {\n  const {\n    operationName,\n    maxRetries = 0,\n    retryDelay = 1000,\n    onError,\n    onSuccess,\n    validate\n  } = options;\n\n  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState<string | null>(null);\n  const abortControllerRef = useRef<AbortController | null>(null);\n\n  const execute = useCallback(async (...params: P): Promise<T> => {\n    // 既存の処理をキャンセル\n    if (abortControllerRef.current) {\n      abortControllerRef.current.abort();\n    }\n\n    // バリデーション\n    if (validate) {\n      const validation = validate(params);\n      if (!validation.valid) {\n        const errorMsg = validation.error || 'Validation failed';\n        logger.error(`[${operationName}] Validation failed`, { \n          error: errorMsg, \n          context: validation.context \n        });\n        setError(errorMsg);\n        throw new Error(errorMsg);\n      }\n    }\n\n    abortControllerRef.current = new AbortController();\n    setLoading(true);\n    setError(null);\n\n    let attempt = 0;\n    while (attempt <= maxRetries) {\n      try {\n        logger.debug(`[${operationName}] Starting operation`, { attempt: attempt + 1 });\n        \n        const result = await operation(...params);\n        \n        setLoading(false);\n        logger.info(`[${operationName}] Operation completed successfully`, { attempt: attempt + 1 });\n        \n        onSuccess?.(result, validate?.(params)?.context);\n        return result;\n\n      } catch (err) {\n        const error = err instanceof Error ? err : new Error(String(err));\n        \n        if (error.name === 'AbortError') {\n          setLoading(false);\n          throw error;\n        }\n\n        attempt++;\n        if (attempt > maxRetries) {\n          setLoading(false);\n          setError(error.message);\n          \n          logger.error(`[${operationName}] Operation failed after ${attempt} attempts`, {\n            error: error.message,\n            stack: error.stack\n          });\n          \n          onError?.(error, validate?.(params)?.context);\n          throw error;\n        }\n\n        logger.warn(`[${operationName}] Attempt ${attempt} failed, retrying...`, {\n          error: error.message,\n          nextAttemptIn: retryDelay\n        });\n\n        await new Promise(resolve => setTimeout(resolve, retryDelay));\n      }\n    }\n\n    throw new Error('Unexpected end of retry loop');\n  }, [operation, operationName, maxRetries, retryDelay, onError, onSuccess, validate]);\n\n  const reset = useCallback(() => {\n    if (abortControllerRef.current) {\n      abortControllerRef.current.abort();\n      abortControllerRef.current = null;\n    }\n    setLoading(false);\n    setError(null);\n  }, []);\n\n  return {\n    execute,\n    loading,\n    error,\n    reset\n  };\n}\n
   1     } catch (_error) {
```

# Component Patterns

## Loading states
Path: components

Found in 12 files
### Sample occurrences:
```
   3   if (isLoading) {
   2   isLoading: boolean
   2   isLoading,
   2   const isLoading = !hasEnoughData;
   1   }, [messages, isLoading, isStreaming, analysisInProgress])
   1   if (loading) {
   1   if (isLoading && priceData.length === 0) {
   1   const { user, loading: authLoading, signOut } = useAuth()
   1   const { user, loading: authLoading } = useAuth()
   1   const { user, loading, signOut } = useAuth();
```

## Error states
Path: components

Found in 21 files
### Sample occurrences:
```
  10     } catch (error) {
   4         } catch (error) {
   2   const [error, setError] = useState<string | null>(null)
   2     if (step.status === 'error') {
   2     error,
   2         {error && (
   2           {error && (
   1   type: 'success' | 'error' | 'warning' | 'info';
   1   onError?: (error: Error) => void;
   1   if (error) {
```

# Specific Duplication Patterns

## Similar function structures
Looking for functions with similar signatures...

### Async functions with try-catch:
```
  12 async function main() {
   7 export async function POST(request: NextRequest) {
   5 export async function GET(request: NextRequest) {
   5       await act(async () => {
   4   execute: async ({ context }) => {
   4       jest.mocked(withRetry).mockImplementation(async (fn, options) => {
   3 export async function POST(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
   3 export async function GET(_request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
   3 export async function GET() {
   3   return async (request: NextRequest, context?: ApiHandlerContext) => {
```

### Most common imports:
```
 300 import { logger } from '@/lib/utils/logger';
  78 import { z } from 'zod';
  54 import { 
  52 import {
  42 import { env } from '@/config/env';
  42 import { NextRequest } from 'next/server';
  39 import type { 
  35 import { renderHook } from '@testing-library/react';
  33 import { act } from 'react';;
  31 import { prisma } from '@/lib/db/prisma';
  31 import React from 'react'
  30 import { NextRequest, NextResponse } from 'next/server';
  29 import { getServerSession } from '@/lib/auth/server';
  26 import { describe, it, expect, jest, beforeEach } from '@jest/globals';
  26 import React from 'react';
  22 import type { ProcessedKline } from '@/types/market';
  19 import { isDevelopment } from '@/config/env';
  19 import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
  19 import * as path from 'path';
  18 import { WSManager } from '@/lib/ws/WSManager';
```

