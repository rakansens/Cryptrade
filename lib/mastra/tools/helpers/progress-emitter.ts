import { logger } from '@/lib/utils/logger';

/**
 * Progress emitter for sending analysis progress updates
 * This allows the proposal generation tool to emit progress events
 * that can be consumed by SSE endpoints
 */

interface ProgressEvent {
  type: string;
  step?: string;
  progress?: number;
  details?: unknown;
}

type ProgressCallback = (event: ProgressEvent) => void;

class ProgressEmitter {
  private callbacks: Set<ProgressCallback> = new Set();
  
  /**
   * Register a callback to receive progress updates
   */
  onProgress(callback: ProgressCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }
  
  /**
   * Emit a progress event to all registered callbacks
   */
  emit(event: ProgressEvent): void {
    this.callbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        logger.error('[ProgressEmitter] Error in callback', { error });
      }
    });
  }
  
  /**
   * Clear all callbacks
   */
  clear(): void {
    this.callbacks.clear();
  }
}

// Export singleton instance
export const progressEmitter = new ProgressEmitter();