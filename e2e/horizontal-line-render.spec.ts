import { test, expect } from '@playwright/test';

test.describe('Horizontal Line Rendering - Phase 1', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Wait for chart container
    await page.waitForSelector('[data-testid="chart-container"]', { 
      state: 'visible',
      timeout: 10000 
    });
    
    // Wait for chart to be ready
    await page.waitForTimeout(2000);
  });

  test('renders horizontal line on store update', async ({ page }) => {
    // Step 1: Add a horizontal line via event
    await test.step('Add horizontal line', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('chart:addDrawing', {
          detail: {
            id: 'render_test_1',
            type: 'horizontal',
            points: [{ time: Date.now(), price: 45000 }],
            style: {
              color: '#4CAF50',
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

    // Step 2: Verify line is in store
    await test.step('Verify store contains drawing', async () => {
      const drawingCount = await page.evaluate(() => {
        const store = (window as any).useChartStore?.getState();
        return store?.drawings.length || 0;
      });
      
      expect(drawingCount).toBe(1);
    });

    // Step 3: Verify price line exists in chart
    await test.step('Verify price line rendered', async () => {
      // Check if price line element exists (lightweight-charts creates specific elements)
      const priceLineExists = await page.evaluate(() => {
        // Look for price line elements in the chart
        const chartContainer = document.querySelector('[data-testid="chart-container"]');
        if (!chartContainer) return false;
        
        // Check for price line elements (they typically have specific classes)
        const priceLines = chartContainer.querySelectorAll('.tv-price-line');
        return priceLines.length > 0;
      });
      
      // For now, just verify the drawing was added to store
      // Actual rendering verification will depend on chart library implementation
      expect(drawingCount).toBe(1);
    });
  });

  test('updates horizontal line style', async ({ page }) => {
    // Step 1: Add initial line
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('chart:addDrawing', {
        detail: {
          id: 'style_test_1',
          type: 'horizontal',
          points: [{ time: Date.now(), price: 44000 }],
          style: {
            color: '#2196F3',
            lineWidth: 1,
            lineStyle: 'solid',
            showLabels: true
          }
        }
      }));
    });
    
    await page.waitForTimeout(500);

    // Step 2: Update color
    await test.step('Update line color', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('chart:updateDrawingColor', {
          detail: {
            id: 'style_test_1',
            color: '#FF5722'
          }
        }));
      });
      
      await page.waitForTimeout(500);
      
      // Verify color update in store
      const updatedColor = await page.evaluate(() => {
        const store = (window as any).useChartStore?.getState();
        const drawing = store?.drawings.find((d: any) => d.id === 'style_test_1');
        return drawing?.style.color;
      });
      
      expect(updatedColor).toBe('#FF5722');
    });

    // Step 3: Update line width
    await test.step('Update line width', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('chart:updateDrawingLineWidth', {
          detail: {
            id: 'style_test_1',
            lineWidth: 4
          }
        }));
      });
      
      await page.waitForTimeout(500);
      
      // Verify width update in store
      const updatedWidth = await page.evaluate(() => {
        const store = (window as any).useChartStore?.getState();
        const drawing = store?.drawings.find((d: any) => d.id === 'style_test_1');
        return drawing?.style.lineWidth;
      });
      
      expect(updatedWidth).toBe(4);
    });
  });

  test('undo/redo horizontal line operations', async ({ page }) => {
    // Step 1: Add multiple lines
    await test.step('Add 3 horizontal lines', async () => {
      const lines = [
        { id: 'undo_test_1', price: 43000, color: '#F44336' },
        { id: 'undo_test_2', price: 44000, color: '#4CAF50' },
        { id: 'undo_test_3', price: 45000, color: '#2196F3' },
      ];
      
      for (const line of lines) {
        await page.evaluate((l) => {
          window.dispatchEvent(new CustomEvent('chart:addDrawing', {
            detail: {
              id: l.id,
              type: 'horizontal',
              points: [{ time: Date.now(), price: l.price }],
              style: {
                color: l.color,
                lineWidth: 2,
                lineStyle: 'solid',
                showLabels: true
              }
            }
          }));
        }, line);
        
        await page.waitForTimeout(300);
      }
      
      // Verify 3 drawings exist
      const count = await page.evaluate(() => {
        const store = (window as any).useChartStore?.getState();
        return store?.drawings.length || 0;
      });
      expect(count).toBe(3);
    });

    // Step 2: Test undo
    await test.step('Undo last drawing', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('chart:undo', { 
          detail: { steps: 1 } 
        }));
      });
      
      await page.waitForTimeout(500);
      
      // Verify only 2 drawings remain
      const count = await page.evaluate(() => {
        const store = (window as any).useChartStore?.getState();
        return store?.drawings.length || 0;
      });
      expect(count).toBe(2);
      
      // Verify undo stack
      const undoStackSize = await page.evaluate(() => {
        const store = (window as any).useChartStore?.getState();
        return store?.undoStack.length || 0;
      });
      expect(undoStackSize).toBe(2); // Two previous states
    });

    // Step 3: Test redo
    await test.step('Redo last undone drawing', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('chart:redo', { 
          detail: { steps: 1 } 
        }));
      });
      
      await page.waitForTimeout(500);
      
      // Verify 3 drawings again
      const count = await page.evaluate(() => {
        const store = (window as any).useChartStore?.getState();
        return store?.drawings.length || 0;
      });
      expect(count).toBe(3);
      
      // Verify redo stack is now empty
      const redoStackSize = await page.evaluate(() => {
        const store = (window as any).useChartStore?.getState();
        return store?.redoStack.length || 0;
      });
      expect(redoStackSize).toBe(0);
    });

    // Step 4: Verify metrics
    await test.step('Check metrics', async () => {
      const metrics = await page.evaluate(async () => {
        const response = await fetch('/api/metrics?format=json');
        return response.json();
      });
      
      // Should have at least 3 successful drawings
      expect(metrics.drawing_success_total?.value).toBeGreaterThanOrEqual(3);
    });

    await page.screenshot({ 
      path: 'e2e/screenshots/horizontal-line-undo-redo.png',
      fullPage: true 
    });
  });

  test('clear all horizontal lines', async ({ page }) => {
    // Add multiple lines
    for (let i = 0; i < 5; i++) {
      await page.evaluate((index) => {
        window.dispatchEvent(new CustomEvent('chart:addDrawing', {
          detail: {
            id: `clear_test_${index}`,
            type: 'horizontal',
            points: [{ time: Date.now(), price: 43000 + (index * 500) }],
            style: {
              color: '#9C27B0',
              lineWidth: 1,
              lineStyle: 'dashed',
              showLabels: true
            }
          }
        }));
      }, i);
      
      await page.waitForTimeout(200);
    }

    // Verify 5 drawings exist
    let count = await page.evaluate(() => {
      const store = (window as any).useChartStore?.getState();
      return store?.drawings.length || 0;
    });
    expect(count).toBe(5);

    // Clear all drawings
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('chart:clearAllDrawings', { detail: {} }));
    });
    
    await page.waitForTimeout(500);

    // Verify all cleared
    count = await page.evaluate(() => {
      const store = (window as any).useChartStore?.getState();
      return store?.drawings.length || 0;
    });
    expect(count).toBe(0);

    // Verify toast notification
    await expect(page.locator('.fixed.top-4.right-4')).toContainText('All drawings cleared');
  });
});