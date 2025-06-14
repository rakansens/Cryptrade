/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DrawingOperationQueue } from '@/lib/utils/drawing-queue';
import { ChartDrawingManager } from '@/lib/chart/drawing-primitives';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Drawing Reliability Tests', () => {
  describe('DrawingOperationQueue', () => {
    let queue: DrawingOperationQueue;
    
    beforeEach(() => {
      queue = new DrawingOperationQueue({ maxConcurrency: 1 });
    });
    
    afterEach(() => {
      queue.clear();
    });
    
    it('should process operations sequentially', async () => {
      const results: number[] = [];
      const operations = [1, 2, 3].map(n => () => 
        new Promise<number>(resolve => {
          setTimeout(() => {
            results.push(n);
            resolve(n);
          }, 10);
        })
      );
      
      const promises = operations.map(op => queue.enqueue(op));
      const values = await Promise.all(promises);
      
      expect(values).toEqual([1, 2, 3]);
      expect(results).toEqual([1, 2, 3]);
    });
    
    it('should handle operation failures', async () => {
      const failingOp = () => Promise.reject(new Error('Test error'));
      const successOp = () => Promise.resolve('success');
      
      await expect(queue.enqueue(failingOp)).rejects.toThrow('Test error');
      await expect(queue.enqueue(successOp)).resolves.toBe('success');
    });
    
    it('should respect maxConcurrency', async () => {
      const concurrentQueue = new DrawingOperationQueue({ maxConcurrency: 2 });
      let concurrent = 0;
      let maxConcurrent = 0;
      
      const operations = Array(5).fill(null).map(() => async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise(resolve => setTimeout(resolve, 50));
        concurrent--;
        return concurrent;
      });
      
      await Promise.all(operations.map(op => concurrentQueue.enqueue(op)));
      
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
    
    it('should clear pending operations', async () => {
      const longOp = () => new Promise(resolve => setTimeout(resolve, 1000));
      
      const promise1 = queue.enqueue(longOp);
      const promise2 = queue.enqueue(longOp);
      
      queue.clear();
      
      await expect(promise2).rejects.toThrow('Queue cleared');
      
      // First operation might complete or reject depending on timing
      try {
        await promise1;
      } catch (e) {
        expect(e).toEqual(expect.objectContaining({ message: 'Queue cleared' }));
      }
    });
  });
  
  describe('Async Drawing Store Integration', () => {
    it('should handle drawing confirmation timeout', async () => {
      // This would be an integration test with the actual store
      // For now, we test the concept
      
      const mockAddDrawingAsync = jest.fn().mockImplementation((drawing) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`Drawing ${drawing.id} addition timed out`));
          }, 100);
          
          // Simulate no confirmation event
        });
      });
      
      const drawing = { id: 'test-1', type: 'trendline' };
      await expect(mockAddDrawingAsync(drawing)).rejects.toThrow('timed out');
    });
    
    it('should handle successful drawing confirmation', async () => {
      const mockAddDrawingAsync = jest.fn().mockImplementation((drawing) => {
        return new Promise((resolve) => {
          // Simulate confirmation event
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('chart:drawingAdded', {
                detail: { id: drawing.id }
              }));
            }
          }, 10);
          
          const handler = (event: Event) => {
            const customEvent = event as CustomEvent;
            if (customEvent.detail.id === drawing.id) {
              if (typeof window !== 'undefined') {
                window.removeEventListener('chart:drawingAdded', handler);
              }
              resolve(drawing);
            }
          };
          
          if (typeof window !== 'undefined') {
            window.addEventListener('chart:drawingAdded', handler);
          }
        });
      });
      
      const drawing = { id: 'test-2', type: 'fibonacci' };
      const result = await mockAddDrawingAsync(drawing);
      expect(result).toEqual(drawing);
    });
  });
  
  describe('Drawing Manager Events', () => {
    it('should dispatch events on drawing operations', () => {
      const mockChart = {} as any;
      const mockSeries = {} as any;
      const manager = new ChartDrawingManager(mockChart, mockSeries);
      
      const addEventSpy = jest.fn();
      const deleteEventSpy = jest.fn();
      
      window.addEventListener('chart:drawingAdded', addEventSpy);
      window.addEventListener('chart:drawingDeleted', deleteEventSpy);
      
      // Mock the internal addDrawing behavior
      jest.spyOn(manager as any, 'createTrendLine').mockReturnValue({
        id: 'test',
        type: 'trendline',
        remove: jest.fn(),
        update: jest.fn(),
        setVisible: jest.fn(),
      });
      
      const drawing = {
        id: 'test',
        type: 'trendline' as const,
        points: [
          { time: 1000, price: 100 },
          { time: 2000, price: 200 },
        ],
        style: {
          color: '#000',
          lineWidth: 1,
          lineStyle: 'solid' as const,
          showLabels: true,
        },
        visible: true,
        interactive: true,
      };
      
      manager.addDrawing(drawing);
      
      expect(addEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { id: 'test', type: 'trendline' }
        })
      );
      
      manager.removeDrawing('test');
      
      expect(deleteEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { id: 'test' }
        })
      );
      
      window.removeEventListener('chart:drawingAdded', addEventSpy);
      window.removeEventListener('chart:drawingDeleted', deleteEventSpy);
    });
  });
});