import { test, expect } from '@playwright/test';

/**
 * E2E Test for AI-powered Chart Control
 * 
 * Tests the integration between chat commands and chart UI operations
 */

test.describe('AI Chart Control Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main page
    await page.goto('http://localhost:3000');
    
    // Wait for chart to load
    await page.waitForSelector('[data-testid="chart-container"]', { timeout: 10000 });
    
    // Open chat panel if not visible
    const chatButton = await page.$('button:has(svg.lucide-message-square)');
    if (chatButton) {
      await chatButton.click();
    }
    
    // Wait for chat panel to be visible
    await page.waitForSelector('[data-testid="chat-input"]', { timeout: 5000 });
  });

  test('should change symbol via chat command', async ({ page }) => {
    // Type command in chat
    await page.fill('[data-testid="chat-input"]', 'ETHに切り替えて');
    await page.press('[data-testid="chat-input"]', 'Enter');
    
    // Wait for AI response
    await page.waitForTimeout(2000);
    
    // Verify symbol changed in UI
    const symbolDisplay = await page.textContent('[data-testid="symbol-display"]');
    expect(symbolDisplay).toContain('ETH');
  });

  test('should change timeframe via chat command', async ({ page }) => {
    // Type command in chat
    await page.fill('[data-testid="chat-input"]', '1時間足に変更して');
    await page.press('[data-testid="chat-input"]', 'Enter');
    
    // Wait for AI response
    await page.waitForTimeout(2000);
    
    // Verify timeframe changed
    const timeframeButton = await page.$('button[data-active="true"]:has-text("1h")');
    expect(timeframeButton).toBeTruthy();
  });

  test('should toggle indicators via chat command', async ({ page }) => {
    // Enable MA indicator
    await page.fill('[data-testid="chat-input"]', '移動平均を表示して');
    await page.press('[data-testid="chat-input"]', 'Enter');
    
    await page.waitForTimeout(2000);
    
    // Check if MA indicator is visible
    const maIndicator = await page.$('[data-testid="indicator-ma"]');
    expect(maIndicator).toBeTruthy();
    
    // Disable MA indicator
    await page.fill('[data-testid="chat-input"]', '移動平均を非表示にして');
    await page.press('[data-testid="chat-input"]', 'Enter');
    
    await page.waitForTimeout(2000);
    
    // Check if MA indicator is hidden
    const maIndicatorHidden = await page.$('[data-testid="indicator-ma"]:not([data-visible="true"])');
    expect(maIndicatorHidden).toBeTruthy();
  });

  test('should draw trendline via chat command', async ({ page }) => {
    // Request trendline drawing
    await page.fill('[data-testid="chat-input"]', 'トレンドラインを引いて');
    await page.press('[data-testid="chat-input"]', 'Enter');
    
    await page.waitForTimeout(3000);
    
    // Check if trendline is drawn
    const trendline = await page.$('[data-testid^="drawing-trend-"]');
    expect(trendline).toBeTruthy();
  });

  test('should fit chart content via chat command', async ({ page }) => {
    // First zoom in to change the view
    await page.keyboard.press('Control++');
    await page.waitForTimeout(500);
    
    // Request chart fit
    await page.fill('[data-testid="chat-input"]', 'チャートをフィットして');
    await page.press('[data-testid="chat-input"]', 'Enter');
    
    await page.waitForTimeout(2000);
    
    // Verify chart is fitted (difficult to test visually, check for event)
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    expect(consoleMessages.some(msg => msg.includes('Chart fit requested'))).toBeTruthy();
  });

  test('should handle multiple commands in sequence', async ({ page }) => {
    // Execute multiple commands
    const commands = [
      'BTCに切り替えて',
      '15分足に変更して',
      'RSIを表示して',
      'トレンドラインを引いて'
    ];
    
    for (const command of commands) {
      await page.fill('[data-testid="chat-input"]', command);
      await page.press('[data-testid="chat-input"]', 'Enter');
      await page.waitForTimeout(2000);
    }
    
    // Verify all changes applied
    const symbolDisplay = await page.textContent('[data-testid="symbol-display"]');
    expect(symbolDisplay).toContain('BTC');
    
    const timeframeButton = await page.$('button[data-active="true"]:has-text("15m")');
    expect(timeframeButton).toBeTruthy();
    
    const rsiIndicator = await page.$('[data-testid="indicator-rsi"]');
    expect(rsiIndicator).toBeTruthy();
    
    const trendline = await page.$('[data-testid^="drawing-trend-"]');
    expect(trendline).toBeTruthy();
  });
});

test.describe('Event System Integration', () => {
  test('should handle custom events directly', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Inject custom event
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('ui:changeSymbol', {
        detail: { symbol: 'SOLUSDT' }
      }));
    });
    
    await page.waitForTimeout(1000);
    
    // Verify symbol changed
    const symbolDisplay = await page.textContent('[data-testid="symbol-display"]');
    expect(symbolDisplay).toContain('SOL');
  });

  test('should handle drawing events with points data', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Inject trendline drawing event with specific points
    await page.evaluate(() => {
      const points = [
        { x: 100, y: 200, price: 105000, time: Date.now() - 3600000 },
        { x: 300, y: 150, price: 106000, time: Date.now() }
      ];
      
      window.dispatchEvent(new CustomEvent('draw:trendline', {
        detail: { 
          points,
          style: {
            color: '#00e676',
            lineWidth: 2,
            lineStyle: 'solid',
            showLabels: true
          }
        }
      }));
    });
    
    await page.waitForTimeout(1000);
    
    // Verify trendline is drawn
    const trendline = await page.$('[data-testid^="drawing-trend-"]');
    expect(trendline).toBeTruthy();
  });
});