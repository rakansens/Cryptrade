/**
 * Edge Runtime compatible environment configuration
 * This file is used in middleware.ts and other Edge Runtime contexts
 */

// Re-export from the main Edge-compatible env module
export { env as edgeEnv } from './env';
export type { Env as EdgeEnvironment } from './env';