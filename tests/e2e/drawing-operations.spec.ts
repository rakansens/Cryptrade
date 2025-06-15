import { test, expect } from '@playwright/test';

test.describe('Drawing Operations - Sprint 1', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');
    
    // Wait for chart to be ready
    await page.waitForSelector('[data-testid="chart-container"]', { 
      state: 'visible',
      timeout: 10000 
    });
    
    // Give chart time to fully initialize
    await page.waitForTimeout(2000);
  });

  test('trendline → undo → redraw workflow', async ({ page }) => {
    // Step 1: Draw a trendline
    await test.step('Draw initial trendline', async () => {
      // Trigger drawing mode via AI command or toolbar
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('chart:startDrawing', {
          detail: { type: 'trendline' }
        }));
      });
      
      // Wait for drawing mode
      await page.waitForFunction(() => document.body.style.cursor === 'crosshair');
      
      // Click first point
      const chartArea = await page.locator('[data-testid="chart-container"]');
      const box = await chartArea.boundingBox();
      if (!box) throw new Error('Chart container not found');
      
      await page.mouse.click(box.x + 100, box.y + 200);
      await page.waitForTimeout(500);
      
      // Click second point
      await page.mouse.click(box.x + 300, box.y + 150);
      
      // Wait for drawing to be added
      await page.waitForEvent('console', msg => 
        msg.text().includes('[Drawing Manager] Drawing added')
      );
      
      // Verify toast notification
      await expect(page.locator('.fixed.top-4.right-4')).toContainText('Drawing added successfully');
    });

    // Step 2: Undo the drawing
    await test.step('Undo the trendline', async () => {
      // Get drawing ID from store
      const drawingId = await page.evaluate(() => {
        const store = (window as any).__chartStore;
        return store?.getState()?.drawings[0]?.id;
      });
      
      expect(drawingId).toBeTruthy();
      
      // Delete the drawing
      await page.evaluate((id) => {
        window.dispatchEvent(new CustomEvent('chart:deleteDrawing', {
          detail: { id }
        }));
      }, drawingId);
      
      // Wait for deletion confirmation
      await page.waitForEvent('console', msg => 
        msg.text().includes('[Drawing Manager] Drawing removed')
      );
      
      // Verify toast
      await expect(page.locator('.fixed.top-4.right-4')).toContainText('Drawing deleted successfully');
      
      // Verify no drawings in store
      const drawingCount = await page.evaluate(() => {
        const store = (window as any).__chartStore;
        return store?.getState()?.drawings.length || 0;
      });
      expect(drawingCount).toBe(0);
    });

    // Step 3: Redraw
    await test.step('Redraw trendline', async () => {
      // Add drawing directly with coordinates
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('chart:addDrawing', {
          detail: {
            id: `trendline_${Date.now()}`,
            type: 'trendline',
            points: [
              { time: Date.now() - 1000, price: 45000 },
              { time: Date.now(), price: 46000 }
            ],
            style: {
              color: '#4CAF50',
              lineWidth: 2,
              lineStyle: 'solid',
              showLabels: true
            }
          }
        }));
      });
      
      // Wait for drawing confirmation
      await page.waitForFunction(() => {
        const toasts = document.querySelectorAll('[role="alert"]');
        return Array.from(toasts).some(t => 
          t.textContent?.includes('Drawing added successfully')
        );
      });
      
      // Verify drawing in store
      const finalDrawingCount = await page.evaluate(() => {
        const store = (window as any).__chartStore;
        return store?.getState()?.drawings.length || 0;
      });
      expect(finalDrawingCount).toBe(1);
    });

    // Take screenshot for PR
    await page.screenshot({ 
      path: 'e2e/screenshots/trendline-undo-redraw.png',
      fullPage: true 
    });
  });

  test('drawing timeout handling', async ({ page }) => {
    // Mock a scenario where confirmation never arrives
    await page.evaluate(() => {
      // Intercept the drawing manager to not dispatch confirmation
      const originalAddEventListener = window.addEventListener;
      window.addEventListener = function(type: string, listener: any) {
        if (type === 'chart:drawingAdded') {
          // Don't register the confirmation handler
          return;
        }
        return originalAddEventListener.call(this, type, listener);
      };
    });

    // Attempt to add drawing
    await page.evaluate(() => {
      const store = (window as any).__chartStore;
      if (store && store.getState().addDrawingAsync) {
        store.getState().addDrawingAsync({
          id: 'timeout-test',
          type: 'horizontal',
          points: [{ time: Date.now(), price: 45000 }],
          style: {
            color: '#F44336',
            lineWidth: 2,
            lineStyle: 'dashed',
            showLabels: true
          },
          visible: true,
          interactive: true
        }).catch(() => {
          // Expected to timeout
        });
      }
    });

    // Wait for timeout (5 seconds)
    await page.waitForTimeout(5500);

    // Verify error toast
    await expect(page.locator('.fixed.top-4.right-4')).toContainText('Drawing operation timed out');
  });

  test('multiple concurrent drawings with queue', async ({ page }) => {
    const drawingPromises = [];
    
    // Queue multiple drawings rapidly
    for (let i = 0; i < 3; i++) {
      drawingPromises.push(
        page.evaluate((index) => {
          window.dispatchEvent(new CustomEvent('chart:addDrawing', {
            detail: {
              id: `concurrent_${index}`,
              type: 'horizontal',
              points: [{ time: Date.now(), price: 45000 + (index * 100) }],
              style: {
                color: ['#2196F3', '#4CAF50', '#FF9800'][index],
                lineWidth: 2,
                lineStyle: 'solid',
                showLabels: true
              }
            }
          }));
        }, i)
      );
      
      // Small delay between submissions
      await page.waitForTimeout(100);
    }

    // Wait for all to complete
    await Promise.all(drawingPromises);
    await page.waitForTimeout(2000);

    // Verify all drawings were added sequentially
    const queueStatus = await page.evaluate(() => {
      return (window as any).__drawingQueue?.getStatus();
    });
    
    expect(queueStatus?.activeOperations).toBe(0);
    expect(queueStatus?.queueLength).toBe(0);

    // Verify 3 drawings in store
    const drawingCount = await page.evaluate(() => {
      const store = (window as any).__chartStore;
      return store?.getState()?.drawings.length || 0;
    });
    expect(drawingCount).toBe(3);
  });
});

// Helper to expose store for testing
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Expose chart store globally for tests
    if (typeof window !== 'undefined') {
      (window as any).__chartStore = null;
      (window as any).__drawingQueue = null;
      
      // Wait for store to be available
      const checkStore = setInterval(() => {
        const { useChartStore } = (window as any).chartStoreExports || {};
        const { drawingQueue } = (window as any).drawingQueueExports || {};
        
        if (useChartStore) {
          (window as any).__chartStore = useChartStore;
          clearInterval(checkStore);
        }
        if (drawingQueue) {
          (window as any).__drawingQueue = drawingQueue;
        }
      }, 100);
    }
  });
});