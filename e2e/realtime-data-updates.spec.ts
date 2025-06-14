import { test, expect, Page } from '@playwright/test';

/**
 * リアルタイムデータ更新のE2Eテスト
 * - WebSocket接続
 * - 価格更新
 * - チャート更新
 * - インジケータ更新
 */

test.describe('Real-time Data Updates', () => {
  let wsMessages: any[] = [];

  test.beforeEach(async ({ page }) => {
    // WebSocketメッセージをキャプチャ
    wsMessages = [];
    page.on('websocket', ws => {
      ws.on('framereceived', event => {
        if (event.payload) {
          try {
            const data = JSON.parse(event.payload.toString());
            wsMessages.push(data);
          } catch (e) {
            // Binary or non-JSON data
          }
        }
      });
    });

    // アプリケーションを開く
    await page.goto('http://localhost:3000');
    
    // チャートコンテナが表示されるまで待機
    await page.waitForSelector('[data-testid="chart-container"]', {
      state: 'visible',
      timeout: 15000
    });

    // WebSocket接続が確立されるまで待機
    await page.waitForTimeout(2000);
  });

  test('WebSocket価格更新が正しく反映される', async ({ page }) => {
    // 価格表示要素を取得
    const priceDisplay = page.locator('[data-testid="price-display"]');
    
    // 初期価格を記録
    const initialPrice = await priceDisplay.textContent();
    console.log('Initial price:', initialPrice);

    // WebSocket経由の価格更新を待つ
    await page.waitForFunction(
      () => {
        const priceElement = document.querySelector('[data-testid="price-display"]');
        return priceElement && priceElement.textContent !== '';
      },
      { timeout: 10000 }
    );

    // 価格が更新されることを確認（最大30秒待機）
    let priceChanged = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const currentPrice = await priceDisplay.textContent();
      if (currentPrice !== initialPrice && currentPrice !== '') {
        priceChanged = true;
        console.log('Price changed to:', currentPrice);
        break;
      }
    }

    expect(priceChanged).toBeTruthy();

    // 価格変動インジケータの表示を確認
    const priceChange = page.locator('[data-testid="price-change"]');
    await expect(priceChange).toBeVisible();
    
    // 価格変動の色が正しいことを確認（緑または赤）
    const changeColor = await priceChange.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return styles.color;
    });
    
    expect(['rgb(34, 197, 94)', 'rgb(239, 68, 68)']).toContain(changeColor);
  });

  test('チャートキャンドルがリアルタイムで更新される', async ({ page }) => {
    // チャートAPIにアクセス
    const hasNewCandle = await page.evaluate(async () => {
      // Wait for chart instance
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const chartElement = document.querySelector('[data-testid="chart-container"]');
      if (!chartElement || !(chartElement as any).__chart) {
        console.log('Chart instance not found');
        return false;
      }

      const chart = (chartElement as any).__chart;
      const series = (chartElement as any).__mainSeries;
      
      if (!series) {
        console.log('Series not found');
        return false;
      }

      // 初期データ数を記録
      const initialDataCount = series.data?.length || 0;
      console.log('Initial candle count:', initialDataCount);

      // 新しいキャンドルが追加されるまで待つ（最大10秒）
      return new Promise<boolean>((resolve) => {
        let checkCount = 0;
        const checkInterval = setInterval(() => {
          const currentDataCount = series.data?.length || 0;
          console.log('Current candle count:', currentDataCount);
          
          if (currentDataCount > initialDataCount) {
            clearInterval(checkInterval);
            resolve(true);
          }
          
          checkCount++;
          if (checkCount > 20) { // 10秒経過
            clearInterval(checkInterval);
            resolve(false);
          }
        }, 500);
      });
    });

    // 新しいキャンドルが追加されたことを確認
    expect(hasNewCandle).toBeTruthy();
  });

  test('複数の銘柄で同時にデータ更新を受信できる', async ({ page }) => {
    // 最初の銘柄の価格を記録
    const btcPrice = await page.locator('[data-testid="price-display"]').textContent();
    
    // ETHUSDTに切り替え
    const symbolSelector = page.locator('[data-testid="symbol-selector"]');
    await symbolSelector.click();
    await page.locator('text="ETHUSDT"').click();
    
    // ETHの価格が表示されるまで待機
    await page.waitForFunction(
      (oldPrice) => {
        const priceElement = document.querySelector('[data-testid="price-display"]');
        return priceElement && priceElement.textContent !== oldPrice;
      },
      btcPrice,
      { timeout: 10000 }
    );

    const ethPrice = await page.locator('[data-testid="price-display"]').textContent();
    
    // BTCUSDTに戻る
    await symbolSelector.click();
    await page.locator('text="BTCUSDT"').click();
    
    // 価格が更新されることを確認
    await page.waitForFunction(
      (oldPrice) => {
        const priceElement = document.querySelector('[data-testid="price-display"]');
        return priceElement && priceElement.textContent !== oldPrice;
      },
      ethPrice,
      { timeout: 10000 }
    );

    // 両方の銘柄で価格が異なることを確認
    expect(btcPrice).not.toBe(ethPrice);
  });

  test('接続状態インジケータが正しく動作する', async ({ page }) => {
    // 接続状態インジケータを確認
    const connectionStatus = page.locator('[data-testid="connection-status"]');
    await expect(connectionStatus).toBeVisible();
    
    // 接続中の状態を確認
    await expect(connectionStatus).toHaveText(/接続中|Connected/i);
    
    // 接続インジケータの色を確認（緑色）
    const statusColor = await connectionStatus.evaluate(el => {
      const dot = el.querySelector('.h-2.w-2') || el.querySelector('[class*="bg-green"]');
      if (!dot) return null;
      const styles = window.getComputedStyle(dot);
      return styles.backgroundColor;
    });
    
    expect(statusColor).toMatch(/rgb\(34, 197, 94\)|rgba\(34, 197, 94|green/);
  });

  test('移動平均線がリアルタイムで更新される', async ({ page }) => {
    // インジケータパネルを開く
    const indicatorToggle = page.locator('[data-testid="indicator-toggle"]');
    if (await indicatorToggle.isVisible()) {
      await indicatorToggle.click();
    }

    // MA設定を有効化
    const ma7Toggle = page.locator('[data-testid="ma7-toggle"]');
    if (await ma7Toggle.isVisible()) {
      await ma7Toggle.click();
    }

    // MAラインが描画されるまで待機
    await page.waitForTimeout(2000);

    // MA値の更新を監視
    const maValueUpdated = await page.evaluate(async () => {
      return new Promise<boolean>((resolve) => {
        const chartElement = document.querySelector('[data-testid="chart-container"]');
        if (!chartElement || !(chartElement as any).__chart) {
          resolve(false);
          return;
        }

        // MA系列を探す
        const chart = (chartElement as any).__chart;
        let maSeries = null;
        
        // チャート内の全系列をチェック
        if (chart._private__seriesMap) {
          for (const [_, series] of chart._private__seriesMap) {
            if (series._private__options?.title?.includes('MA')) {
              maSeries = series;
              break;
            }
          }
        }

        if (!maSeries) {
          console.log('MA series not found');
          resolve(false);
          return;
        }

        // 初期値を記録
        const initialData = maSeries.data();
        const initialLastValue = initialData[initialData.length - 1]?.value;
        console.log('Initial MA value:', initialLastValue);

        // 値の変化を監視
        let checkCount = 0;
        const checkInterval = setInterval(() => {
          const currentData = maSeries.data();
          const currentLastValue = currentData[currentData.length - 1]?.value;
          
          if (currentLastValue !== initialLastValue) {
            console.log('MA value updated to:', currentLastValue);
            clearInterval(checkInterval);
            resolve(true);
          }
          
          checkCount++;
          if (checkCount > 20) { // 10秒経過
            clearInterval(checkInterval);
            resolve(false);
          }
        }, 500);
      });
    });

    expect(maValueUpdated).toBeTruthy();
  });

  test('ボリュームデータがリアルタイムで更新される', async ({ page }) => {
    // ボリューム表示を確認
    const volumeDisplay = page.locator('[data-testid="volume-display"]');
    
    if (await volumeDisplay.isVisible()) {
      // 初期ボリュームを記録
      const initialVolume = await volumeDisplay.textContent();
      console.log('Initial volume:', initialVolume);

      // ボリュームが更新されるまで待機
      let volumeChanged = false;
      for (let i = 0; i < 20; i++) {
        await page.waitForTimeout(1000);
        const currentVolume = await volumeDisplay.textContent();
        if (currentVolume !== initialVolume && currentVolume !== '') {
          volumeChanged = true;
          console.log('Volume changed to:', currentVolume);
          break;
        }
      }

      expect(volumeChanged).toBeTruthy();
    } else {
      // ボリュームがチャート内に表示されている場合
      const hasVolumeUpdate = await page.evaluate(async () => {
        const chartElement = document.querySelector('[data-testid="chart-container"]');
        if (!chartElement || !(chartElement as any).__chart) return false;

        const series = (chartElement as any).__mainSeries;
        if (!series || !series.data) return false;

        // 最新キャンドルのボリュームを監視
        const initialData = series.data();
        const initialVolume = initialData[initialData.length - 1]?.volume || 0;

        return new Promise<boolean>((resolve) => {
          let checkCount = 0;
          const checkInterval = setInterval(() => {
            const currentData = series.data();
            const currentVolume = currentData[currentData.length - 1]?.volume || 0;
            
            if (currentVolume !== initialVolume) {
              clearInterval(checkInterval);
              resolve(true);
            }
            
            checkCount++;
            if (checkCount > 20) {
              clearInterval(checkInterval);
              resolve(false);
            }
          }, 500);
        });
      });

      expect(hasVolumeUpdate).toBeTruthy();
    }
  });

  test('エラー時に再接続が自動的に行われる', async ({ page, context }) => {
    // ネットワークを一時的に切断
    await context.setOffline(true);
    
    // 切断状態の表示を確認
    await page.waitForTimeout(2000);
    const disconnectedStatus = page.locator('[data-testid="connection-status"]');
    await expect(disconnectedStatus).toContainText(/切断|Disconnected|再接続中/i);

    // ネットワークを復旧
    await context.setOffline(false);
    
    // 再接続を待つ
    await page.waitForFunction(
      () => {
        const status = document.querySelector('[data-testid="connection-status"]');
        return status && /接続中|Connected/i.test(status.textContent || '');
      },
      { timeout: 30000 }
    );

    // 再接続後の状態を確認
    await expect(disconnectedStatus).toContainText(/接続中|Connected/i);
    
    // データ更新が再開されることを確認
    const priceDisplay = page.locator('[data-testid="price-display"]');
    const priceBeforeReconnect = await priceDisplay.textContent();
    
    let priceUpdatedAfterReconnect = false;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1000);
      const currentPrice = await priceDisplay.textContent();
      if (currentPrice !== priceBeforeReconnect) {
        priceUpdatedAfterReconnect = true;
        break;
      }
    }
    
    expect(priceUpdatedAfterReconnect).toBeTruthy();
  });
});

// ヘルパー関数
async function waitForPriceUpdate(page: Page, initialPrice: string | null, timeout: number = 10000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const currentPrice = await page.locator('[data-testid="price-display"]').textContent();
    if (currentPrice !== initialPrice && currentPrice !== '') {
      return true;
    }
    await page.waitForTimeout(500);
  }
  
  return false;
}