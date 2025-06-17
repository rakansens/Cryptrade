const puppeteer = require('puppeteer');

async function testPatternDeletion() {
  console.log('🔍 パターン削除テスト開始...');
  
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    defaultViewport: { width: 1400, height: 900 }
  });
  
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[PatternRenderer]') || 
        text.includes('[Agent Event]') || 
        text.includes('[ChatPanel]') ||
        text.includes('pattern') ||
        text.includes('metric')) {
      console.log(`[Browser Console] ${text}`);
    }
  });
  
  page.on('pageerror', error => {
    console.error(`[Page Error] ${error.message}`);
  });
  
  try {
    console.log('📄 ページを開いています...');
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(5000);
    
    // AI入力エリアを待つ
    console.log('💬 AI入力エリアを探しています...');
    await page.waitForSelector('textarea[placeholder*="メッセージ"]', { timeout: 30000 });
    
    // パターン認識の提案を要求
    console.log('📝 パターン認識を要求...');
    await page.type('textarea[placeholder*="メッセージ"]', 'チャート上でヘッドアンドショルダーパターンを探して、TP/SL/BOラインを含めて描画してください');
    
    // エンターキーを押す
    await page.keyboard.press('Enter');
    
    // 提案が表示されるのを待つ
    console.log('⏳ AI提案を待っています...');
    await page.waitForTimeout(8000);
    
    // 承認ボタンを探す
    console.log('✅ 承認ボタンを探しています...');
    const approveButton = await page.$('button[title="承認"]');
    if (approveButton) {
      console.log('✅ 承認ボタンをクリック...');
      await approveButton.click();
      await page.waitForTimeout(2000);
      
      // パターンが描画されるのを待つ
      console.log('📊 パターンが描画されるのを待っています...');
      await page.waitForTimeout(3000);
      
      // 取り消しボタンを探す
      console.log('🔍 取り消しボタンを探しています...');
      await page.waitForSelector('button:has-text("取り消し")', { timeout: 5000 });
      
      // PatternRendererの状態を確認
      console.log('📋 PatternRenderer状態を取得...');
      const rendererState = await page.evaluate(() => {
        // PatternRendererのデバッグ状態を取得
        const event = new CustomEvent('debug:getPatternRendererState');
        window.dispatchEvent(event);
        
        // チャートのパターン状態を返す
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              timestamp: new Date().toISOString(),
              hasPatternRenderer: typeof window.patternRenderer !== 'undefined'
            });
          }, 1000);
        });
      });
      
      console.log('📋 PatternRenderer状態:', rendererState);
      
      // 取り消しボタンをクリック
      console.log('❌ 取り消しボタンをクリック...');
      const cancelButton = await page.$('button:has-text("取り消し")');
      if (cancelButton) {
        await cancelButton.click();
        
        // 削除後の確認
        console.log('⏳ 削除処理を待っています...');
        await page.waitForTimeout(3000);
        
        // チャート上の要素を確認
        console.log('🔍 チャート上の要素を確認...');
        const chartElements = await page.evaluate(() => {
          const chart = document.querySelector('.tv-lightweight-charts');
          if (!chart) return { hasChart: false };
          
          // SVG要素や線を数える
          const svgElements = chart.querySelectorAll('svg');
          const paths = chart.querySelectorAll('path');
          const lines = chart.querySelectorAll('line');
          
          return {
            hasChart: true,
            svgCount: svgElements.length,
            pathCount: paths.length,
            lineCount: lines.length
          };
        });
        
        console.log('📊 チャート要素:', chartElements);
        
        if (chartElements.lineCount > 0) {
          console.log('⚠️  まだ線が残っています！');
        } else {
          console.log('✅ すべての線が削除されました');
        }
      }
    } else {
      console.log('❌ 承認ボタンが見つかりませんでした');
    }
    
  } catch (error) {
    console.error('❌ テスト中にエラーが発生:', error);
  }
  
  console.log('\n🔍 テスト完了。ブラウザは開いたままです。手動で確認してください。');
  console.log('終了するにはCtrl+Cを押してください。');
}

testPatternDeletion().catch(console.error);