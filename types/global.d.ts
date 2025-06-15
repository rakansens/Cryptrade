/**
 * Global type declarations for Cryptrade
 */

import { SSEEvent } from '../lib/utils/sse';

declare global {
  // Extend the globalThis interface to include custom properties
  var __clientStreams: Set<(event: SSEEvent) => void> | undefined;
}

// This export is necessary to make this file a module
export {};