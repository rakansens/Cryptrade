import { test, expect, Page } from '@playwright/test';

/**
 * AI機能とマルチエージェント連携のE2Eテスト
 * - 複雑な分析リクエストの処理
 * - エージェント間の連携
 * - プログレッシブな分析表示
 * - エラーハンドリング
 */

test.describe('AI Multi-Agent Coordination', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // アプリケーションの完全な初期化を待機
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="chart-container"]', {
      state: 'visible',
      timeout: 15000
    });
    
    // AI機能の準備完了を待機
    await page.waitForSelector('[data-testid="chat-input"]', {
      state: 'visible',
      timeout: 10000
    });
    
    // エージェントシステムの初期化を待機
    await page.waitForTimeout(2000);
  });

  test('複雑な分析リクエストのマルチエージェント処理', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    
    // 複雑な分析リクエストを送信
    await chatInput.fill('BTCの総合的な分析を実行してください。トレンドライン、サポート・レジスタンス、パターン認識、複数時間足の分析を含めてください。');
    await chatInput.press('Enter');

    // プログレスインジケータの表示を確認
    await expect(page.locator('[data-testid="analysis-progress"]')).toBeVisible({ timeout: 5000 });

    // 各エージェントの進捗を監視
    const agentStatuses = {
      orchestrator: false,
      trading: false,
      chartControl: false,
      patternRecognition: false
    };

    // エージェントの活動ログを監視
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[OrchestratorAgent]')) agentStatuses.orchestrator = true;
      if (text.includes('[TradingAgent]')) agentStatuses.trading = true;
      if (text.includes('[ChartControlAgent]')) agentStatuses.chartControl = true;
      if (text.includes('[PatternRecognition]')) agentStatuses.patternRecognition = true;
    });

    // 分析完了を待機（最大60秒）
    await page.waitForSelector('[data-testid="analysis-complete"]', {
      state: 'visible',
      timeout: 60000
    });

    // 複数のエージェントが活動したことを確認
    const activeAgents = Object.values(agentStatuses).filter(status => status).length;
    expect(activeAgents).toBeGreaterThanOrEqual(2);

    // 結果に複数の分析要素が含まれていることを確認
    const analysisResult = page.locator('[data-testid="analysis-result"]');
    await expect(analysisResult).toContainText(/トレンドライン|サポート|レジスタンス/);
    await expect(analysisResult).toContainText(/パターン|形成|認識/);
  });

  test('段階的な分析結果の表示（ストリーミング）', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    
    // ストリーミング分析を要求
    await chatInput.fill('リアルタイムで段階的に分析を表示しながら、現在のチャートを分析してください');
    await chatInput.press('Enter');

    // ストリーミング開始を確認
    const streamingIndicator = page.locator('[data-testid="streaming-indicator"]');
    await expect(streamingIndicator).toBeVisible({ timeout: 5000 });

    // 段階的にコンテンツが追加されることを確認
    const messageContent = page.locator('[data-testid="message-content"]').last();
    
    let previousLength = 0;
    let increasingCount = 0;
    
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1000);
      const currentText = await messageContent.textContent() || '';
      const currentLength = currentText.length;
      
      if (currentLength > previousLength) {
        increasingCount++;
      }
      
      previousLength = currentLength;
      
      // 早期終了条件
      if (increasingCount >= 3) break;
    }

    expect(increasingCount).toBeGreaterThanOrEqual(2);
    
    // ストリーミング完了を確認
    await expect(streamingIndicator).not.toBeVisible({ timeout: 30000 });
  });

  test('エージェント間の協調動作とデータ共有', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    
    // 協調動作が必要なタスクを要求
    await chatInput.fill('過去のパターンを分析し、類似パターンを現在のチャートで検出して、自動的に描画してください');
    await chatInput.press('Enter');

    // エージェント間通信のログを収集
    const agentCommunications: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('Agent communication:') || 
          msg.text().includes('Data shared between agents:')) {
        agentCommunications.push(msg.text());
      }
    });

    // 処理完了を待機
    await page.waitForSelector('[data-testid="pattern-detection-complete"]', {
      state: 'visible',
      timeout: 45000
    });

    // エージェント間でデータが共有されたことを確認
    expect(agentCommunications.length).toBeGreaterThan(0);

    // パターンが検出され描画されたことを確認
    const patternDrawings = await page.evaluate(() => {
      const store = (window as any).__chartStore;
      const drawings = store?.getState()?.drawings || [];
      return drawings.filter((d: any) => d.metadata?.source === 'pattern-detection');
    });

    expect(patternDrawings.length).toBeGreaterThan(0);
  });

  test('AIメモリ機能の動作確認', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    
    // 初回の分析リクエスト
    await chatInput.fill('私の好みの分析スタイルを覚えてください: 私は4時間足でのトレンドライン分析を好みます');
    await chatInput.press('Enter');
    await page.waitForTimeout(3000);

    // メモリに保存されたことを確認
    await expect(page.locator('text=/記憶しました|覚えました|保存しました/')).toBeVisible({ timeout: 10000 });

    // 2回目のリクエストでメモリが活用されることを確認
    await chatInput.fill('私の好みに基づいて分析を実行してください');
    await chatInput.press('Enter');

    // メモリが参照されたことを確認
    const analysisResult = await page.waitForSelector('[data-testid="analysis-result"]', {
      state: 'visible',
      timeout: 30000
    });

    await expect(analysisResult).toContainText(/4時間足|4H|トレンドライン/);

    // メモリの内容を確認（デバッグ用）
    const memoryContent = await page.evaluate(() => {
      const memoryStore = (window as any).__memoryStore;
      return memoryStore?.getState()?.memories || [];
    });

    expect(memoryContent.length).toBeGreaterThan(0);
  });

  test('エラーハンドリングと自動リトライ', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    
    // エラーを誘発する可能性のあるリクエスト
    await chatInput.fill('存在しない銘柄XYZABCの分析を実行してください');
    await chatInput.press('Enter');

    // エラーメッセージまたはフォールバック処理を確認
    const errorHandled = await Promise.race([
      page.waitForSelector('[data-testid="error-message"]', { timeout: 10000 }).then(() => 'error'),
      page.waitForSelector('text=/代わりに|利用できません|見つかりません/', { timeout: 10000 }).then(() => 'fallback')
    ]);

    expect(['error', 'fallback']).toContain(errorHandled);

    // 自動的に代替案が提示されることを確認
    if (errorHandled === 'fallback') {
      await expect(page.locator('text=/BTCUSDT|ETHUSDT|代替/')).toBeVisible({ timeout: 5000 });
    }
  });

  test('複数言語での分析リクエスト', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    
    // 日本語でのリクエスト
    await chatInput.fill('現在のビットコインの上昇トレンドを分析して、エントリーポイントを提案してください');
    await chatInput.press('Enter');

    // 日本語での応答を確認
    const japaneseResponse = await page.waitForSelector('[data-testid="message-content"]:has-text("トレンド")', {
      state: 'visible',
      timeout: 30000
    });

    await expect(japaneseResponse).toContainText(/上昇|エントリー|ポイント/);

    // 英語でのリクエスト
    await chatInput.fill('Analyze the support and resistance levels for the current chart');
    await chatInput.press('Enter');

    // 英語での応答を確認
    const englishResponse = await page.waitForSelector('[data-testid="message-content"]:has-text("support")', {
      state: 'visible',
      timeout: 30000
    });

    await expect(englishResponse).toContainText(/support|resistance|level/i);
  });

  test('AIによる自動取引戦略の生成', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    
    // 取引戦略の生成を要求
    await chatInput.fill('現在の市場状況に基づいて、リスク管理を含む完全な取引戦略を生成してください');
    await chatInput.press('Enter');

    // 戦略生成の完了を待機
    const strategyResult = await page.waitForSelector('[data-testid="trading-strategy"]', {
      state: 'visible',
      timeout: 45000
    });

    // 戦略に必要な要素が含まれていることを確認
    await expect(strategyResult).toContainText(/エントリー|Entry/);
    await expect(strategyResult).toContainText(/ストップロス|Stop Loss|SL/);
    await expect(strategyResult).toContainText(/テイクプロフィット|Take Profit|TP/);
    await expect(strategyResult).toContainText(/リスク|Risk/);

    // 視覚的な戦略表示（チャート上のマーカー）を確認
    const strategyMarkers = await page.evaluate(() => {
      const chartElement = document.querySelector('[data-testid="chart-container"]');
      if (!chartElement || !(chartElement as any).__mainSeries) return 0;
      
      const series = (chartElement as any).__mainSeries;
      const markers = series.markers() || [];
      return markers.filter((m: any) => m.text?.includes('Entry') || m.text?.includes('SL') || m.text?.includes('TP')).length;
    });

    expect(strategyMarkers).toBeGreaterThan(0);
  });

  test('AIアシスタントの学習と改善', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]');
    
    // フィードバック付きの分析を複数回実行
    for (let i = 0; i < 3; i++) {
      // 分析リクエスト
      await chatInput.fill(`分析 ${i + 1}: 現在のトレンドを分析してください`);
      await chatInput.press('Enter');
      
      // 分析完了を待機
      await page.waitForTimeout(5000);
      
      // フィードバックを提供
      const feedbackButton = page.locator('[data-testid="feedback-button"]').last();
      if (await feedbackButton.isVisible()) {
        await feedbackButton.click();
        
        const feedbackDialog = page.locator('[data-testid="feedback-dialog"]');
        if (await feedbackDialog.isVisible()) {
          // ポジティブフィードバック
          await feedbackDialog.locator('button[data-rating="positive"]').click();
          await feedbackDialog.locator('textarea').fill('分析が的確でした');
          await feedbackDialog.locator('button:has-text("送信")').click();
        }
      }
      
      await page.waitForTimeout(2000);
    }

    // 学習の効果を確認（より詳細な分析が提供されるようになる）
    await chatInput.fill('これまでの私のフィードバックを考慮して、最適な分析を提供してください');
    await chatInput.press('Enter');

    const improvedAnalysis = await page.waitForSelector('[data-testid="analysis-result"]', {
      state: 'visible',
      timeout: 30000
    });

    // 改善された分析の特徴を確認
    const analysisText = await improvedAnalysis.textContent() || '';
    expect(analysisText.length).toBeGreaterThan(200); // より詳細な分析
    expect(analysisText).toMatch(/考慮|基づいて|フィードバック/); // フィードバックへの言及
  });
});

// ヘルパー関数
async function waitForAgentActivity(page: Page, agentName: string, timeout: number = 30000): Promise<boolean> {
  return new Promise((resolve) => {
    let found = false;
    const listener = (msg: any) => {
      if (msg.text().includes(`[${agentName}]`)) {
        found = true;
        page.off('console', listener);
        resolve(true);
      }
    };
    
    page.on('console', listener);
    
    setTimeout(() => {
      page.off('console', listener);
      resolve(found);
    }, timeout);
  });
}

async function getAnalysisProgress(page: Page): Promise<number> {
  const progressBar = page.locator('[data-testid="analysis-progress-bar"]');
  if (!await progressBar.isVisible()) return 0;
  
  const progressValue = await progressBar.getAttribute('aria-valuenow');
  return parseInt(progressValue || '0', 10);
}