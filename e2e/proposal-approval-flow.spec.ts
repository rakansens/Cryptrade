import { test, expect } from '@playwright/test';

test.describe('Proposal Approval Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('should show visual feedback when approving proposals', async ({ page }) => {
    // Wait for the chat panel to be ready
    await page.waitForSelector('[data-testid="chat-input"]', { state: 'visible' });
    
    // Send a message to generate proposals
    const chatInput = page.locator('textarea[placeholder="メッセージ入力"]');
    await chatInput.fill('BTCのトレンドライン分析をして提案を生成して');
    await chatInput.press('Enter');
    
    // Wait for proposal card to appear
    await page.waitForSelector('.bg-gray-900.border-gray-800', { timeout: 30000 });
    
    // Get initial proposal count
    const pendingProposals = await page.locator('text=/件の提案待ち/').textContent();
    console.log('Pending proposals:', pendingProposals);
    
    // Click approve on first proposal
    const firstApproveButton = page.locator('button[title="承認"]').first();
    await firstApproveButton.click();
    
    // Verify visual feedback
    await expect(page.locator('text="承認済み"').first()).toBeVisible();
    await expect(page.locator('.bg-green-900\\/20').first()).toBeVisible();
    
    // Verify the approved count is shown
    await expect(page.locator('text=/1件承認済み/')).toBeVisible();
    
    // Verify "チャートに描画済み" indicator
    await expect(page.locator('text="チャートに描画済み"')).toBeVisible();
  });

  test('should correctly transform drawing data when approving', async ({ page }) => {
    // Inject console log listener
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('[ChatPanel] Drawing event published')) {
        consoleLogs.push(msg.text());
      }
    });
    
    // Send a message to generate proposals
    const chatInput = page.locator('textarea[placeholder="メッセージ入力"]');
    await chatInput.fill('BTCのトレンドライン分析をして提案を生成して');
    await chatInput.press('Enter');
    
    // Wait for proposal card
    await page.waitForSelector('.bg-gray-900.border-gray-800', { timeout: 30000 });
    
    // Approve first proposal
    const firstApproveButton = page.locator('button[title="承認"]').first();
    await firstApproveButton.click();
    
    // Wait for console log
    await page.waitForTimeout(1000);
    
    // Verify the transformation happened
    expect(consoleLogs.length).toBeGreaterThan(0);
    const log = consoleLogs[0];
    expect(log).toContain('transformedPoints');
  });

  test('should handle approve all functionality', async ({ page }) => {
    // Send a message to generate proposals
    const chatInput = page.locator('textarea[placeholder="メッセージ入力"]');
    await chatInput.fill('BTCの総合テクニカル分析をして複数の提案を生成して');
    await chatInput.press('Enter');
    
    // Wait for proposal card
    await page.waitForSelector('.bg-gray-900.border-gray-800', { timeout: 30000 });
    
    // Click "全て承認" button
    const approveAllButton = page.locator('button:has-text("全て承認")');
    await approveAllButton.click();
    
    // Verify all proposals show as approved
    const approvedItems = await page.locator('.bg-green-900\\/20').count();
    expect(approvedItems).toBeGreaterThan(0);
    
    // Verify no pending proposals remain
    await expect(page.locator('button[title="承認"]')).not.toBeVisible();
    
    // Verify the approve all button is disabled
    await expect(approveAllButton).toBeDisabled();
  });
});