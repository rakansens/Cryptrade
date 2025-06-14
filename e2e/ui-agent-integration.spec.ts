import { test, expect } from '@playwright/test';

test.describe('UI-Agent Integration Tests - Sprint 3', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    await page.waitForSelector('[data-testid="chart-container"]', { 
      state: 'visible',
      timeout: 10000 
    });
    
    await page.waitForTimeout(2000);
  });

  test('undo/redo drawing operations', async ({ page }) => {
    // Step 1: Create multiple drawings
    await test.step('Create 3 drawings', async () => {
      const drawings = [
        { id: 'undo_test_1', type: 'horizontal', price: 45000, color: '#F44336' },
        { id: 'undo_test_2', type: 'horizontal', price: 45500, color: '#4CAF50' },
        { id: 'undo_test_3', type: 'horizontal', price: 46000, color: '#2196F3' },
      ];
      
      for (const drawing of drawings) {
        await page.evaluate((d) => {
          window.dispatchEvent(new CustomEvent('chart:addDrawing', {
            detail: {
              id: d.id,
              type: d.type,
              points: [{ time: Date.now(), price: d.price }],
              style: {
                color: d.color,
                lineWidth: 2,
                lineStyle: 'solid',
                showLabels: true
              }
            }
          }));
        }, drawing);
        
        await page.waitForTimeout(500);
      }
      
      // Verify 3 drawings exist
      const count = await page.evaluate(() => {
        const store = (window as any).__chartStore;
        return store?.getState()?.drawings.length || 0;
      });
      expect(count).toBe(3);
    });

    // Step 2: Test undo
    await test.step('Undo last drawing', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('chart:undoLastDrawing', { detail: {} }));
      });
      
      await page.waitForTimeout(500);
      
      // Verify only 2 drawings remain
      const count = await page.evaluate(() => {
        const store = (window as any).__chartStore;
        return store?.getState()?.drawings.length || 0;
      });
      expect(count).toBe(2);
      
      // Verify toast
      await expect(page.locator('.fixed.top-4.right-4')).toContainText('Last drawing removed');
    });

    // Step 3: Test multiple undo (when implemented)
    await test.step('Multiple undo operations', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('chart:undo', { 
          detail: { steps: 2 } 
        }));
      });
      
      await page.waitForTimeout(500);
      
      // For now, should show coming soon message
      await expect(page.locator('.fixed.top-4.right-4')).toContainText('coming soon');
    });

    await page.screenshot({ 
      path: 'e2e/screenshots/undo-redo-test.png',
      fullPage: true 
    });
  });

  test('style update operations', async ({ page }) => {
    // Step 1: Create a drawing
    const drawingId = 'style_test_1';
    
    await page.evaluate((id) => {
      window.dispatchEvent(new CustomEvent('chart:addDrawing', {
        detail: {
          id,
          type: 'trendline',
          points: [
            { time: Date.now() - 5000, price: 44000 },
            { time: Date.now(), price: 46000 }
          ],
          style: {
            color: '#2196F3',
            lineWidth: 2,
            lineStyle: 'solid',
            showLabels: true
          }
        }
      }));
    }, drawingId);
    
    await page.waitForTimeout(1000);

    // Step 2: Update color
    await test.step('Update drawing color', async () => {
      await page.evaluate((id) => {
        window.dispatchEvent(new CustomEvent('chart:updateDrawingColor', {
          detail: { id, color: '#FF5722' }
        }));
      }, drawingId);
      
      await page.waitForTimeout(500);
      
      // Verify color updated
      const updatedColor = await page.evaluate((id) => {
        const store = (window as any).__chartStore;
        const drawing = store?.getState()?.drawings.find((d: any) => d.id === id);
        return drawing?.style?.color;
      }, drawingId);
      
      expect(updatedColor).toBe('#FF5722');
      await expect(page.locator('.fixed.top-4.right-4')).toContainText('color updated');
    });

    // Step 3: Update line width
    await test.step('Update line width', async () => {
      await page.evaluate((id) => {
        window.dispatchEvent(new CustomEvent('chart:updateDrawingLineWidth', {
          detail: { id, lineWidth: 4 }
        }));
      }, drawingId);
      
      await page.waitForTimeout(500);
      
      // Verify width updated
      const updatedWidth = await page.evaluate((id) => {
        const store = (window as any).__chartStore;
        const drawing = store?.getState()?.drawings.find((d: any) => d.id === id);
        return drawing?.style?.lineWidth;
      }, drawingId);
      
      expect(updatedWidth).toBe(4);
      await expect(page.locator('.fixed.top-4.right-4')).toContainText('width updated');
    });

    // Step 4: Update complete style
    await test.step('Update complete style object', async () => {
      await page.evaluate((id) => {
        window.dispatchEvent(new CustomEvent('chart:updateDrawingStyle', {
          detail: { 
            id, 
            style: {
              color: '#9C27B0',
              lineWidth: 3,
              lineStyle: 'dashed',
              showLabels: false
            }
          }
        }));
      }, drawingId);
      
      await page.waitForTimeout(500);
      
      // Verify all style properties updated
      const updatedStyle = await page.evaluate((id) => {
        const store = (window as any).__chartStore;
        const drawing = store?.getState()?.drawings.find((d: any) => d.id === id);
        return drawing?.style;
      }, drawingId);
      
      expect(updatedStyle).toMatchObject({
        color: '#9C27B0',
        lineWidth: 3,
        lineStyle: 'dashed',
        showLabels: false
      });
    });

    await page.screenshot({ 
      path: 'e2e/screenshots/style-update-test.png',
      fullPage: true 
    });
  });

  test('bulk style updates', async ({ page }) => {
    // Create multiple drawings of same type
    const horizontalDrawings = [
      { id: 'bulk_1', price: 44000 },
      { id: 'bulk_2', price: 44500 },
      { id: 'bulk_3', price: 45000 },
    ];
    
    for (const drawing of horizontalDrawings) {
      await page.evaluate((d) => {
        window.dispatchEvent(new CustomEvent('chart:addDrawing', {
          detail: {
            id: d.id,
            type: 'horizontal',
            points: [{ time: Date.now(), price: d.price }],
            style: {
              color: '#2196F3',
              lineWidth: 1,
              lineStyle: 'solid',
              showLabels: true
            }
          }
        }));
      }, drawing);
      
      await page.waitForTimeout(300);
    }

    // Update all horizontal lines at once
    await test.step('Update all horizontal drawings', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('chart:updateAllStyles', {
          detail: {
            type: 'horizontal',
            style: {
              color: '#4CAF50',
              lineWidth: 3,
              lineStyle: 'dashed'
            }
          }
        }));
      });
      
      await page.waitForTimeout(1000);
      
      // Verify all updated
      const updatedDrawings = await page.evaluate(() => {
        const store = (window as any).__chartStore;
        return store?.getState()?.drawings
          .filter((d: any) => d.type === 'horizontal')
          .map((d: any) => ({ id: d.id, style: d.style }));
      });
      
      expect(updatedDrawings).toHaveLength(3);
      updatedDrawings.forEach((drawing: any) => {
        expect(drawing.style.color).toBe('#4CAF50');
        expect(drawing.style.lineWidth).toBe(3);
        expect(drawing.style.lineStyle).toBe('dashed');
      });
      
      await expect(page.locator('.fixed.top-4.right-4')).toContainText('Updated 3 horizontal drawings');
    });

    await page.screenshot({ 
      path: 'e2e/screenshots/bulk-style-update-test.png',
      fullPage: true 
    });
  });
});