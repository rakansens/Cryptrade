#!/usr/bin/env node

/**
 * E2E Test for UI Events using Puppeteer
 * SSE → Event → Chart Drawing の全フローをテスト
 */

const puppeteer = require('puppeteer');

async function testUIEvents() {
  console.log('🚀 Starting UI Events E2E Test...\n');
  
  let browser;
  let page;
  
  try {
    // 1. ブラウザ起動
    console.log('[1] Launching browser...');
    browser = await puppeteer.launch({
      headless: false, // 画面を表示
      devtools: true,  // DevToolsを開く
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    
    // コンソールログを捕捉
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[UI-Event]') || 
          text.includes('[Global Debug]') || 
          text.includes('[FloatingChatPanel]') ||
          text.includes('SSE')) {
        console.log(`[Browser Console] ${msg.type()}: ${text}`);
      }
    });
    
    // エラーを捕捉
    page.on('error', err => {
      console.error('[Browser Error]', err);
    });
    
    page.on('pageerror', err => {
      console.error('[Page Error]', err);
    });
    
    // 2. アプリケーションを開く
    console.log('\n[2] Navigating to app...');
    await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // ページロード待機
    await page.waitForTimeout(3000);
    console.log('✓ Page loaded');
    
    // 3. SSE接続状態を確認
    console.log('\n[3] Checking SSE connection...');
    const sseConnected = await page.evaluate(() => {
      return new Promise((resolve) => {
        // EventSourceの状態を確認
        let hasEventSource = false;
        
        // Network経由でSSEを確認（デバッグ用）
        const checkSSE = () => {
          const performance = window.performance.getEntriesByType('resource');
          const sseEntry = performance.find(entry => entry.name.includes('ui-events/stream'));
          if (sseEntry) {
            console.log('[Test] SSE endpoint found:', sseEntry.name);
            hasEventSource = true;
          }
        };
        
        checkSSE();
        
        // グローバルイベントリスナーを設定
        window.addEventListener('draw:trendline', (e) => {
          console.log('[Test] draw:trendline event received!', e.detail);
          window._lastTrendlineEvent = e.detail;
        });
        
        setTimeout(() => resolve(hasEventSource), 2000);
      });
    });
    
    console.log('SSE Connected:', sseConnected);
    
    // 4. 手動でイベントを発火してテスト
    console.log('\n[4] Testing manual event dispatch...');
    const manualTestResult = await page.evaluate(() => {
      const testData = {
        points: [
          {x: 100, y: 200, price: 105000, time: Date.now()},
          {x: 300, y: 150, price: 106000, time: Date.now() + 3600000}
        ],
        style: {
          color: '#ff0000',
          lineWidth: 3,
          lineStyle: 'solid',
          showLabels: true
        }
      };
      
      console.log('[Test] Dispatching manual draw:trendline event...');
      window.dispatchEvent(new CustomEvent('draw:trendline', { detail: testData }));
      
      // イベントが受信されたか確認
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            eventReceived: !!window._lastTrendlineEvent,
            eventData: window._lastTrendlineEvent
          });
        }, 1000);
      });
    });
    
    console.log('Manual test result:', manualTestResult);
    
    // 5. チャットパネルを開く
    console.log('\n[5] Opening chat panel...');
    
    // チャットボタンを探して開く（複数の可能性に対応）
    const chatOpened = await page.evaluate(() => {
      // 方法1: AIボタンを探す
      const aiButton = Array.from(document.querySelectorAll('button')).find(
        btn => btn.textContent?.includes('AI') || btn.textContent?.includes('Chat')
      );
      if (aiButton) {
        aiButton.click();
        return true;
      }
      
      // 方法2: 既に開いているか確認
      const chatPanel = document.querySelector('[class*="FloatingChatPanel"]');
      return !!chatPanel;
    });
    
    if (!chatOpened) {
      console.log('⚠️  Chat panel not found, trying floating panel...');
      // FloatingChatPanelが既に表示されているか確認
      const hasChatPanel = await page.$('[class*="chat"]');
      console.log('Has chat elements:', !!hasChatPanel);
    }
    
    await page.waitForTimeout(2000);
    
    // 6. チャットでトレンドライン描画を依頼
    console.log('\n[6] Sending chat message...');
    
    // チャット入力欄を探す
    const chatInput = await page.$('textarea[placeholder*="メッセージ"], input[placeholder*="メッセージ"], textarea[placeholder*="質問"], input[placeholder*="質問"]');
    
    if (chatInput) {
      await chatInput.click();
      await chatInput.type('トレンドラインを引いて');
      
      // Enterキーを押す
      await page.keyboard.press('Enter');
      
      console.log('✓ Chat message sent');
      
      // レスポンスを待つ
      console.log('⏳ Waiting for AI response...');
      await page.waitForTimeout(10000); // 10秒待機
      
      // イベントが発生したか確認
      const eventResult = await page.evaluate(() => {
        return {
          lastEvent: window._lastTrendlineEvent,
          hasDrawings: window.chartStore?.getState?.()?.drawings?.length > 0
        };
      });
      
      console.log('\n[7] Final Result:');
      console.log('- Event received:', !!eventResult.lastEvent);
      console.log('- Event data:', eventResult.lastEvent);
      console.log('- Drawings in store:', eventResult.hasDrawings);
      
    } else {
      console.error('❌ Chat input not found');
      
      // ページの構造を調査
      const pageStructure = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('textarea, input[type="text"]'));
        return inputs.map(input => ({
          tag: input.tagName,
          placeholder: input.placeholder,
          className: input.className,
          id: input.id
        }));
      });
      console.log('Available inputs:', pageStructure);
    }
    
    // 8. スクリーンショットを撮る
    console.log('\n[8] Taking screenshot...');
    await page.screenshot({ 
      path: 'ui-events-test-result.png',
      fullPage: true 
    });
    console.log('✓ Screenshot saved as ui-events-test-result.png');
    
    // ブラウザは開いたままにする（デバッグ用）
    console.log('\n✅ Test completed. Browser will remain open for debugging.');
    console.log('Press Ctrl+C to exit.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
}

// 実行
testUIEvents().catch(console.error);