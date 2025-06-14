const puppeteer = require('puppeteer');

async function testStyleEditorIntegration() {
  console.log('=== スタイル編集機能統合テスト ===\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  try {
    const page = await browser.newPage();
    
    // コンソールログを記録
    const logs = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push({ type: msg.type(), text });
      
      if (text.includes('[StyleEditor]') || text.includes('[Agent Event]') || 
          text.includes('Failed') || text.includes('error')) {
        console.log(`[Browser ${msg.type()}] ${text}`);
      }
    });
    
    // エラーを記録
    const errors = [];
    page.on('pageerror', error => {
      errors.push(error.message);
      console.error(`[Page Error] ${error.message}`);
    });
    
    console.log('1. アプリケーションを読み込み中...');
    await page.goto('http://localhost:3004', { waitUntil: 'networkidle0' });
    await page.waitForTimeout(3000);
    
    // チャートが準備できるまで待機
    console.log('2. チャートの初期化を待機中...');
    await page.waitForSelector('[data-testid="chart-container"]', { timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // パターン認識の提案を作成
    console.log('3. パターン認識提案を作成中...');
    await page.evaluate(() => {
      // チャットパネルに提案を追加
      const event = new CustomEvent('test:addProposal', {
        detail: {
          id: 'test_pattern_' + Date.now(),
          type: 'pattern',
          timestamp: new Date().toISOString(),
          drawingData: {
            type: 'pattern',
            patternType: 'head_and_shoulders',
            points: [
              { time: Date.now() / 1000 - 7200, value: 44000 },
              { time: Date.now() / 1000 - 3600, value: 46000 },
              { time: Date.now() / 1000, value: 44500 }
            ],
            metrics: {
              targetPrice: 47000,
              stopLoss: 43000,
              breakoutLevel: 45500,
              confidence: 0.85
            },
            style: {
              color: '#22c55e',
              lineWidth: 2,
              lineStyle: 'solid',
              showLabels: true
            },
            metadata: {
              patternType: 'head_and_shoulders',
              confidence: 0.85
            }
          },
          message: 'ヘッドアンドショルダーパターンを検出しました'
        }
      });
      window.dispatchEvent(event);
    });
    
    await page.waitForTimeout(2000);
    
    // 提案を承認
    console.log('4. 提案を承認中...');
    const approveButton = await page.$('button:has-text("承認")');
    if (approveButton) {
      await approveButton.click();
      console.log('   提案を承認しました');
    }
    
    await page.waitForTimeout(2000);
    
    // スタイルエディタが表示されるか確認
    console.log('5. スタイルエディタを確認中...');
    const styleEditorButton = await page.$('button:has-text("スタイル")');
    if (!styleEditorButton) {
      throw new Error('スタイルエディタボタンが見つかりません');
    }
    
    console.log('   スタイルエディタボタンが見つかりました');
    await styleEditorButton.click();
    await page.waitForTimeout(1000);
    
    // 色を変更
    console.log('6. 色を変更中...');
    const colorInput = await page.$('input[type="text"][placeholder="#22c55e"]');
    if (colorInput) {
      await colorInput.click({ clickCount: 3 });
      await colorInput.type('#3b82f6');
      await page.keyboard.press('Enter');
      console.log('   色を #3b82f6 に変更しました');
    }
    
    await page.waitForTimeout(1000);
    
    // 線幅を変更
    console.log('7. 線幅を変更中...');
    const lineWidthSlider = await page.$('input[type="range"][min="1"][max="10"]');
    if (lineWidthSlider) {
      await lineWidthSlider.evaluate(el => el.value = '4');
      await lineWidthSlider.evaluate(el => el.dispatchEvent(new Event('input', { bubbles: true })));
      await lineWidthSlider.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
      console.log('   線幅を 4 に変更しました');
    }
    
    await page.waitForTimeout(1000);
    
    // プリセットタブをテスト
    console.log('8. プリセットタブをテスト中...');
    const presetsTab = await page.$('button[role="tab"]:has-text("プリセット")');
    if (presetsTab) {
      await presetsTab.click();
      await page.waitForTimeout(500);
      
      const professionalPreset = await page.$('button:has-text("プロフェッショナル")');
      if (professionalPreset) {
        await professionalPreset.click();
        console.log('   プロフェッショナルプリセットを適用しました');
      }
    }
    
    await page.waitForTimeout(1000);
    
    // パターンタブをテスト
    console.log('9. パターンタブをテスト中...');
    const patternTab = await page.$('button[role="tab"]:has-text("パターン")');
    if (patternTab) {
      await patternTab.click();
      await page.waitForTimeout(500);
      
      const opacitySlider = await page.$('input[type="range"][min="0"][max="1"]');
      if (opacitySlider) {
        await opacitySlider.evaluate(el => el.value = '0.3');
        await opacitySlider.evaluate(el => el.dispatchEvent(new Event('input', { bubbles: true })));
        console.log('   パターン塗りつぶし透明度を 30% に変更しました');
      }
    }
    
    await page.waitForTimeout(2000);
    
    // 結果を確認
    console.log('\n10. テスト結果を確認中...');
    
    const styleUpdateLogs = logs.filter(log => 
      log.text.includes('Style update') || 
      log.text.includes('スタイルを更新しました')
    );
    
    console.log(`\n=== テスト結果サマリー ===`);
    console.log(`スタイル更新ログ: ${styleUpdateLogs.length}件`);
    console.log(`エラー: ${errors.length}件`);
    
    if (errors.length > 0) {
      console.log('\nエラー詳細:');
      errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    if (styleUpdateLogs.length > 0) {
      console.log('\nスタイル更新イベント:');
      styleUpdateLogs.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.text}`);
      });
    }
    
    // スクリーンショットを保存
    console.log('\n11. スクリーンショットを保存中...');
    await page.screenshot({ 
      path: 'test-style-editor-result.png',
      fullPage: true 
    });
    console.log('   スクリーンショットを test-style-editor-result.png に保存しました');
    
    console.log('\n✅ スタイル編集機能統合テスト完了');
    
  } catch (error) {
    console.error('\n❌ テストエラー:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// テスト実行
testStyleEditorIntegration()
  .then(() => {
    console.log('\n✅ すべてのテストが正常に完了しました');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ テストが失敗しました:', error);
    process.exit(1);
  });