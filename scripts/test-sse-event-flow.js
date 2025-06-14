#!/usr/bin/env node
/**
 * SSEイベントフローのテストスクリプト
 * ブラウザコンソールで実行してSSEイベントが正しく流れているか確認
 */

console.log('[SSE Test] Starting SSE event flow test...')

// 1. イベントリスナーの確認
console.log('[SSE Test] Checking event listeners...')
const hasListener = window.addEventListener.toString().includes('native code')
console.log(`[SSE Test] Window.addEventListener available: ${hasListener}`)

// 2. SSE接続状態の確認
console.log('[SSE Test] Checking SSE connection...')
if (window.__SSE_DEBUG) {
  console.log('[SSE Test] SSE Debug info:', window.__SSE_DEBUG)
}

// 3. 手動でSSEイベントを送信
console.log('[SSE Test] Sending test trendline event...')

const testData = {
  points: [
    { 
      price: 43850.5, 
      time: Date.now() - 3600000,  // 1時間前
      x: 100,  // これは除外されるべき
      y: 200   // これも除外されるべき
    },
    { 
      price: 44150.3, 
      time: Date.now()  // 現在
    }
  ],
  style: {
    color: '#00e676',
    lineWidth: 2,
    lineStyle: 'solid',
    showLabels: true
  }
}

// APIエンドポイントに送信
fetch('/api/ui-events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'draw:trendline',
    data: testData
  })
})
.then(response => {
  console.log('[SSE Test] API response:', response.status, response.statusText)
  return response.json()
})
.then(data => {
  console.log('[SSE Test] API response data:', data)
})
.catch(error => {
  console.error('[SSE Test] API error:', error)
})

// 4. イベントリスナーを追加して受信を確認
const testListener = (e) => {
  console.log('[SSE Test] Received draw:trendline event!')
  console.log('[SSE Test] Event detail:', e.detail)
  console.log('[SSE Test] Event detail points:', e.detail?.points)
  
  // ChartStoreの状態を確認（グローバルに公開されている場合）
  if (window.useChartStore) {
    const state = window.useChartStore.getState()
    console.log('[SSE Test] ChartStore drawings count:', state.drawings.length)
    console.log('[SSE Test] ChartStore drawings:', state.drawings)
  }
}

window.addEventListener('draw:trendline', testListener)

console.log('[SSE Test] Test listener registered. Waiting for events...')

// 5. 5秒後にクリーンアップ
setTimeout(() => {
  window.removeEventListener('draw:trendline', testListener)
  console.log('[SSE Test] Test completed. Listener removed.')
}, 5000)

// ブラウザコンソールでの実行方法を表示
console.log(`
[SSE Test] Manual test instructions:
1. Open browser DevTools console
2. Copy and paste this entire script
3. Check the console logs for:
   - [UI-Event] Raw SSE message received
   - [UI-Event] Dispatching event: draw:trendline
   - [FloatingChatPanel] incoming trendline
   - [ChartStore] Drawing added
4. Check Network tab > ui-events/stream for SSE messages
5. If events stop after '[UI-Event] Raw SSE message received', check if EventSource is properly connected
6. If events stop after '[UI-Event] Dispatching event', check if FloatingChatPanel listeners are registered
`)

// Add debugging flags
window.__SSE_DEBUG = true
console.log('[SSE Test] Debug flags set')