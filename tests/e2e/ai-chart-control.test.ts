import { test, expect } from '@playwright/test';
import { initializeTest } from './helpers/test-utils';
import type { TestContext } from './helpers/test-utils';

/**
 * E2E Test for AI-powered Chart Control
 * 
 * Tests the integration between chat commands and chart UI operations
 */

test.describe('AI Chart Control Integration', () => {
  let ctx: TestContext;

  test.beforeEach(async ({ page }) => {
    ctx = await initializeTest(page);
    await ctx.chat.open();
  });

  test('should change symbol via chat command', async () => {
    // Type command in chat
    await ctx.chat.sendMessage('ETHに切り替えて');
    
    // Wait for AI response
    await ctx.chat.waitForResponse();
    
    // Verify symbol changed in UI
    const currentSymbol = await ctx.chart.getCurrentSymbol();
    expect(currentSymbol).toContain('ETH');
  });

  test('should change timeframe via chat command', async () => {
    // Type command in chat
    await ctx.chat.sendMessage('1時間足に変更して');
    
    // Wait for AI response
    await ctx.chat.waitForResponse();
    
    // Verify timeframe changed
    const currentTimeframe = await ctx.chart.getCurrentTimeframe();
    expect(currentTimeframe).toBe('1h');
  });

  test('should toggle indicators via chat command', async ({ page }) => {
    // Enable MA indicator
    await ctx.chat.sendMessage('移動平均を表示して');
    
    await page.waitForTimeout(2000);
    
    // Check if MA indicator is visible
    const maIndicator = await page.$('[data-testid="indicator-ma"]');
    expect(maIndicator).not.toBeNull();
    
    // Disable MA indicator
    await ctx.chat.sendMessage('移動平均を非表示にして');
    
    await page.waitForTimeout(2000);
    
    // Check if MA indicator is hidden
    const maIndicatorHidden = await page.$('[data-testid="indicator-ma"]:not([data-visible="true"])');
    expect(maIndicatorHidden).not.toBeNull();
  });

  test('should draw trendline via chat command', async ({ page }) => {
    // Request trendline drawing
    await ctx.chat.sendMessage('トレンドラインを引いて');
    
    await page.waitForTimeout(3000);
    
    // Check if trendline is drawn
    const trendline = await page.$('[data-testid^="drawing-trend-"]');
    expect(trendline).not.toBeNull();
  });

  test('should fit chart content via chat command', async ({ page }) => {
    // First zoom in to change the view
    await page.keyboard.press('Control++');
    await page.waitForTimeout(500);
    
    // Request chart fit
    await ctx.chat.sendMessage('チャートをフィットして');
    
    await page.waitForTimeout(2000);
    
    // Verify chart is fitted (difficult to test visually, check for event)
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    expect(consoleMessages.some(msg => msg.includes('Chart fit requested'))).toBe(true);
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
      await ctx.chat.sendMessage(command);
      await page.waitForTimeout(2000);
    }
    
    // Verify all changes applied
    const symbolDisplay = await page.textContent('[data-testid="symbol-display"]');
    expect(symbolDisplay).toContain('BTC');
    
    const timeframeButton = await page.$('button[data-active="true"]:has-text("15m")');
    expect(timeframeButton).not.toBeNull();
    
    const rsiIndicator = await page.$('[data-testid="indicator-rsi"]');
    expect(rsiIndicator).not.toBeNull();
    
    const trendline = await page.$('[data-testid^="drawing-trend-"]');
    expect(trendline).not.toBeNull();
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
    expect(trendline).not.toBeNull();
  });
});