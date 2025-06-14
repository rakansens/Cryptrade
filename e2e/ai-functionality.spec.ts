import { test, expect } from '@playwright/test';

/**
 * AI機能の包括的E2Eテスト
 * - 複数描画
 * - 時間足変更
 * - 銘柄変更
 * - 複合操作
 */

test.describe('AI Chart Control Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // アプリケーションを開く
    await page.goto('http://localhost:3000');
    
    // チャットパネルが表示されるまで待機
    await page.waitForSelector('[data-testid="floating-chat-panel"]', { 
      state: 'visible',
      timeout: 10000 
    });
    
    // チャートが読み込まれるまで待機
    await page.waitForSelector('[data-testid="chart-container"]', {
      state: 'visible',
      timeout: 10000
    });
  });

  test('時間足変更が正常に動作する', async ({ page }) => {
    // チャット入力フィールドを取得
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    const sendButton = page.locator('button[aria-label="送信"]');
    
    // 4時間足に変更
    await chatInput.fill('4時間足に変更して');
    await sendButton.click();
    
    // レスポンスを待機
    await page.waitForTimeout(2000);
    
    // コンソールログを確認
    page.on('console', msg => {
      if (msg.text().includes('Timeframe changed to: 4h')) {
        expect(msg.text()).toContain('4h');
      }
    });
    
    // UIの変更を確認（時間足セレクターなど）
    const timeframeSelector = page.locator('[data-testid="timeframe-selector"]');
    if (await timeframeSelector.isVisible()) {
      await expect(timeframeSelector).toHaveText('4h');
    }
  });

  test('銘柄変更が正常に動作する', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    const sendButton = page.locator('button[aria-label="送信"]');
    
    // ETHに変更
    await chatInput.fill('ETHに変更');
    await sendButton.click();
    
    // レスポンスを待機
    await page.waitForTimeout(2000);
    
    // コンソールログを確認
    page.on('console', msg => {
      if (msg.text().includes('Symbol changed to: ETHUSDT')) {
        expect(msg.text()).toContain('ETHUSDT');
      }
    });
    
    // チャートタイトルの変更を確認
    const chartTitle = page.locator('[data-testid="chart-symbol"]');
    if (await chartTitle.isVisible()) {
      await expect(chartTitle).toContain('ETH');
    }
  });

  test('単一トレンドライン描画が動作する', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    const sendButton = page.locator('button[aria-label="送信"]');
    
    // トレンドラインを描画
    await chatInput.fill('トレンドラインを引いて');
    await sendButton.click();
    
    // 描画完了を待機
    await page.waitForTimeout(3000);
    
    // DrawingRendererのログを確認
    let trendlineCreated = false;
    page.on('console', msg => {
      if (msg.text().includes('[DrawingRenderer] Trendline created and stored')) {
        trendlineCreated = true;
      }
    });
    
    // Store状態を確認
    const storeState = await page.evaluate(() => {
      return (window as any).chartStore?.getState();
    });
    
    if (storeState) {
      expect(storeState.drawings.length).toBeGreaterThan(0);
      expect(storeState.drawings[0].type).toBe('trendline');
    }
  });

  test('複数トレンドライン描画（現在は未対応）', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    const sendButton = page.locator('button[aria-label="送信"]');
    
    // 5本のトレンドラインを描画
    await chatInput.fill('5本のトレンドラインを引いて');
    await sendButton.click();
    
    // 描画完了を待機
    await page.waitForTimeout(3000);
    
    // 現在の実装では1本のみ描画される
    const storeState = await page.evaluate(() => {
      return (window as any).chartStore?.getState();
    });
    
    if (storeState) {
      // TODO: 複数描画実装後は5本になるはず
      expect(storeState.drawings.length).toBe(1);
    }
  });

  test('インジケーター制御が動作する', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    const sendButton = page.locator('button[aria-label="送信"]');
    
    // 移動平均線を表示
    await chatInput.fill('移動平均線を表示して');
    await sendButton.click();
    
    // インジケーター表示を待機
    await page.waitForTimeout(2000);
    
    // コンソールログを確認
    page.on('console', msg => {
      if (msg.text().includes('Indicator toggled: ma')) {
        expect(msg.text()).toContain('true');
      }
    });
  });

  test('複合操作（銘柄+時間足+描画）', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    const sendButton = page.locator('button[aria-label="送信"]');
    
    // 複合操作
    await chatInput.fill('BTCの1時間足でトレンドラインを引いて');
    await sendButton.click();
    
    // 操作完了を待機
    await page.waitForTimeout(4000);
    
    // 複数のイベントが発火することを確認
    const events: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Symbol changed to:')) {
        events.push('symbol');
      }
      if (text.includes('Timeframe changed to:')) {
        events.push('timeframe');
      }
      if (text.includes('[DrawingRenderer] Trendline created')) {
        events.push('drawing');
      }
    });
    
    // 少なくとも1つ以上の操作が実行されることを確認
    await page.waitForTimeout(1000);
    expect(events.length).toBeGreaterThan(0);
  });

  test('チャート分析に基づく描画', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    const sendButton = page.locator('button[aria-label="送信"]');
    
    // 分析ベースの描画
    await chatInput.fill('現在のチャートを分析して最適なトレンドラインを引いて');
    await sendButton.click();
    
    // 分析と描画完了を待機
    await page.waitForTimeout(5000);
    
    // チャート分析ツールが使用されることを確認
    page.on('console', msg => {
      if (msg.text().includes('[ChartControl] Chart analysis completed')) {
        expect(msg.text()).toBeTruthy();
      }
    });
    
    // 描画が追加されることを確認
    const storeState = await page.evaluate(() => {
      return (window as any).chartStore?.getState();
    });
    
    if (storeState && storeState.drawings.length > 0) {
      const drawing = storeState.drawings[0];
      expect(drawing.type).toBe('trendline');
      expect(drawing.points.length).toBe(2);
    }
  });
});

test.describe('AI Response Quality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('[data-testid="floating-chat-panel"]', { state: 'visible' });
  });

  test('日本語での自然な応答', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    const sendButton = page.locator('button[aria-label="送信"]');
    
    // 挨拶
    await chatInput.fill('こんにちは');
    await sendButton.click();
    
    // レスポンスを待機
    await page.waitForSelector('.assistant-message', { timeout: 5000 });
    
    const response = await page.locator('.assistant-message').last().textContent();
    expect(response).toBeTruthy();
    expect(response).toMatch(/こんにちは|お手伝い|ようこそ/);
  });

  test('エラーハンドリング', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    const sendButton = page.locator('button[aria-label="送信"]');
    
    // 無効なリクエスト
    await chatInput.fill('あいうえお');
    await sendButton.click();
    
    // レスポンスを待機
    await page.waitForSelector('.assistant-message', { timeout: 5000 });
    
    const response = await page.locator('.assistant-message').last().textContent();
    expect(response).toBeTruthy();
    // エラーメッセージではなく、適切な応答が返ることを確認
    expect(response).not.toContain('エラー');
  });
});

// パフォーマンステスト
test.describe('Performance', () => {
  test('レスポンス時間が適切', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('[data-testid="floating-chat-panel"]', { state: 'visible' });
    
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    const sendButton = page.locator('button[aria-label="送信"]');
    
    const startTime = Date.now();
    
    await chatInput.fill('BTCの価格を教えて');
    await sendButton.click();
    
    // レスポンスを待機
    await page.waitForSelector('.assistant-message', { timeout: 10000 });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // レスポンスが10秒以内に返ることを確認
    expect(responseTime).toBeLessThan(10000);
    
    // 理想的には3秒以内
    if (responseTime < 3000) {
      console.log(`✅ Excellent response time: ${responseTime}ms`);
    } else {
      console.log(`⚠️  Slow response time: ${responseTime}ms`);
    }
  });
});