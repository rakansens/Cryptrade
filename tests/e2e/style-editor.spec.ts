import { test, expect } from '@playwright/test'

test.describe('Style Editor E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/')
    
    // Wait for chart to load
    await page.waitForSelector('#chart-container', { timeout: 10000 })
    
    // Wait for initial data load
    await page.waitForTimeout(2000)
  })

  test('can edit drawing style from proposal card', async ({ page }) => {
    // Create a drawing proposal first
    await page.click('[data-testid="chat-input"]')
    await page.fill('[data-testid="chat-input"]', 'Draw a trendline on the chart')
    await page.press('[data-testid="chat-input"]', 'Enter')
    
    // Wait for AI response with proposal
    await page.waitForSelector('[data-testid="proposal-card"]', { timeout: 15000 })
    
    // Approve the proposal
    await page.click('[data-testid="approve-proposal"]')
    
    // Wait for drawing to appear
    await page.waitForTimeout(1000)
    
    // Style editor should now be visible
    await page.hover('[data-testid="proposal-item-approved"]')
    const styleButton = await page.waitForSelector('text=スタイル', { state: 'visible' })
    
    // Click style editor button
    await styleButton.click()
    
    // Style editor popover should open
    await expect(page.locator('[data-testid="popover-content"]')).toBeVisible()
    
    // Change color
    const colorInput = await page.locator('input[placeholder="#22c55e"]')
    await colorInput.fill('#3b82f6')
    
    // Verify color changed on chart
    await page.waitForTimeout(500)
    
    // Check console for style update event
    const consoleMessages: string[] = []
    page.on('console', msg => {
      if (msg.text().includes('[Agent Event] Handling chart:updateDrawingStyle')) {
        consoleMessages.push(msg.text())
      }
    })
    
    // Change line width
    const lineWidthSlider = await page.locator('input[type="range"]').first()
    await lineWidthSlider.fill('5')
    
    // Wait for update
    await page.waitForTimeout(500)
    
    // Verify console messages
    expect(consoleMessages.length).toBeGreaterThan(0)
  })

  test('can apply style presets', async ({ page }) => {
    // Create a drawing first
    await page.evaluate(() => {
      // Dispatch a test drawing event
      const event = new CustomEvent('chart:addDrawing', {
        detail: {
          id: 'test-drawing-e2e',
          type: 'trendline',
          points: [
            { time: Date.now() / 1000 - 3600, value: 45000 },
            { time: Date.now() / 1000, value: 46000 }
          ],
          style: {
            color: '#22c55e',
            lineWidth: 2,
            lineStyle: 'solid',
            showLabels: true
          }
        }
      })
      window.dispatchEvent(event)
    })
    
    // Create a mock approved proposal with the drawing
    await page.evaluate(() => {
      // Mock an approved proposal in the UI
      const proposalEvent = new CustomEvent('test:mockApprovedProposal', {
        detail: {
          drawingId: 'test-drawing-e2e',
          proposalId: 'test-proposal-e2e'
        }
      })
      window.dispatchEvent(proposalEvent)
    })
    
    // Wait for drawing
    await page.waitForTimeout(1000)
    
    // Open style editor
    await page.hover('[data-testid="proposal-item-approved"]')
    await page.click('text=スタイル')
    
    // Switch to presets tab
    await page.click('[data-testid="tab-presets"]')
    
    // Apply professional preset
    await page.click('text=プロフェッショナル')
    
    // Verify toast message
    await expect(page.locator('text=プリセット「プロフェッショナル」を適用しました')).toBeVisible()
    
    // Verify style changed
    await page.waitForTimeout(500)
  })

  test('can edit pattern-specific styles', async ({ page }) => {
    // Create a pattern
    await page.evaluate(() => {
      // Add pattern to store
      const patternEvent = new CustomEvent('chart:addPattern', {
        detail: {
          id: 'test-pattern-e2e',
          pattern: {
            type: 'head_and_shoulders',
            visualization: {
              keyPoints: [
                { time: Date.now() / 1000 - 7200, value: 44000 },
                { time: Date.now() / 1000 - 3600, value: 46000 },
                { time: Date.now() / 1000, value: 44500 }
              ],
              lines: [],
              markers: []
            },
            metrics: {
              target_level: 42000,
              stop_loss: 47000,
              breakout_level: 44000
            }
          }
        }
      })
      window.dispatchEvent(patternEvent)
    })
    
    // Wait for pattern to render
    await page.waitForTimeout(1000)
    
    // Mock approved pattern proposal
    await page.evaluate(() => {
      const proposalEvent = new CustomEvent('test:mockApprovedPatternProposal', {
        detail: {
          drawingId: 'test-pattern-e2e',
          proposalId: 'test-pattern-proposal-e2e',
          isPattern: true
        }
      })
      window.dispatchEvent(proposalEvent)
    })
    
    // Open style editor
    await page.hover('[data-testid="proposal-item-approved"]')
    await page.click('text=スタイル')
    
    // Switch to pattern tab
    await page.click('[data-testid="tab-pattern"]')
    
    // Change pattern fill opacity
    const opacitySlider = await page.locator('input[type="range"]').nth(1)
    await opacitySlider.fill('0.5')
    
    // Toggle metric labels
    const metricLabelsToggle = await page.locator('text=メトリクスラベルを表示').locator('..').locator('button')
    await metricLabelsToggle.click()
    
    // Verify updates
    await page.waitForTimeout(500)
    
    // Check for pattern style update event
    const patternUpdateReceived = await page.evaluate(() => {
      return new Promise(resolve => {
        window.addEventListener('chart:updatePatternStyle', (event: any) => {
          resolve(event.detail)
        })
        
        // Timeout after 2 seconds
        setTimeout(() => resolve(null), 2000)
      })
    })
    
    expect(patternUpdateReceived).toBeTruthy()
  })

  test('validates color input', async ({ page }) => {
    // Create a simple drawing
    await page.evaluate(() => {
      const event = new CustomEvent('chart:addDrawing', {
        detail: {
          id: 'test-validation-e2e',
          type: 'horizontal',
          points: [{ time: Date.now() / 1000, value: 45000 }],
          price: 45000,
          style: { color: '#22c55e', lineWidth: 2, lineStyle: 'solid', showLabels: true }
        }
      })
      window.dispatchEvent(event)
    })
    
    await page.waitForTimeout(1000)
    
    // Open style editor
    await page.hover('[data-testid="proposal-item-approved"]')
    await page.click('text=スタイル')
    
    // Try invalid color
    const colorInput = await page.locator('input[placeholder="#22c55e"]')
    await colorInput.fill('not-a-color')
    
    // Should not trigger update event
    const updateEventFired = await page.evaluate(() => {
      return new Promise(resolve => {
        let fired = false
        window.addEventListener('chart:updateDrawingStyle', () => {
          fired = true
        })
        setTimeout(() => resolve(fired), 1000)
      })
    })
    
    expect(updateEventFired).toBe(false)
    
    // Try valid color
    await colorInput.fill('#ff0000')
    
    // Should trigger update event
    const validUpdateFired = await page.evaluate(() => {
      return new Promise(resolve => {
        window.addEventListener('chart:updateDrawingStyle', (event: any) => {
          resolve(event.detail.style.color === '#ff0000')
        })
        setTimeout(() => resolve(false), 1000)
      })
    })
    
    expect(validUpdateFired).toBe(true)
  })

  test('handles real-time style updates', async ({ page }) => {
    // Create multiple drawings
    await page.evaluate(() => {
      // Create trendline
      const trendlineEvent = new CustomEvent('chart:addDrawing', {
        detail: {
          id: 'realtime-trendline',
          type: 'trendline',
          points: [
            { time: Date.now() / 1000 - 3600, value: 44000 },
            { time: Date.now() / 1000, value: 46000 }
          ],
          style: { color: '#22c55e', lineWidth: 2, lineStyle: 'solid', showLabels: true }
        }
      })
      window.dispatchEvent(trendlineEvent)
      
      // Create horizontal line
      const horizontalEvent = new CustomEvent('chart:addDrawing', {
        detail: {
          id: 'realtime-horizontal',
          type: 'horizontal',
          points: [{ time: Date.now() / 1000, value: 45000 }],
          price: 45000,
          style: { color: '#3b82f6', lineWidth: 1, lineStyle: 'dashed', showLabels: false }
        }
      })
      window.dispatchEvent(horizontalEvent)
    })
    
    await page.waitForTimeout(1000)
    
    // Update first drawing style
    await page.evaluate(() => {
      const updateEvent = new CustomEvent('chart:updateDrawingStyle', {
        detail: {
          drawingId: 'realtime-trendline',
          style: { color: '#ef4444', lineWidth: 4 },
          immediate: true
        }
      })
      window.dispatchEvent(updateEvent)
    })
    
    // Wait for update
    await page.waitForTimeout(500)
    
    // Update second drawing style
    await page.evaluate(() => {
      const updateEvent = new CustomEvent('chart:updateDrawingStyle', {
        detail: {
          drawingId: 'realtime-horizontal',
          style: { lineStyle: 'solid', showLabels: true },
          immediate: true
        }
      })
      window.dispatchEvent(updateEvent)
    })
    
    // Verify both updates completed
    await page.waitForTimeout(500)
    
    // Check toast messages
    const toastCount = await page.locator('text=スタイルを更新しました').count()
    expect(toastCount).toBeGreaterThanOrEqual(2)
  })

  test('style editor closes on outside click', async ({ page }) => {
    // Setup a drawing
    await page.evaluate(() => {
      const event = new CustomEvent('chart:addDrawing', {
        detail: {
          id: 'close-test-drawing',
          type: 'trendline',
          points: [
            { time: Date.now() / 1000 - 1800, value: 45000 },
            { time: Date.now() / 1000, value: 45500 }
          ],
          style: { color: '#22c55e', lineWidth: 2, lineStyle: 'solid', showLabels: true }
        }
      })
      window.dispatchEvent(event)
    })
    
    await page.waitForTimeout(1000)
    
    // Open style editor
    await page.hover('[data-testid="proposal-item-approved"]')
    await page.click('text=スタイル')
    
    // Verify popover is open
    await expect(page.locator('[data-testid="popover-content"]')).toBeVisible()
    
    // Click outside
    await page.click('body', { position: { x: 10, y: 10 } })
    
    // Verify popover is closed
    await expect(page.locator('[data-testid="popover-content"]')).not.toBeVisible()
  })
})