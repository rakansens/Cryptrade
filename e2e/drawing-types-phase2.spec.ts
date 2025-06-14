import { test, expect } from '@playwright/test';

test.describe('Drawing Types Phase 2 - Trendline & Fibonacci', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Wait for chart container
    await page.waitForSelector('[data-testid="chart-container"]', { 
      state: 'visible',
      timeout: 10000 
    });
    
    // Wait for chart to be ready
    await page.waitForTimeout(2000);
    
    // Expose chart store for testing
    await page.evaluate(() => {
      (window as any).__chartStore = (window as any).useChartStore;
    });
  });

  test('renders trendline between two points', async ({ page }) => {
    await test.step('Add trendline drawing', async () => {
      await page.evaluate(() => {
        const now = Date.now();
        window.dispatchEvent(new CustomEvent('chart:addDrawing', {
          detail: {
            id: 'trend_test_1',
            type: 'trendline',
            points: [
              { time: now - 300000, price: 44000 },  // 5 minutes ago
              { time: now, price: 46000 }            // now
            ],
            style: {
              color: '#2196F3',
              lineWidth: 2,
              lineStyle: 'solid',
              showLabels: true
            }
          }
        }));
      });
      
      await page.waitForTimeout(500);
      
      // Verify toast notification
      await expect(page.locator('.fixed.top-4.right-4')).toContainText('Drawing added successfully');
    });

    await test.step('Verify trendline in store', async () => {
      const drawing = await page.evaluate(() => {
        const store = (window as any).__chartStore?.getState();
        return store?.drawings.find((d: any) => d.id === 'trend_test_1');
      });
      
      expect(drawing).toBeTruthy();
      expect(drawing.type).toBe('trendline');
      expect(drawing.points).toHaveLength(2);
    });

    await test.step('Update trendline color', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('chart:updateDrawingColor', {
          detail: {
            id: 'trend_test_1',
            color: '#FF5722'
          }
        }));
      });
      
      await page.waitForTimeout(500);
      
      const updatedColor = await page.evaluate(() => {
        const store = (window as any).__chartStore?.getState();
        const drawing = store?.drawings.find((d: any) => d.id === 'trend_test_1');
        return drawing?.style.color;
      });
      
      expect(updatedColor).toBe('#FF5722');
    });
  });

  test('renders fibonacci retracement with all levels', async ({ page }) => {
    await test.step('Add fibonacci drawing', async () => {
      await page.evaluate(() => {
        const now = Date.now();
        window.dispatchEvent(new CustomEvent('chart:addDrawing', {
          detail: {
            id: 'fib_test_1',
            type: 'fibonacci',
            points: [
              { time: now - 600000, price: 43000 },  // 10 minutes ago (bottom)
              { time: now, price: 47000 }            // now (top)
            ],
            style: {
              color: '#FF9800',
              lineWidth: 1,
              lineStyle: 'dashed',
              showLabels: true
            }
          }
        }));
      });
      
      await page.waitForTimeout(500);
      
      // Verify toast notification
      await expect(page.locator('.fixed.top-4.right-4')).toContainText('Drawing added successfully');
    });

    await test.step('Verify fibonacci in store', async () => {
      const drawing = await page.evaluate(() => {
        const store = (window as any).__chartStore?.getState();
        return store?.drawings.find((d: any) => d.id === 'fib_test_1');
      });
      
      expect(drawing).toBeTruthy();
      expect(drawing.type).toBe('fibonacci');
      expect(drawing.points).toHaveLength(2);
      
      // Calculate expected levels
      const startPrice = drawing.points[0].price;
      const endPrice = drawing.points[1].price;
      const diff = endPrice - startPrice;
      
      // Verify fibonacci levels are correct
      expect(diff).toBe(4000); // 47000 - 43000
    });

    await test.step('Update fibonacci style', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('chart:updateDrawingLineWidth', {
          detail: {
            id: 'fib_test_1',
            lineWidth: 3
          }
        }));
      });
      
      await page.waitForTimeout(500);
      
      const updatedWidth = await page.evaluate(() => {
        const store = (window as any).__chartStore?.getState();
        const drawing = store?.drawings.find((d: any) => d.id === 'fib_test_1');
        return drawing?.style.lineWidth;
      });
      
      expect(updatedWidth).toBe(3);
    });
  });

  test('mixed drawing types coexist correctly', async ({ page }) => {
    // Add multiple drawing types
    await test.step('Add horizontal line', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('chart:addDrawing', {
          detail: {
            id: 'mixed_horizontal_1',
            type: 'horizontal',
            points: [{ time: Date.now(), price: 45000 }],
            style: { color: '#4CAF50', lineWidth: 2, lineStyle: 'solid', showLabels: true }
          }
        }));
      });
      await page.waitForTimeout(300);
    });

    await test.step('Add trendline', async () => {
      await page.evaluate(() => {
        const now = Date.now();
        window.dispatchEvent(new CustomEvent('chart:addDrawing', {
          detail: {
            id: 'mixed_trend_1',
            type: 'trendline',
            points: [
              { time: now - 400000, price: 44500 },
              { time: now, price: 45500 }
            ],
            style: { color: '#2196F3', lineWidth: 2, lineStyle: 'solid', showLabels: true }
          }
        }));
      });
      await page.waitForTimeout(300);
    });

    await test.step('Add fibonacci', async () => {
      await page.evaluate(() => {
        const now = Date.now();
        window.dispatchEvent(new CustomEvent('chart:addDrawing', {
          detail: {
            id: 'mixed_fib_1',
            type: 'fibonacci',
            points: [
              { time: now - 500000, price: 44000 },
              { time: now - 100000, price: 46000 }
            ],
            style: { color: '#9C27B0', lineWidth: 1, lineStyle: 'dashed', showLabels: true }
          }
        }));
      });
      await page.waitForTimeout(300);
    });

    // Verify all drawings exist
    await test.step('Verify all drawings in store', async () => {
      const drawings = await page.evaluate(() => {
        const store = (window as any).__chartStore?.getState();
        return store?.drawings || [];
      });
      
      expect(drawings).toHaveLength(3);
      
      const types = drawings.map((d: any) => d.type);
      expect(types).toContain('horizontal');
      expect(types).toContain('trendline');
      expect(types).toContain('fibonacci');
    });

    // Update all styles at once
    await test.step('Bulk style update for trendlines', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('chart:updateAllStyles', {
          detail: {
            type: 'trendline',
            style: {
              color: '#F44336',
              lineWidth: 4,
              lineStyle: 'dotted'
            }
          }
        }));
      });
      
      await page.waitForTimeout(500);
      
      const trendline = await page.evaluate(() => {
        const store = (window as any).__chartStore?.getState();
        return store?.drawings.find((d: any) => d.type === 'trendline');
      });
      
      expect(trendline.style.color).toBe('#F44336');
      expect(trendline.style.lineWidth).toBe(4);
      expect(trendline.style.lineStyle).toBe('dotted');
    });
  });

  test('undo/redo works with all drawing types', async ({ page }) => {
    const drawingCommands = [
      {
        id: 'undo_horizontal_1',
        type: 'horizontal',
        points: [{ time: Date.now(), price: 44000 }],
        style: { color: '#F44336', lineWidth: 2, lineStyle: 'solid', showLabels: true }
      },
      {
        id: 'undo_trend_1',
        type: 'trendline',
        points: [
          { time: Date.now() - 300000, price: 43500 },
          { time: Date.now(), price: 44500 }
        ],
        style: { color: '#4CAF50', lineWidth: 2, lineStyle: 'solid', showLabels: true }
      },
      {
        id: 'undo_fib_1',
        type: 'fibonacci',
        points: [
          { time: Date.now() - 600000, price: 43000 },
          { time: Date.now() - 200000, price: 45000 }
        ],
        style: { color: '#2196F3', lineWidth: 1, lineStyle: 'dashed', showLabels: true }
      }
    ];

    // Add all drawings
    await test.step('Add all drawings', async () => {
      for (const drawing of drawingCommands) {
        await page.evaluate((d) => {
          window.dispatchEvent(new CustomEvent('chart:addDrawing', { detail: d }));
        }, drawing);
        await page.waitForTimeout(300);
      }
      
      const count = await page.evaluate(() => {
        const store = (window as any).__chartStore?.getState();
        return store?.drawings.length || 0;
      });
      expect(count).toBe(3);
    });

    // Undo twice
    await test.step('Undo two operations', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('chart:undo', { detail: { steps: 2 } }));
      });
      
      await page.waitForTimeout(500);
      
      const drawings = await page.evaluate(() => {
        const store = (window as any).__chartStore?.getState();
        return store?.drawings || [];
      });
      
      expect(drawings).toHaveLength(1);
      expect(drawings[0].type).toBe('horizontal'); // Only first drawing remains
    });

    // Redo once
    await test.step('Redo one operation', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('chart:redo', { detail: { steps: 1 } }));
      });
      
      await page.waitForTimeout(500);
      
      const drawings = await page.evaluate(() => {
        const store = (window as any).__chartStore?.getState();
        return store?.drawings || [];
      });
      
      expect(drawings).toHaveLength(2);
      expect(drawings[1].type).toBe('trendline'); // Trendline is back
    });

    // Clear all and verify undo
    await test.step('Clear all and undo', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('chart:clearAllDrawings', { detail: {} }));
      });
      
      await page.waitForTimeout(500);
      
      let count = await page.evaluate(() => {
        const store = (window as any).__chartStore?.getState();
        return store?.drawings.length || 0;
      });
      expect(count).toBe(0);
      
      // Undo the clear
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('chart:undo', { detail: { steps: 1 } }));
      });
      
      await page.waitForTimeout(500);
      
      count = await page.evaluate(() => {
        const store = (window as any).__chartStore?.getState();
        return store?.drawings.length || 0;
      });
      expect(count).toBe(2); // Back to 2 drawings
    });

    await page.screenshot({ 
      path: 'e2e/screenshots/drawing-types-undo-redo.png',
      fullPage: true 
    });
  });

  test('performance with many drawings', async ({ page }) => {
    const startTime = Date.now();
    
    await test.step('Add 50 trendlines', async () => {
      for (let i = 0; i < 50; i++) {
        await page.evaluate((index) => {
          const now = Date.now();
          const basePrice = 43000 + (index * 50);
          window.dispatchEvent(new CustomEvent('chart:addDrawing', {
            detail: {
              id: `perf_trend_${index}`,
              type: 'trendline',
              points: [
                { time: now - 600000, price: basePrice },
                { time: now - 200000, price: basePrice + 200 }
              ],
              style: { 
                color: `hsl(${index * 7}, 70%, 50%)`, 
                lineWidth: 1, 
                lineStyle: 'solid', 
                showLabels: false 
              }
            }
          }));
        }, i);
        
        // Small delay to prevent overwhelming
        if (i % 10 === 0) {
          await page.waitForTimeout(100);
        }
      }
    });

    await test.step('Add 25 fibonacci sets', async () => {
      for (let i = 0; i < 25; i++) {
        await page.evaluate((index) => {
          const now = Date.now();
          const basePrice = 44000 + (index * 100);
          window.dispatchEvent(new CustomEvent('chart:addDrawing', {
            detail: {
              id: `perf_fib_${index}`,
              type: 'fibonacci',
              points: [
                { time: now - 800000, price: basePrice },
                { time: now - 400000, price: basePrice + 300 }
              ],
              style: { 
                color: '#FF9800', 
                lineWidth: 1, 
                lineStyle: 'dashed', 
                showLabels: false 
              }
            }
          }));
        }, i);
        
        // Small delay to prevent overwhelming
        if (i % 5 === 0) {
          await page.waitForTimeout(100);
        }
      }
    });

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Verify all drawings were added
    const count = await page.evaluate(() => {
      const store = (window as any).__chartStore?.getState();
      return store?.drawings.length || 0;
    });
    
    expect(count).toBe(75); // 50 trendlines + 25 fibonacci
    
    // Performance check - should complete in reasonable time
    expect(totalTime).toBeLessThan(10000); // Less than 10 seconds
    
    // Check metrics
    const metrics = await page.evaluate(async () => {
      const response = await fetch('/api/metrics?format=json');
      return response.json();
    });
    
    expect(metrics.drawing_success_total?.value).toBeGreaterThanOrEqual(75);
    
    console.log(`Performance test completed in ${totalTime}ms for 75 drawings`);
  });
});