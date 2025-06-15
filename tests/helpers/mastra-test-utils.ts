import { logger } from '@/lib/utils/logger';
import type { ToolExecutionContext } from '@mastra/core';
import type { z } from 'zod';

/**
 * Creates a properly typed RuntimeContext for testing
 */
export function createTestRuntimeContext(): any {
  const context = {
    get: (key: string) => {
      if (key === 'logger') return logger;
      return undefined;
    },
    set: (_key: string, _value: any) => {},
  };
  return context;
}

/**
 * Creates a properly typed ToolExecutionContext for testing
 */
export function createTestToolExecutionContext<TSchemaIn extends z.ZodSchema | undefined = undefined>(
  context: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> : {}
): ToolExecutionContext<TSchemaIn> {
  return {
    context,
    runtimeContext: createTestRuntimeContext(),
  };
}