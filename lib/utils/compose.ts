import type { ApiMiddleware, RequestCtx } from '@/types/api';

/**
 * Composes multiple middleware functions into a single function.
 * Middleware are executed in order, with each middleware calling the next one in the chain.
 * 
 * @param {ApiMiddleware[]} middlewares - Array of middleware functions to compose
 * @returns {(ctx: RequestCtx) => Promise<RequestCtx>} A composed function that executes all middleware in sequence
 */
export const compose = (middlewares: ApiMiddleware[]) =>
  (ctx: RequestCtx): Promise<RequestCtx> =>
    middlewares.reduceRight<() => Promise<RequestCtx>>(
      (next, middleware) => () => middleware(ctx, next),
      () => Promise.resolve(ctx)
    )();

/**
 * Creates a final middleware that actually executes the HTTP request.
 * This is typically added as the last middleware in the chain.
 * 
 * @param {RequestCtx} ctx - The request context
 * @returns {Promise<RequestCtx>} Promise resolving to the updated context with response
 */
export const createFinalMiddleware = (): ApiMiddleware =>
  async (ctx: RequestCtx): Promise<RequestCtx> => {
    const { url, ...init } = ctx.request;
    const response = await fetch(url, init);
    return { ...ctx, response };
  };

/**
 * Utility to compose middleware with a final fetch middleware automatically added.
 * 
 * @param {ApiMiddleware[]} middlewares - Array of middleware functions
 * @returns {(ctx: RequestCtx) => Promise<RequestCtx>} Composed middleware chain with fetch as the final step
 */
export const composeWithFetch = (middlewares: ApiMiddleware[]) => {
  const allMiddlewares = [...middlewares, createFinalMiddleware()];
  return compose(allMiddlewares);
};