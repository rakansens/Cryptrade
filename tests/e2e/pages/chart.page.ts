import { Page, Locator } from '@playwright/test';
import { TEST_SELECTORS } from '../types';

/**
 * Chart Page Object
 * Encapsulates all chart-related interactions
 */
export class ChartPageObject {
  readonly page: Page;
  readonly container: Locator;
  readonly symbolSelector: Locator;
  readonly timeframeSelector: Locator;
  readonly indicatorButton: Locator;
  readonly drawingButton: Locator;
  readonly canvas: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator(TEST_SELECTORS.chart.container);
    this.symbolSelector = page.locator(TEST_SELECTORS.chart.toolbar.symbolSelector);
    this.timeframeSelector = page.locator(TEST_SELECTORS.chart.toolbar.timeframeSelector);
    this.indicatorButton = page.locator(TEST_SELECTORS.chart.toolbar.indicatorButton);
    this.drawingButton = page.locator(TEST_SELECTORS.chart.toolbar.drawingButton);
    this.canvas = page.locator(TEST_SELECTORS.chart.canvas);
  }

  async waitForLoad(): Promise<void> {
    await this.container.waitFor({ state: 'visible', timeout: 10000 });
    await this.canvas.waitFor({ state: 'visible', timeout: 5000 });
    // Wait for initial data to load
    await this.page.waitForTimeout(2000);
  }

  async changeSymbol(symbol: string): Promise<void> {
    await this.symbolSelector.click();
    await this.page.locator(`[data-value="${symbol}"]`).click();
    await this.waitForLoad();
  }

  async changeTimeframe(timeframe: string): Promise<void> {
    await this.timeframeSelector.click();
    await this.page.locator(`[data-value="${timeframe}"]`).click();
    await this.waitForLoad();
  }

  async openIndicatorMenu(): Promise<void> {
    await this.indicatorButton.click();
    await this.page.waitForSelector('[data-testid="indicator-menu"]', { state: 'visible' });
  }

  async openDrawingTools(): Promise<void> {
    await this.drawingButton.click();
    await this.page.waitForSelector('[data-testid="drawing-tools"]', { state: 'visible' });
  }

  async drawTrendline(startX: number, startY: number, endX: number, endY: number): Promise<void> {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Chart canvas not found');

    await this.openDrawingTools();
    await this.page.locator(TEST_SELECTORS.drawing.trendline).click();
    
    // Start drawing mode
    await this.page.waitForFunction(() => document.body.style.cursor === 'crosshair');
    
    // Draw the line
    await this.page.mouse.click(box.x + startX, box.y + startY);
    await this.page.waitForTimeout(500);
    await this.page.mouse.click(box.x + endX, box.y + endY);
  }

  async getCurrentSymbol(): Promise<string> {
    return await this.symbolSelector.textContent() || '';
  }

  async getCurrentTimeframe(): Promise<string> {
    return await this.timeframeSelector.textContent() || '';
  }

  async hasDrawing(type: string): Promise<boolean> {
    try {
      await this.page.waitForSelector(`[data-drawing-type="${type}"]`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}