import { Page, expect } from '@playwright/test';
import { ChartPageObject } from '../pages/chart.page';
import { ChatPageObject } from '../pages/chat.page';

/**
 * Common test utilities for e2e tests
 */

export interface TestContext {
  chart: ChartPageObject;
  chat: ChatPageObject;
}

/**
 * Initialize page objects for a test
 */
export async function initializeTest(page: Page): Promise<TestContext> {
  const chart = new ChartPageObject(page);
  const chat = new ChatPageObject(page);
  
  // Navigate to the application
  await page.goto('/');
  
  // Wait for chart to load
  await chart.waitForLoad();
  
  return { chart, chat };
}

/**
 * Verify chart has loaded with data
 */
export async function verifyChartData(page: Page): Promise<void> {
  // Check for canvas element
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  
  // Check for price display
  const priceDisplay = page.locator('[data-testid="price-display"]');
  await expect(priceDisplay).toBeVisible();
  
  // Verify price is not zero
  const priceText = await priceDisplay.textContent();
  expect(priceText).not.toContain('0.00');
}

/**
 * Wait for a specific console message
 */
export async function waitForConsoleMessage(page: Page, messagePattern: string | RegExp): Promise<void> {
  await page.waitForEvent('console', msg => {
    const text = msg.text();
    return typeof messagePattern === 'string' 
      ? text.includes(messagePattern)
      : messagePattern.test(text);
  });
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ 
    path: `e2e-test-results/screenshots/${name}.png`,
    fullPage: true 
  });
}

/**
 * Mock WebSocket connections for testing
 */
export async function mockWebSocket(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Override WebSocket constructor
    (window as any).WebSocket = class MockWebSocket {
      url: string;
      readyState: number = 1; // OPEN
      
      constructor(url: string) {
        this.url = url;
        setTimeout(() => {
          if (this.onopen) this.onopen(new Event('open'));
        }, 100);
      }
      
      send(data: string): void {
        console.log('[MockWebSocket] Sent:', data);
      }
      
      close(): void {
        this.readyState = 3; // CLOSED
        if (this.onclose) this.onclose(new CloseEvent('close'));
      }
      
      // Event handlers
      onopen: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
    };
  });
}

/**
 * Generate mock chart data
 */
export function generateMockKlineData(symbol: string, count: number = 100): any[] {
  const now = Date.now();
  const interval = 60000; // 1 minute
  const basePrice = symbol === 'BTCUSDT' ? 40000 : symbol === 'ETHUSDT' ? 2500 : 300;
  
  return Array.from({ length: count }, (_, i) => ({
    time: now - (count - i) * interval,
    open: basePrice + Math.random() * 100 - 50,
    high: basePrice + Math.random() * 150,
    low: basePrice - Math.random() * 150,
    close: basePrice + Math.random() * 100 - 50,
    volume: Math.random() * 1000
  }));
}

/**
 * Verify toast notification appears
 */
export async function verifyToast(page: Page, message: string): Promise<void> {
  const toast = page.locator('.fixed.top-4.right-4').filter({ hasText: message });
  await expect(toast).toBeVisible();
  // Wait for toast to disappear
  await expect(toast).toBeHidden({ timeout: 5000 });
}

/**
 * Clean up test data
 */
export async function cleanupTest(page: Page): Promise<void> {
  // Clear local storage
  await page.evaluate(() => localStorage.clear());
  
  // Clear session storage
  await page.evaluate(() => sessionStorage.clear());
  
  // Clear IndexedDB if used
  await page.evaluate(async () => {
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    }
  });
}