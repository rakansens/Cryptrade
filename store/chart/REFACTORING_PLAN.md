# Chart Store リファクタリング計画

## 現状の問題点

1. **ファイルサイズ**: 722行の大きなファイル
2. **責務の混在**:
   - チャート基本設定（symbol, timeframe）
   - インジケーター管理
   - 描画ツール管理
   - パターン管理
   - Undo/Redo機能
   - 永続化処理
3. **複雑な状態管理**: 多くの状態と30以上のアクション
4. **型定義の混在**: インターフェースとストア実装が同一ファイル

## 提案する構造

```
store/chart/
├── index.ts                    # 公開API（既存のhooksを維持）
├── types.ts                    # 型定義
├── stores/
│   ├── chart-base.store.ts    # 基本設定（symbol, timeframe）
│   ├── indicator.store.ts     # インジケーター管理
│   ├── drawing.store.ts       # 描画ツール管理
│   ├── pattern.store.ts       # パターン管理
│   └── undo-redo.store.ts     # Undo/Redo機能
├── actions/
│   ├── drawing.actions.ts     # 描画関連アクション
│   ├── indicator.actions.ts   # インジケーター関連アクション
│   └── pattern.actions.ts     # パターン関連アクション
└── hooks/
    ├── use-chart.ts           # 統合hook
    ├── use-drawing.ts         # 描画専用hook
    ├── use-indicator.ts       # インジケーター専用hook
    └── use-pattern.ts         # パターン専用hook
```

## リファクタリング手順

### Phase 1: 型定義の分離
1. `types.ts` に全ての型定義を移動
2. 描画、パターン、インジケーターの型を整理

### Phase 2: ストアの分割
1. **chart-base.store.ts**: symbol, timeframe, isChartReady, loading, error
2. **indicator.store.ts**: indicators, settings, 関連アクション
3. **drawing.store.ts**: drawings, drawingMode, selectedDrawingId, isDrawing
4. **pattern.store.ts**: patterns, パターン関連アクション
5. **undo-redo.store.ts**: undoStack, redoStack, undo/redo機能

### Phase 3: アクションの整理
1. 各ドメインごとにアクションを分離
2. 永続化ロジックを各ストアに適切に配置
3. イベント連携の整理

### Phase 4: Hooksの再編成
1. 既存のhooksは後方互換性のため維持
2. 新しい細分化されたhooksを追加
3. `useChart` の最適化

## 期待される効果

1. **保守性向上**: 各ファイル200行以下
2. **関心の分離**: 各ストアが単一の責務
3. **テスタビリティ**: 独立したストアのユニットテスト可能
4. **パフォーマンス**: 必要な部分のみ購読可能
5. **拡張性**: 新機能の追加が容易

## 実装優先度

1. **HIGH**: 型定義の分離
2. **HIGH**: 描画ストアの分離（最も複雑）
3. **MEDIUM**: インジケーターストアの分離
4. **LOW**: パターンストアの分離
5. **LOW**: Undo/Redoの分離

## 注意点

- 既存のAPIは維持（後方互換性）
- ChartPersistenceManagerとの連携を維持
- zustand middlewareの適切な適用
- デバッグ機能の維持