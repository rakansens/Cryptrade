import { test, expect, Page } from '@playwright/test';

/**
 * 提案承認フローの拡張E2Eテスト
 * - 複数提案の管理
 * - 承認/却下の詳細な挙動
 * - 提案のフィルタリング
 * - バッチ処理
 */

test.describe('Enhanced Proposal Approval Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // アプリケーションの初期化を待機
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="chart-container"]', {
      state: 'visible',
      timeout: 15000
    });
    
    // チャットパネルの準備を待機
    await page.waitForSelector('[data-testid="chat-input"]', {
      state: 'visible',
      timeout: 10000
    });
  });

  test('複数提案の生成と個別管理', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');

    // 分析リクエストを送信
    await chatInput.fill('BTCの包括的なテクニカル分析を行い、サポート・レジスタンス、トレンドライン、フィボナッチの提案を生成してください');
    await chatInput.press('Enter');

    // 提案カードの表示を待機
    await page.waitForSelector('[data-testid="proposal-card"]', {
      state: 'visible',
      timeout: 30000
    });

    // 複数の提案が生成されたことを確認
    const proposalCards = page.locator('[data-testid="proposal-card"]');
    const proposalCount = await proposalCards.count();
    expect(proposalCount).toBeGreaterThan(1);

    // 各提案の詳細を確認
    for (let i = 0; i < Math.min(proposalCount, 3); i++) {
      const card = proposalCards.nth(i);
      
      // 提案タイプが表示されていることを確認
      await expect(card.locator('[data-testid="proposal-type"]')).toBeVisible();
      
      // 価格情報が含まれていることを確認
      await expect(card.locator('text=/\\$[0-9,]+/')).toBeVisible();
      
      // アクションボタンが表示されていることを確認
      await expect(card.locator('button[title="承認"]')).toBeVisible();
      await expect(card.locator('button[title="却下"]')).toBeVisible();
    }
  });

  test('提案の承認フローと視覚的フィードバック', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');

    // 提案を生成
    await chatInput.fill('重要な価格レベルにサポートラインとレジスタンスラインを引く提案を生成して');
    await chatInput.press('Enter');

    // 提案カードを待機
    await page.waitForSelector('[data-testid="proposal-card"]', {
      state: 'visible',
      timeout: 30000
    });

    // 最初の提案を承認
    const firstCard = page.locator('[data-testid="proposal-card"]').first();
    const approveButton = firstCard.locator('button[title="承認"]');
    
    // 承認前の状態を記録
    const initialStatus = await firstCard.getAttribute('data-status');
    expect(initialStatus).toBe('pending');

    // 承認ボタンをクリック
    await approveButton.click();

    // 視覚的フィードバックを確認
    await expect(firstCard).toHaveAttribute('data-status', 'approved');
    await expect(firstCard.locator('.bg-green-900\\/20')).toBeVisible();
    await expect(firstCard.locator('text="承認済み"')).toBeVisible();
    
    // チャートに描画されたことを確認
    await expect(firstCard.locator('text="チャートに描画済み"')).toBeVisible();

    // 承認カウンターの更新を確認
    await expect(page.locator('[data-testid="approved-count"]')).toContainText('1件承認済み');
  });

  test('提案の却下フローと理由入力', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');

    // 提案を生成
    await chatInput.fill('トレンドライン分析の提案を生成して');
    await chatInput.press('Enter');

    await page.waitForSelector('[data-testid="proposal-card"]', {
      state: 'visible',
      timeout: 30000
    });

    // 最初の提案を却下
    const firstCard = page.locator('[data-testid="proposal-card"]').first();
    const rejectButton = firstCard.locator('button[title="却下"]');
    
    await rejectButton.click();

    // 却下理由の入力ダイアログが表示される場合
    const rejectDialog = page.locator('[data-testid="reject-dialog"]');
    if (await rejectDialog.isVisible({ timeout: 1000 })) {
      const reasonInput = rejectDialog.locator('textarea');
      await reasonInput.fill('価格レベルが現在の市場状況に適していないため');
      await rejectDialog.locator('button:has-text("却下を確定")').click();
    }

    // 視覚的フィードバックを確認
    await expect(firstCard).toHaveAttribute('data-status', 'rejected');
    await expect(firstCard.locator('.bg-red-900\\/20')).toBeVisible();
    await expect(firstCard.locator('text="却下済み"')).toBeVisible();

    // 却下カウンターの更新を確認
    await expect(page.locator('[data-testid="rejected-count"]')).toContainText('1件却下済み');
  });

  test('複数提案の一括承認機能', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');

    // 複数の提案を生成
    await chatInput.fill('複数のテクニカル指標に基づいた描画提案を5つ以上生成してください');
    await chatInput.press('Enter');

    // 提案が複数生成されるまで待機
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="proposal-card"]').length >= 3,
      { timeout: 30000 }
    );

    // 一括承認ボタンを探す
    const batchApproveButton = page.locator('button:has-text("すべて承認")');
    if (await batchApproveButton.isVisible()) {
      // 提案数を記録
      const proposalCount = await page.locator('[data-testid="proposal-card"]').count();
      
      // 一括承認を実行
      await batchApproveButton.click();
      
      // 確認ダイアログが表示される場合
      const confirmDialog = page.locator('[data-testid="confirm-dialog"]');
      if (await confirmDialog.isVisible({ timeout: 1000 })) {
        await confirmDialog.locator('button:has-text("承認")').click();
      }

      // すべての提案が承認されたことを確認
      await expect(page.locator('[data-testid="approved-count"]')).toContainText(`${proposalCount}件承認済み`);
      
      // 各カードが承認状態になったことを確認
      const approvedCards = page.locator('[data-testid="proposal-card"][data-status="approved"]');
      await expect(approvedCards).toHaveCount(proposalCount);
    }
  });

  test('提案のフィルタリングとソート', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');

    // 様々なタイプの提案を生成
    await chatInput.fill('サポート、レジスタンス、トレンドライン、フィボナッチを含む包括的な分析提案を生成して');
    await chatInput.press('Enter');

    await page.waitForSelector('[data-testid="proposal-card"]', {
      state: 'visible',
      timeout: 30000
    });

    // フィルターコントロールを探す
    const filterControl = page.locator('[data-testid="proposal-filter"]');
    if (await filterControl.isVisible()) {
      // タイプでフィルタリング
      await filterControl.selectOption('horizontal');
      await page.waitForTimeout(500);
      
      // フィルタリング結果を確認
      const visibleCards = await page.locator('[data-testid="proposal-card"]:visible').count();
      const horizontalCards = await page.locator('[data-testid="proposal-card"]:visible:has-text("水平線")').count();
      expect(horizontalCards).toBe(visibleCards);
      
      // フィルターをリセット
      await filterControl.selectOption('all');
    }

    // ソートコントロールを探す
    const sortControl = page.locator('[data-testid="proposal-sort"]');
    if (await sortControl.isVisible()) {
      // 価格でソート
      await sortControl.selectOption('price-desc');
      await page.waitForTimeout(500);
      
      // ソート順を確認（最初の2つの提案の価格を比較）
      const prices = await page.locator('[data-testid="proposal-price"]').allTextContents();
      if (prices.length >= 2) {
        const price1 = parseFloat(prices[0].replace(/[$,]/g, ''));
        const price2 = parseFloat(prices[1].replace(/[$,]/g, ''));
        expect(price1).toBeGreaterThanOrEqual(price2);
      }
    }
  });

  test('提案の詳細表示と編集', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');

    // 提案を生成
    await chatInput.fill('詳細な分析付きのトレンドライン提案を生成して');
    await chatInput.press('Enter');

    await page.waitForSelector('[data-testid="proposal-card"]', {
      state: 'visible',
      timeout: 30000
    });

    const firstCard = page.locator('[data-testid="proposal-card"]').first();
    
    // 詳細表示ボタンをクリック
    const detailButton = firstCard.locator('button[title="詳細"]');
    if (await detailButton.isVisible()) {
      await detailButton.click();
      
      // 詳細パネルが表示されることを確認
      const detailPanel = page.locator('[data-testid="proposal-detail-panel"]');
      await expect(detailPanel).toBeVisible();
      
      // 詳細情報が含まれていることを確認
      await expect(detailPanel).toContainText(/分析理由|根拠|信頼度/);
      
      // 編集ボタンが表示されている場合
      const editButton = detailPanel.locator('button:has-text("編集")');
      if (await editButton.isVisible()) {
        await editButton.click();
        
        // 編集フォームが表示されることを確認
        const editForm = page.locator('[data-testid="proposal-edit-form"]');
        await expect(editForm).toBeVisible();
        
        // 価格を編集
        const priceInput = editForm.locator('input[name="price"]');
        await priceInput.clear();
        await priceInput.fill('45500');
        
        // 保存
        await editForm.locator('button:has-text("保存")').click();
        
        // 編集が反映されたことを確認
        await expect(firstCard).toContainText('45,500');
      }
    }
  });

  test('提案の有効期限と自動削除', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');

    // 短期的な提案を生成
    await chatInput.fill('今後1時間以内の短期的な取引提案を生成して');
    await chatInput.press('Enter');

    await page.waitForSelector('[data-testid="proposal-card"]', {
      state: 'visible',
      timeout: 30000
    });

    // 有効期限の表示を確認
    const expiryIndicator = page.locator('[data-testid="proposal-expiry"]').first();
    if (await expiryIndicator.isVisible()) {
      await expect(expiryIndicator).toContainText(/期限|有効|まで/);
      
      // タイマーが動作していることを確認
      const initialTime = await expiryIndicator.textContent();
      await page.waitForTimeout(2000);
      const updatedTime = await expiryIndicator.textContent();
      expect(updatedTime).not.toBe(initialTime);
    }
  });

  test('提案承認後のチャート連携確認', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');

    // チャート上の描画数を記録
    const initialDrawingCount = await page.evaluate(() => {
      const store = (window as any).__chartStore;
      return store?.getState()?.drawings?.length || 0;
    });

    // 提案を生成
    await chatInput.fill('45000ドルにサポートラインを引く提案を生成して');
    await chatInput.press('Enter');

    await page.waitForSelector('[data-testid="proposal-card"]', {
      state: 'visible',
      timeout: 30000
    });

    // 提案を承認
    const approveButton = page.locator('button[title="承認"]').first();
    await approveButton.click();

    // チャートに描画が追加されたことを確認
    await page.waitForFunction(
      (count) => {
        const store = (window as any).__chartStore;
        const currentCount = store?.getState()?.drawings?.length || 0;
        return currentCount > count;
      },
      initialDrawingCount,
      { timeout: 5000 }
    );

    // 追加された描画の詳細を確認
    const newDrawing = await page.evaluate(() => {
      const store = (window as any).__chartStore;
      const drawings = store?.getState()?.drawings || [];
      return drawings[drawings.length - 1];
    });

    expect(newDrawing).toBeTruthy();
    expect(newDrawing.type).toBe('horizontal');
    expect(newDrawing.points[0].value).toBeCloseTo(45000, -2);
  });

  test('提案の履歴と再利用', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');

    // 複数の提案セッションを実行
    for (let i = 0; i < 2; i++) {
      await chatInput.fill(`セッション${i + 1}: トレンドライン分析の提案を生成して`);
      await chatInput.press('Enter');
      
      await page.waitForSelector('[data-testid="proposal-card"]', {
        state: 'visible',
        timeout: 30000
      });
      
      // いくつか承認
      const approveButtons = page.locator('button[title="承認"]');
      const count = await approveButtons.count();
      if (count > 0) {
        await approveButtons.first().click();
        await page.waitForTimeout(1000);
      }
    }

    // 履歴タブに切り替え
    const historyTab = page.locator('[data-testid="proposal-history-tab"]');
    if (await historyTab.isVisible()) {
      await historyTab.click();
      
      // 過去の提案が表示されることを確認
      const historyItems = page.locator('[data-testid="proposal-history-item"]');
      await expect(historyItems).toHaveCount(2);
      
      // 過去の提案を再利用
      const reuseButton = historyItems.first().locator('button:has-text("再利用")');
      if (await reuseButton.isVisible()) {
        await reuseButton.click();
        
        // 新しい提案として追加されたことを確認
        await expect(page.locator('[data-testid="proposal-card"][data-status="pending"]')).toHaveCount(1);
      }
    }
  });
});

// ヘルパー関数
async function waitForProposal(page: Page, timeout: number = 30000): Promise<boolean> {
  return page.waitForSelector('[data-testid="proposal-card"]', {
    state: 'visible',
    timeout
  }).then(() => true).catch(() => false);
}

async function getProposalCount(page: Page, status?: string): Promise<number> {
  const selector = status 
    ? `[data-testid="proposal-card"][data-status="${status}"]`
    : '[data-testid="proposal-card"]';
  return page.locator(selector).count();
}

async function approveProposal(page: Page, index: number = 0): Promise<void> {
  const approveButton = page.locator('button[title="承認"]').nth(index);
  await approveButton.click();
  await page.waitForTimeout(500);
}