# トレンドライン表示問題の調査と解決レポート

## 概要
日時: 2025年6月4日
問題: AIエージェントが「トレンドラインを引いて」のリクエストに対して正しくイベントを送信しているが、チャート上に表示されない

## 問題の症状
1. ユーザーが「トレンドラインを引いて」と入力
2. バックエンドは正常に処理し、`draw:trendline`イベントを送信
3. SSEでフロントエンドにイベントが届く
4. しかし、チャート上にトレンドラインが表示されない

## 調査プロセス

### 1. 初期調査
- **確認事項**: SSEイベントフローの動作確認
- **結果**: イベントは正常に送信されている
```
[POST] emitting { event: 'draw:trendline', pid: 8145 }
[INFO] [UI-Events] Event emitted successfully {"event":"draw:trendline"}
```

### 2. 座標フォーマットの確認
- **問題**: DrawingRendererは`value`フィールドを期待しているが、イベントは`price`フィールドを送信
- **対応**: FloatingChatPanelで`price`→`value`の変換を実装済み
```typescript
const normalizedPoints = detail.points.map((p: any) => ({
  time: Math.floor(p.time / 1000),  // ミリ秒から秒に変換
  value: p.price || p.value         // priceをvalueに変換
}))
```

### 3. 時間範囲の問題
- **発見**: トレンドラインの時間が2025年5月30日（未来の日付）
- **原因**: システムの日付が2025年6月4日に設定されている
- **影響**: チャートの表示範囲とトレンドラインの時間が一致しない可能性

### 4. DrawingRendererファイルの問題
- **重大な発見**: `lib/chart/drawing-renderer.ts`が空ファイルになっていた
- **解決**: Gitから前のコミットのファイルを復元
```bash
git checkout f5fe8f5 -- lib/chart/drawing-renderer.ts
```

## 根本原因
1. **DrawingRendererファイルが空になっていた** - これが主な原因
2. 時間範囲の不一致（副次的な問題）

## 解決策

### 1. DrawingRendererの復元
```bash
# ファイルの状態確認
git status lib/chart/drawing-renderer.ts

# 前のコミットから復元
git checkout f5fe8f5 -- lib/chart/drawing-renderer.ts
```

### 2. enhanced-chart-control.toolの実装
- AIファーストアプローチで複数トレンドライン対応
- チャートの現在の表示範囲に合わせた座標生成
- 日本語数字認識（「5本」「五本」など）

### 3. デバッグツールの作成
複数のデバッグ用HTMLファイルを作成：
- `debug-drawing-visibility.html` - 描画の可視性確認
- `debug-trendline-time.html` - 時間範囲の確認
- `test-simple-trendline.html` - シンプルなテスト

## 実装の改善点

### 1. 複数トレンドライン対応
```typescript
// 日本語数字の認識
{ pattern: /五本|5本/, extract: () => 5 },
{ pattern: /いくつか|複数|何本か/, extract: () => 3 },
```

### 2. AIファーストな座標生成
```typescript
// チャートデータから時間と価格の範囲を取得
timeRange.start = Math.floor(new Date(firstCandle.time).getTime() / 1000);
timeRange.end = Math.floor(new Date(lastCandle.time).getTime() / 1000);
```

### 3. プロセス間通信の改善
- SSEストリームとPOSTエンドポイントの統合
- HTTP POSTフォールバックの実装

## 関連ファイル
1. `/lib/chart/drawing-renderer.ts` - 描画レンダラー（復元が必要だった）
2. `/components/chat/FloatingChatPanel.tsx` - イベントハンドラー
3. `/lib/mastra/tools/enhanced-chart-control.tool.ts` - 複数描画対応
4. `/app/api/ui-events/route.ts` - SSEストリーム

## 教訓
1. **重要なファイルの空ファイル化に注意** - Gitでの確認が重要
2. **座標系の一貫性** - price vs value, ミリ秒 vs 秒
3. **デバッグツールの重要性** - 問題の可視化が解決を早める
4. **AIファーストアプローチ** - ハードコードではなく動的な対応

## テスト方法
```javascript
// ブラウザコンソールで実行
window.dispatchEvent(new CustomEvent('draw:trendline', {
  detail: {
    points: [
      { time: Date.now() - 7200000, price: 105000 },
      { time: Date.now(), price: 105500 }
    ],
    style: { color: '#ff0000', lineWidth: 3, lineStyle: 'solid' }
  }
}));
```

## 今後の改善提案
1. DrawingRendererの初期化確認ログの追加
2. ファイルの整合性チェックツールの実装
3. 時間範囲の自動調整機能
4. エラーハンドリングの強化

## 参考ログ
```
[FloatingChatPanel] draw:trendline event received
[FloatingChatPanel] Adding single drawing to store
[DrawingRenderer] renderDrawings called with 1 drawings
[DrawingRenderer] Drawing: trend-xxx trendline [{time, value}]
```