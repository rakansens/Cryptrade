import { RuntimeContext } from '@mastra/core';
import { logger } from '@/lib/utils/logger';
import type { ToolExecutionContext } from '@mastra/core';
import type { z } from 'zod';

/**
 * Creates a properly typed RuntimeContext for testing
 */
export function createTestRuntimeContext(): RuntimeContext {
  const context = new RuntimeContext();
  context.set('logger', logger);
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