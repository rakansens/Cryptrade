# 提案承認機能の修正内容

## 修正した問題

1. **イベント発行の問題**
   - `publishEvent`がasync関数として呼ばれていたが、実際は同期関数だった
   - `drawing:create`イベントではなく、`chart:addDrawing`イベントを使用する必要があった

2. **イベントフォーマットの問題**
   - UIEventStreamの`publish`関数ではなく、直接CustomEventを使用してwindowにdispatchする必要があった
   - `useAgentEventHandlers`フックが`chart:addDrawing`イベントをリッスンしている

## 修正内容

### ChatPanel.tsx

```typescript
// 提案の承認処理
const handleApproveProposal = useCallback((message: ProposalMessage, proposalId: string) => {
  const proposal = message.proposalGroup.proposals.find(p => p.id === proposalId)
  if (!proposal) return

  // 承認イベントを発行
  const approvalEvent: ProposalActionEvent = {
    type: 'proposal:approve',
    proposalId,
    groupId: message.proposalGroup.id,
    timestamp: Date.now(),
  }
  publish(approvalEvent)

  // 描画イベントを発行 - chart:addDrawingイベントを使用
  const drawingData = proposal.drawingData
  const drawingEvent = new CustomEvent('chart:addDrawing', {
    detail: {
      id: `drawing_${Date.now()}_${proposalId}`,
      type: drawingData.type,
      points: drawingData.points,
      style: drawingData.style || {
        color: '#22c55e',
        lineWidth: 2,
        lineStyle: 'solid',
        showLabels: true
      },
    }
  })
  window.dispatchEvent(drawingEvent)
  
  logger.info('[ChatPanel] Drawing event published', { 
    proposalId, 
    drawingType: drawingData.type,
    points: drawingData.points 
  })
}, [publish])
```

## テスト方法

1. **ブラウザでテストページを開く**
   ```
   http://localhost:3000/test-proposal-approval.html
   ```

2. **アプリケーションでテスト**
   - チャットで「トレンドラインを提案して」と入力
   - 5つの提案が表示される
   - 各提案の承認ボタンをクリック
   - チャートにトレンドラインが描画される

3. **コンソールログの確認**
   ```javascript
   // 以下のログが表示されるはず
   [ChatPanel] Drawing event published { proposalId: "...", drawingType: "trendline", points: [...] }
   [Agent Event] Handling chart:addDrawing { id: "...", type: "trendline", points: [...] }
   ```

## イベントフロー

1. ユーザーが提案を承認
2. `ChatPanel`が`chart:addDrawing`イベントを発行
3. `useAgentEventHandlers`フックがイベントをキャッチ
4. `drawingQueue`を通じて描画が実行
5. チャートに線が表示される

## 注意点

- 複数の提案を一度に承認する場合、100msの遅延を入れて順番に処理
- 描画スタイルはデフォルトで緑色（#22c55e）
- IDは`drawing_${timestamp}_${proposalId}`の形式で一意性を保証