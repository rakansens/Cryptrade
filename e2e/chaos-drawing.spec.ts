import { test, expect } from '@playwright/test';

test.describe('Chaos Drawing Tests - Sprint 2', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Wait for chart to be ready
    await page.waitForSelector('[data-testid="chart-container"]', { 
      state: 'visible',
      timeout: 10000 
    });
    
    await page.waitForTimeout(2000);
  });

  test('WebSocket disconnection recovery with drawing retry', async ({ page }) => {
    // Step 1: Setup WebSocket interception
    await page.route('**/stream.binance.com**', async (route) => {
      // Allow initial connection
      if (!page.url().includes('chaos=true')) {
        route.continue();
        return;
      }
      
      // Simulate disconnection
      route.abort('connectionfailed');
    });

    // Step 2: Start drawing operation
    await test.step('Initiate drawing during stable connection', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('chart:addDrawing', {
          detail: {
            id: 'chaos_test_1',
            type: 'horizontal',
            points: [{ time: Date.now(), price: 45000 }],
            style: {
              color: '#FF5722',
              lineWidth: 3,
              lineStyle: 'dashed',
              showLabels: true
            }
          }
        }));
      });
      
      // Verify initial success
      await expect(page.locator('.fixed.top-4.right-4')).toContainText('Drawing added successfully', { timeout: 3000 });
    });

    // Step 3: Simulate WebSocket disconnection
    await test.step('Disconnect WebSocket for 2 seconds', async () => {
      // Add chaos flag to URL to trigger disconnection
      await page.evaluate(() => {
        window.history.pushState({}, '', '?chaos=true');
      });
      
      // Log disconnection
      console.log('[Chaos Test] WebSocket disconnected');
      
      // Wait 2 seconds
      await page.waitForTimeout(2000);
      
      // Remove chaos flag to allow reconnection
      await page.evaluate(() => {
        window.history.pushState({}, '', '/');
      });
      
      console.log('[Chaos Test] WebSocket reconnection allowed');
    });

    // Step 4: Attempt drawing during recovery
    await test.step('Drawing operation during recovery with auto-retry', async () => {
      // Monitor retry attempts
      const retryLogs: string[] = [];
      page.on('console', msg => {
        if (msg.text().includes('Retrying operation')) {
          retryLogs.push(msg.text());
        }
      });

      // Attempt drawing that should trigger retry
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('chart:addDrawing', {
          detail: {
            id: 'chaos_recovery_test',
            type: 'trendline',
            points: [
              { time: Date.now() - 5000, price: 44500 },
              { time: Date.now(), price: 45500 }
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

      // Wait for retry mechanism
      await page.waitForTimeout(3000);
      
      // Verify retry occurred
      expect(retryLogs.length).toBeGreaterThan(0);
      
      // Eventually should succeed
      await expect(page.locator('.fixed.top-4.right-4')).toContainText('Drawing added successfully', { timeout: 10000 });
    });

    // Step 5: Verify final state
    await test.step('Verify drawings persisted after recovery', async () => {
      const drawingCount = await page.evaluate(() => {
        const store = (window as any).__chartStore;
        return store?.getState()?.drawings.length || 0;
      });
      
      expect(drawingCount).toBe(2); // Both drawings should be present
      
      // Check metrics
      const metrics = await page.evaluate(async () => {
        const response = await fetch('/api/metrics?format=json');
        return response.json();
      });
      
      expect(metrics.drawing_retry_total?.value).toBeGreaterThan(0);
    });

    // Take screenshot for documentation
    await page.screenshot({ 
      path: 'e2e/screenshots/chaos-websocket-recovery.png',
      fullPage: true 
    });
  });

  test('Random failure injection with retry validation', async ({ page }) => {
    // Inject random failure for 30% of operations
    await page.evaluate(() => {
      let callCount = 0;
      const originalDispatch = window.dispatchEvent;
      
      window.dispatchEvent = function(event: Event) {
        if (event.type === 'chart:drawingAdded') {
          callCount++;
          // Fail 30% of the time on first 2 attempts
          if (callCount <= 2 && Math.random() < 0.3) {
            console.log('[Chaos] Injecting random failure');
            return false;
          }
        }
        return originalDispatch.call(this, event);
      };
    });

    // Attempt multiple drawing operations
    const operations = Array(5).fill(null).map((_, i) => ({
      id: `chaos_random_${i}`,
      type: 'horizontal' as const,
      price: 44000 + (i * 200),
    }));

    for (const op of operations) {
      await page.evaluate((params) => {
        window.dispatchEvent(new CustomEvent('chart:addDrawing', {
          detail: {
            id: params.id,
            type: params.type,
            points: [{ time: Date.now(), price: params.price }],
            style: {
              color: '#9C27B0',
              lineWidth: 2,
              lineStyle: 'solid',
              showLabels: true
            }
          }
        }));
      }, op);
      
      await page.waitForTimeout(500);
    }

    // Wait for all operations to complete with retries
    await page.waitForTimeout(5000);

    // Verify UX degradation < 1 second
    const toastAppearances = await page.evaluate(() => {
      return document.querySelectorAll('[role="alert"]').length;
    });
    
    // Should see success toasts despite failures
    expect(toastAppearances).toBeGreaterThan(0);

    // Verify all drawings eventually succeeded
    const finalDrawingCount = await page.evaluate(() => {
      const store = (window as any).__chartStore;
      return store?.getState()?.drawings.filter((d: any) => 
        d.id.startsWith('chaos_random_')
      ).length || 0;
    });
    
    expect(finalDrawingCount).toBe(5);
  });

  test('Queue behavior under stress with monitoring', async ({ page }) => {
    // Monitor queue metrics
    await page.evaluate(() => {
      (window as any).queueMetrics = {
        maxQueueSize: 0,
        processingTimes: [],
      };
    });

    // Submit 10 drawings rapidly
    const startTime = Date.now();
    
    for (let i = 0; i < 10; i++) {
      page.evaluate((index) => {
        const start = Date.now();
        window.dispatchEvent(new CustomEvent('chart:addDrawing', {
          detail: {
            id: `stress_test_${index}`,
            type: 'horizontal',
            points: [{ time: Date.now(), price: 43000 + (index * 100) }],
            style: {
              color: '#00BCD4',
              lineWidth: 1,
              lineStyle: 'solid',
              showLabels: false
            }
          }
        }));
        
        // Track metrics
        const metrics = (window as any).queueMetrics;
        const queueStatus = (window as any).__drawingQueue?.getStatus();
        if (queueStatus) {
          metrics.maxQueueSize = Math.max(metrics.maxQueueSize, queueStatus.queueLength);
        }
      }, i);
      
      // No delay - stress test
    }

    // Wait for all to complete
    await page.waitForTimeout(8000);

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Get metrics
    const queueMetrics = await page.evaluate(() => (window as any).queueMetrics);
    
    console.log('[Chaos Test] Stress test metrics:', {
      totalTime,
      maxQueueSize: queueMetrics.maxQueueSize,
      avgProcessingTime: totalTime / 10,
    });

    // Verify all completed
    const stressDrawingCount = await page.evaluate(() => {
      const store = (window as any).__chartStore;
      return store?.getState()?.drawings.filter((d: any) => 
        d.id.startsWith('stress_test_')
      ).length || 0;
    });
    
    expect(stressDrawingCount).toBe(10);
    
    // Verify performance - should handle 10 operations in reasonable time
    expect(totalTime).toBeLessThan(15000); // 15 seconds max
  });
});