# useAgentEventHandlers Custom Event Analysis

## Event Classification

### 1. UI / ChartControl Events (6個)
| Event Name | Payload Type | Description |
|------------|-------------|-------------|
| `ui:toggleIndicator` | `{ indicator: string, enabled: boolean }` | インジケーターの表示/非表示切り替え |
| `ui:updateIndicatorSetting` | `{ indicator: string, key: string, value: any }` | インジケーター設定の更新 |
| `ui:changeSymbol` | `{ symbol: string }` | 取引ペアの変更 |
| `ui:changeTimeframe` | `{ timeframe: string }` | 時間軸の変更 |
| `chart:setDrawingMode` | `{ mode: string }` | 描画モードの設定 |
| `chart:autoAnalysis` | `{ type: string, config: any }` | 自動分析の実行 |

### 2. Drawing Events (11個)
| Event Name | Payload Type | Description |
|------------|-------------|-------------|
| `chart:startDrawing` | `{ type: string, style?: any }` | 描画開始 |
| `chart:addDrawing` | `{ id: string, type: string, points?: any[], style?: any, price?: number, time?: number, levels?: any }` | 描画の追加 |
| `chart:deleteDrawing` | `{ id: string }` | 描画の削除 |
| `chart:clearAllDrawings` | `{}` | 全描画のクリア |
| `chart:undo` | `{ steps?: number }` | 操作の取り消し |
| `chart:redo` | `{ steps?: number }` | 操作のやり直し |
| `chart:undoLastDrawing` | `{}` | 最後の描画を取り消し |
| `chart:redoLastDrawing` | `{}` | 最後の描画をやり直し |
| `chart:updateDrawingStyle` | `{ drawingId: string, style: any, immediate?: boolean }` | 描画スタイルの更新 |
| `chart:updateAllStyles` | `{ type: string, style: any }` | 指定タイプの全描画スタイル更新 |
| `chart:updateDrawingColor` | `{ id: string, color: string }` | 描画色の更新 |
| `chart:updateDrawingLineWidth` | `{ id: string, lineWidth: number }` | 描画線幅の更新 |

### 3. Pattern Events (3個)
| Event Name | Payload Type | Description |
|------------|-------------|-------------|
| `chart:addPattern` | `{ id: string, pattern: PatternData }` | パターンの追加 |
| `chart:removePattern` | `{ id: string }` | パターンの削除 |
| `chart:updatePatternStyle` | `{ patternId: string, patternStyle?: any, lineStyles?: any, immediate?: boolean }` | パターンスタイルの更新 |

## 共通処理パターン

### 1. エラーハンドリング
```typescript
try {
  // 処理
} catch (error) {
  logger.error('[Agent Event] ...', { error });
  showToast('エラーメッセージ', 'error');
}
```

### 2. DOM操作（カーソル変更）
```typescript
if (typeof window !== 'undefined') {
  document.body.style.cursor = 'crosshair'; // or 'default'
}
```

### 3. バリデーション
```typescript
const validation = validateChartEvent('eventType', event.detail);
if (!validation.success) {
  logger.error('[Agent Event] Invalid payload', { error: validation.error.errors });
  showToast('Invalid data', 'error');
  return;
}
```

### 4. Store操作 + Renderer操作
```typescript
// Store更新
addDrawing(drawing);
// Renderer更新
if (handlers.drawingManager) {
  handlers.drawingManager.addDrawing(drawing);
}
```

## 依存関係

### Store Actions
- `useChartActions`: setSymbol, setTimeframe, setIndicatorEnabled, setIndicatorSetting
- `useDrawingActions`: setDrawingMode, addDrawing, updateDrawing, deleteDrawing, selectDrawing, clearAllDrawings, setIsDrawing
- `usePatternActions`: addPattern, removePattern, clearPatterns

### Utils
- `drawingQueue`: 描画操作の非同期キュー管理
- `showToast`: トースト通知
- `logger`: ログ出力
- `validateChartEvent`: イベントペイロードの検証
- `validateChartDrawing`: 描画データの検証

### External Handlers
- `handlers.drawingManager`: 描画管理インスタンス
- `handlers.patternRenderer`: パターン描画インスタンス
- `handlers.getPatternRenderer`: パターン描画インスタンスの取得関数
- `handlers.chartData`: チャートデータ

### DOM Operations
- `document.body.style.cursor`: カーソルスタイルの変更

## リファクタリング方針

1. **分離**: UI系、Drawing系、Pattern系に分離
2. **共通化**: エラーハンドリング、バリデーション、DOM操作を共通関数に
3. **型安全性**: 各カテゴリ専用の型定義作成
4. **テスト容易性**: モック可能な構造に改善