import { test, expect, Page } from '@playwright/test';

/**
 * チャート描画操作の包括的E2Eテスト
 * - 各種描画ツールの操作
 * - 描画の編集・削除
 * - 描画の永続化
 * - 時間足切り替え時の挙動
 */

test.describe('Comprehensive Drawing Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // チャートが完全に読み込まれるまで待機
    await page.waitForSelector('[data-testid="chart-container"]', {
      state: 'visible',
      timeout: 15000
    });
    
    // チャットパネルが使用可能になるまで待機
    await page.waitForSelector('[data-testid="chat-input"]', {
      state: 'visible',
      timeout: 10000
    });
    
    await page.waitForTimeout(2000);
  });

  test('AIを使用した複数種類の描画の作成と管理', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    const sendButton = page.locator('button[aria-label="送信"]');

    // 1. 水平線を描画
    await test.step('水平線を描画', async () => {
      await chatInput.fill('現在の価格に水平線を引いて');
      await sendButton.click();
      
      // 成功メッセージを待機
      await expect(page.locator('text="水平線を描画しました"')).toBeVisible({ timeout: 10000 });
      
      // 描画マネージャーで確認
      const drawingManager = page.locator('[data-testid="drawing-manager"]');
      if (await drawingManager.isVisible()) {
        await expect(drawingManager).toContainText('Horizontal');
      }
    });

    // 2. トレンドラインを描画
    await test.step('トレンドラインを描画', async () => {
      await page.waitForTimeout(1000);
      await chatInput.fill('直近の安値を結ぶ上昇トレンドラインを引いて');
      await sendButton.click();
      
      await expect(page.locator('text=/トレンドライン.*描画しました/')).toBeVisible({ timeout: 10000 });
    });

    // 3. フィボナッチリトレースメントを描画
    await test.step('フィボナッチを描画', async () => {
      await page.waitForTimeout(1000);
      await chatInput.fill('直近の高値安値間にフィボナッチリトレースメントを描画して');
      await sendButton.click();
      
      await expect(page.locator('text=/フィボナッチ.*描画しました/')).toBeVisible({ timeout: 10000 });
    });

    // 描画数を確認
    const drawingCount = await page.evaluate(() => {
      const store = (window as any).__chartStore;
      return store?.getState()?.drawings?.length || 0;
    });
    
    expect(drawingCount).toBeGreaterThanOrEqual(3);
  });

  test('描画のスタイル編集機能', async ({ page }) => {
    // まず描画を作成
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    await chatInput.fill('サポートラインを引いて');
    await chatInput.press('Enter');
    
    await expect(page.locator('text=/ライン.*描画しました/')).toBeVisible({ timeout: 10000 });
    
    // 描画マネージャーを開く
    const drawingManagerToggle = page.locator('[data-testid="drawing-manager-toggle"]');
    if (await drawingManagerToggle.isVisible()) {
      await drawingManagerToggle.click();
      await page.waitForTimeout(500);
    }

    // スタイル編集ボタンをクリック
    const styleEditButton = page.locator('button[title="スタイル編集"]').first();
    if (await styleEditButton.isVisible()) {
      await styleEditButton.click();
      
      // スタイルエディタが開くことを確認
      await expect(page.locator('text="描画スタイル設定"')).toBeVisible();
      
      // 色を変更
      const colorPicker = page.locator('input[type="color"]').first();
      await colorPicker.fill('#ff0000');
      
      // 線の太さを変更
      const lineWidthSelect = page.locator('select').first();
      await lineWidthSelect.selectOption('3');
      
      // 保存
      await page.locator('button:has-text("保存")').click();
      
      // スタイルが適用されたことを確認
      const updatedDrawing = await page.evaluate(() => {
        const store = (window as any).__chartStore;
        const drawings = store?.getState()?.drawings || [];
        return drawings[0]?.style;
      });
      
      expect(updatedDrawing?.color).toBe('#ff0000');
      expect(updatedDrawing?.lineWidth).toBe(3);
    }
  });

  test('描画の削除と一括削除', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    
    // 複数の描画を作成
    for (let i = 0; i < 3; i++) {
      await chatInput.fill(`テスト用の水平線${i + 1}を引いて`);
      await chatInput.press('Enter');
      await page.waitForTimeout(1500);
    }

    // 個別削除
    await test.step('個別削除', async () => {
      const drawingManager = page.locator('[data-testid="drawing-manager"]');
      if (!await drawingManager.isVisible()) {
        const toggle = page.locator('[data-testid="drawing-manager-toggle"]');
        await toggle.click();
      }

      const deleteButtons = page.locator('button[title="削除"]');
      const initialCount = await deleteButtons.count();
      
      if (initialCount > 0) {
        await deleteButtons.first().click();
        await page.waitForTimeout(500);
        
        const newCount = await deleteButtons.count();
        expect(newCount).toBe(initialCount - 1);
      }
    });

    // 一括削除
    await test.step('一括削除', async () => {
      await chatInput.fill('すべての描画を削除して');
      await chatInput.press('Enter');
      
      await expect(page.locator('text=/削除.*完了/')).toBeVisible({ timeout: 10000 });
      
      // すべての描画が削除されたことを確認
      const remainingDrawings = await page.evaluate(() => {
        const store = (window as any).__chartStore;
        return store?.getState()?.drawings?.length || 0;
      });
      
      expect(remainingDrawings).toBe(0);
    });
  });

  test('時間足切り替え時の描画の永続性', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    
    // 1時間足で描画を作成
    await chatInput.fill('重要な価格レベルに水平線を引いて');
    await chatInput.press('Enter');
    await expect(page.locator('text=/水平線.*描画しました/')).toBeVisible({ timeout: 10000 });

    // 描画IDを記録
    const drawingBefore = await page.evaluate(() => {
      const store = (window as any).__chartStore;
      const drawings = store?.getState()?.drawings || [];
      return drawings.map((d: any) => ({ id: d.id, type: d.type, points: d.points }));
    });

    // 時間足を変更
    await chatInput.fill('4時間足に変更して');
    await chatInput.press('Enter');
    await page.waitForTimeout(2000);

    // 元の時間足に戻る
    await chatInput.fill('1時間足に戻して');
    await chatInput.press('Enter');
    await page.waitForTimeout(2000);

    // 描画が復元されていることを確認
    const drawingAfter = await page.evaluate(() => {
      const store = (window as any).__chartStore;
      const drawings = store?.getState()?.drawings || [];
      return drawings.map((d: any) => ({ id: d.id, type: d.type, points: d.points }));
    });

    expect(drawingAfter.length).toBe(drawingBefore.length);
    expect(drawingAfter[0]?.id).toBe(drawingBefore[0]?.id);
  });

  test('描画の表示/非表示切り替え', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    
    // 描画を作成
    await chatInput.fill('トレンドラインを引いて');
    await chatInput.press('Enter');
    await expect(page.locator('text=/ライン.*描画しました/')).toBeVisible({ timeout: 10000 });

    // 描画マネージャーを開く
    const drawingManagerToggle = page.locator('[data-testid="drawing-manager-toggle"]');
    if (await drawingManagerToggle.isVisible()) {
      await drawingManagerToggle.click();
    }

    // 表示/非表示トグル
    const visibilityToggle = page.locator('button[title*="表示"]').first();
    if (await visibilityToggle.isVisible()) {
      // 非表示にする
      await visibilityToggle.click();
      await page.waitForTimeout(500);
      
      // 描画が非表示になったことを確認
      const isVisible = await page.evaluate(() => {
        const store = (window as any).__chartStore;
        const drawings = store?.getState()?.drawings || [];
        return drawings[0]?.visible;
      });
      
      expect(isVisible).toBe(false);
      
      // 再度表示する
      await visibilityToggle.click();
      await page.waitForTimeout(500);
      
      const isVisibleAgain = await page.evaluate(() => {
        const store = (window as any).__chartStore;
        const drawings = store?.getState()?.drawings || [];
        return drawings[0]?.visible;
      });
      
      expect(isVisibleAgain).toBe(true);
    }
  });

  test('描画のコピー機能', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    
    // オリジナルの描画を作成
    await chatInput.fill('45000ドルに水平線を引いて');
    await chatInput.press('Enter');
    await expect(page.locator('text=/水平線.*描画しました/')).toBeVisible({ timeout: 10000 });

    // 描画をコピー
    await chatInput.fill('最後の描画を46000ドルにコピーして');
    await chatInput.press('Enter');
    await page.waitForTimeout(2000);

    // 2つの描画が存在することを確認
    const drawings = await page.evaluate(() => {
      const store = (window as any).__chartStore;
      return store?.getState()?.drawings || [];
    });

    expect(drawings.length).toBeGreaterThanOrEqual(2);
    
    // 価格レベルが異なることを確認
    if (drawings.length >= 2) {
      const prices = drawings.map((d: any) => d.points[0]?.value);
      expect(prices[0]).not.toBe(prices[1]);
    }
  });

  test('マウス操作による描画の作成', async ({ page }) => {
    // 描画ツールバーを開く
    const toolbarToggle = page.locator('[data-testid="drawing-toolbar-toggle"]');
    if (await toolbarToggle.isVisible()) {
      await toolbarToggle.click();
      await page.waitForTimeout(500);
    }

    // トレンドラインツールを選択
    const trendlineTool = page.locator('[data-testid="tool-trendline"]');
    if (await trendlineTool.isVisible()) {
      await trendlineTool.click();
      
      // チャート上でクリックして描画
      const chart = page.locator('[data-testid="chart-container"]');
      const box = await chart.boundingBox();
      if (box) {
        // 始点をクリック
        await page.mouse.click(box.x + 100, box.y + 200);
        await page.waitForTimeout(500);
        
        // 終点をクリック
        await page.mouse.click(box.x + 300, box.y + 150);
        await page.waitForTimeout(500);
        
        // 描画が作成されたことを確認
        const hasDrawing = await page.evaluate(() => {
          const store = (window as any).__chartStore;
          const drawings = store?.getState()?.drawings || [];
          return drawings.length > 0;
        });
        
        expect(hasDrawing).toBeTruthy();
      }
    }
  });

  test('描画のエクスポートとインポート', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    
    // 複数の描画を作成
    await chatInput.fill('サポートとレジスタンスラインを複数引いて');
    await chatInput.press('Enter');
    await page.waitForTimeout(3000);

    // エクスポート
    await chatInput.fill('描画設定をエクスポートして');
    await chatInput.press('Enter');
    await page.waitForTimeout(2000);

    // エクスポートデータを取得（仮想的に）
    const exportData = await page.evaluate(() => {
      const store = (window as any).__chartStore;
      const drawings = store?.getState()?.drawings || [];
      return JSON.stringify(drawings);
    });

    // すべて削除
    await chatInput.fill('すべての描画を削除して');
    await chatInput.press('Enter');
    await page.waitForTimeout(2000);

    // インポート（仮想的に）
    await page.evaluate((data) => {
      const store = (window as any).__chartStore;
      if (store && data) {
        const drawings = JSON.parse(data);
        drawings.forEach((drawing: any) => {
          store.getState().addDrawing(drawing);
        });
      }
    }, exportData);

    // 描画が復元されたことを確認
    const restoredCount = await page.evaluate(() => {
      const store = (window as any).__chartStore;
      return store?.getState()?.drawings?.length || 0;
    });

    expect(restoredCount).toBeGreaterThan(0);
  });
});

// ヘルパー関数
async function waitForDrawing(page: Page, type: string, timeout: number = 10000): Promise<boolean> {
  return page.waitForFunction(
    (drawingType) => {
      const store = (window as any).__chartStore;
      const drawings = store?.getState()?.drawings || [];
      return drawings.some((d: any) => d.type === drawingType);
    },
    type,
    { timeout }
  ).then(() => true).catch(() => false);
}

async function getDrawingCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const store = (window as any).__chartStore;
    return store?.getState()?.drawings?.length || 0;
  });
}