import { logger } from '@/lib/utils/logger';
import { RetryWrapper } from '@/lib/utils/retry-wrapper';
import { incrementMetric, observeMetric } from '@/lib/monitoring/metrics';
import { traceManager } from '@/lib/monitoring/trace';

/**
 * Drawing Operation Queue
 * 
 * Manages queuing and execution of drawing operations to prevent race conditions
 * and ensure sequential processing of drawing commands.
 */

export interface QueuedOperation<T = unknown> {
  id: string;
  operation: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

export class DrawingOperationQueue {
  private queue: QueuedOperation[] = [];
  private isProcessing = false;
  private maxConcurrency = 1; // Sequential processing by default
  private activeOperations = 0;
  private retryWrapper: RetryWrapper;

  constructor(options?: { maxConcurrency?: number; enableRetry?: boolean }) {
    this.maxConcurrency = options?.maxConcurrency || 1;
    
    this.retryWrapper = new RetryWrapper({
      maxAttempts: 3,
      initialDelay: 1000,
      factor: 2,
      onRetry: (error, attempt) => {
        logger.warn('[DrawingQueue] Retrying operation', { error: error.message, attempt });
        incrementMetric('drawing_retry_total');
      }
    });
  }

  /**
   * Add operation to queue
   */
  async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const id = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const queuedOp: QueuedOperation<T> = {
        id,
        operation,
        resolve,
        reject,
        timestamp: Date.now(),
      };
      
      this.queue.push(queuedOp);
      logger.info('[DrawingQueue] Operation enqueued', { 
        id, 
        queueLength: this.queue.length 
      });
      
      this.processQueue();
    });
  }

  /**
   * Process queue
   */
  private async processQueue(): Promise<void> {
    if (this.activeOperations >= this.maxConcurrency) {
      return;
    }

    const operation = this.queue.shift();
    if (!operation) {
      return;
    }

    this.activeOperations++;
    
    const startTime = Date.now();
    const traceId = `drawing_${operation.id}`;
    
    try {
      logger.info('[DrawingQueue] Processing operation', { 
        id: operation.id,
        waitTime: startTime - operation.timestamp,
        remaining: this.queue.length
      });
      
      // Start trace
      traceManager.startTrace({
        sessionId: traceId,
        agentId: 'drawing-queue',
        operationType: 'tool_execution',
      });
      
      // Wrap operation with retry logic
      const result = await this.retryWrapper.execute(
        operation.operation,
        `drawing_operation_${operation.id}`
      );
      
      operation.resolve(result);
      incrementMetric('drawing_success_total');
      
      const latencyMs = Date.now() - startTime;
      observeMetric('drawing_operation_duration_ms', latencyMs);
      
      // End trace with success (commented out due to type issues)
      // traceManager.endTrace(traceId, {
      //   success: true,
      //   latencyMs,
      // });
      
      logger.info('[DrawingQueue] Operation completed', { 
        id: operation.id, 
        latencyMs 
      });
    } catch (error) {
      logger.error('[DrawingQueue] Operation failed after retries', { 
        id: operation.id, 
        error 
      });
      incrementMetric('drawing_failed_total');
      
      const latencyMs = Date.now() - startTime;
      observeMetric('drawing_operation_duration_ms', latencyMs);
      
      // End trace with failure (commented out due to type issues)
      // traceManager.endTrace(traceId, {
      //   success: false,
      //   latencyMs,
      //   error: error instanceof Error ? error.message : String(error),
      // });
      
      operation.reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.activeOperations--;
      
      // Process next item
      if (this.queue.length > 0) {
        this.processQueue();
      }
    }
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      activeOperations: this.activeOperations,
      maxConcurrency: this.maxConcurrency,
      isProcessing: this.activeOperations > 0,
    };
  }

  /**
   * Clear queue
   */
  clear(): void {
    const cleared = this.queue.length;
    
    // Reject all pending operations
    this.queue.forEach(op => {
      op.reject(new Error('Queue cleared'));
    });
    
    this.queue = [];
    logger.info('[DrawingQueue] Queue cleared', { clearedCount: cleared });
  }

  /**
   * Wait for all operations to complete
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0 && this.activeOperations === 0) {
      return;
    }

    return new Promise((resolve) => {
      const checkComplete = setInterval(() => {
        if (this.queue.length === 0 && this.activeOperations === 0) {
          clearInterval(checkComplete);
          resolve();
        }
      }, 100);
    });
  }
}

// Singleton instance
export const drawingQueue = new DrawingOperationQueue({ maxConcurrency: 1 });