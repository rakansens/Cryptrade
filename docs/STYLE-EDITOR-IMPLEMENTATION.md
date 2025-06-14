# スタイルエディタ実装ガイド

## 概要

このドキュメントは、Cryptradeアプリケーションにおけるスタイルエディタ機能の実装と、関連する問題の修正について記載しています。

## 実装された機能

### 1. 基本的なスタイル編集機能
- **色の変更**: カラーピッカーとプリセットカラー
- **線の太さ**: 1〜10のスライダー
- **線の種類**: 実線、破線、点線（ボタン形式UI）
- **価格ラベルの表示/非表示**: トグルスイッチ

### 2. パターン認識専用機能
- **TP/SL/BOラインのスタイル適用**: 基本スタイルがメトリックラインに継承
- **メトリクスラベルの位置**: 左、中央、右
- **パターン塗りつぶしの透明度**: 0〜100%
- **キーポイントの強調表示**

### 3. リアルタイム更新
- カスタムイベントシステムによる即時反映
- アニメーションなしの高速更新オプション

## 修正された問題

### 1. パターンスタイル更新エラー
**問題**: "Drawing not found for style update"エラー
**原因**: パターンは`patterns` Mapに格納されているが、通常の描画と同じ`drawings`配列から検索していた
**解決策**: 
- パターン用の専用イベント`chart:updatePatternStyle`を追加
- `useAgentEventHandlers`でパターン専用の更新ロジックを実装

### 2. アプリケーション起動タイムアウト
**問題**: "TimeoutError: Request timeout after 10000ms"
**原因**: 
- 複数のSSE接続による競合状態
- APIクライアントのタイムアウトが短すぎる（10秒）
**解決策**:
- SSEManagerシングルトンパターンの実装
- APIクライアントのタイムアウトを30秒に延長
- 指数バックオフによる再接続ロジック

### 3. UIレイアウトの問題
**問題**: ドロップダウンのレイアウト崩れ
**解決策**: Selectコンポーネントをボタン形式のUIに変更

## 技術的な実装詳細

### イベントフロー
```typescript
// 通常の描画スタイル更新
window.dispatchEvent(new CustomEvent('chart:updateDrawingStyle', {
  detail: {
    drawingId: string,
    style: Partial<DrawingStyle>,
    immediate: boolean
  }
}))

// パターンスタイル更新
window.dispatchEvent(new CustomEvent('chart:updatePatternStyle', {
  detail: {
    patternId: string,
    patternStyle: {
      baseStyle?: Partial<DrawingStyle>,
      // その他のパターン専用スタイル
    },
    immediate: boolean
  }
}))
```

### 型定義（Zod スキーマ）
```typescript
// 簡素化された線スタイル
export const ExtendedLineStyleSchema = z.enum([
  'solid',
  'dashed',
  'dotted',
])

// パターンスタイルスキーマ
export const PatternStyleSchema = z.object({
  baseStyle: DrawingStyleSchema.optional(),
  targetLineStyle: DrawingStyleSchema.optional(),
  stopLossLineStyle: DrawingStyleSchema.optional(),
  breakoutLineStyle: DrawingStyleSchema.optional(),
  // その他のプロパティ
})
```

## テストとデバッグ

### 統合テストツール
- `/public/test-style-editor-complete.html`: 包括的なブラウザテスト
- `/scripts/test-style-editor-integration.js`: Puppeteerによる自動テスト

### デバッグのポイント
1. コンソールログで`[StyleEditor]`、`[Agent Event]`、`[PatternRenderer]`を確認
2. カスタムイベントの発火と受信を確認
3. storeの状態変更を追跡

## 今後の拡張可能性
- カスタムダッシュパターンの実装
- グラデーション色のサポート
- アニメーション効果の追加
- スタイルのエクスポート/インポート機能