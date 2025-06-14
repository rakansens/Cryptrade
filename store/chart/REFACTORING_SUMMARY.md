# Chart Store リファクタリング完了報告

## 実施内容

### 1. ファイル構造の整理
722行の単一ファイルを、責務ごとに分割した小さなモジュールに再構成しました。

```
store/chart/
├── index.ts                    # 公開API・後方互換性維持 (241行)
├── types.ts                    # 型定義 (209行)
├── stores/
│   ├── chart-base.store.ts    # 基本設定 (88行)
│   ├── indicator.store.ts     # インジケーター管理 (106行)
│   ├── drawing.store.ts       # 描画ツール管理 (260行)
│   └── pattern.store.ts       # パターン管理 (82行)
└── chart.store.ts (更新)      # レガシーラッパー (19行)
```

### 2. 責務の明確化

#### chart-base.store.ts
- symbol, timeframe の管理
- チャートの準備状態（isChartReady, isLoading, error）
- 基本的なリセット機能

#### indicator.store.ts
- インジケーターのオン/オフ状態
- インジケーター設定（MA期間、RSI閾値など）
- 設定の更新と保存

#### drawing.store.ts
- 描画ツールの管理（追加、更新、削除）
- 描画モードの制御
- Undo/Redo機能（描画と密結合のため同じストアに）
- 非同期描画操作のサポート

#### pattern.store.ts
- チャートパターンの管理
- パターンの追加、削除、取得

### 3. 主な改善点

#### 保守性
- 各ファイルが単一の責務を持つ（最大260行）
- 関連する機能がグループ化されて見つけやすい
- デバッグログが各ストアで独立

#### パフォーマンス
- 必要な部分のみ購読可能（細分化されたhooks）
- 不要な再レンダリングを削減

#### 拡張性
- 新しいストアの追加が容易
- 各ストアが独立して進化可能

#### テスタビリティ
- 各ストアを独立してテスト可能
- モックの作成が簡単

### 4. 後方互換性の維持

既存のコードを壊さないよう、以下の対策を実施：

1. **useChartStore** - 従来のインターフェースを完全維持
2. **全てのレガシーhooks** - 同じ名前とシグネチャで提供
3. **chart.store.ts** - インポートパスの互換性維持
4. **window.__CHART_STORE** - デバッグ用グローバル変数も維持

### 5. 新しいAPI

より効率的な新しいAPIも提供：

```typescript
// 細分化されたストアへの直接アクセス
import { useChartBaseStore, useDrawingStore } from '@/store/chart';

// 必要な部分のみ購読
const symbol = useChartBaseStore(state => state.symbol);
const drawings = useDrawingStore(state => state.drawings);
```

## 移行ガイド

### 既存コードの場合
変更不要です。すべての既存APIは維持されています。

### 新規コードの場合
より効率的な新しいAPIの使用を推奨：
```typescript
// Before
import { useChartStore } from '@/store/chart.store';
const { symbol, drawings } = useChartStore(state => ({
  symbol: state.symbol,
  drawings: state.drawings
}));

// After (推奨)
import { useChartBaseStore, useDrawingStore } from '@/store/chart';
const symbol = useChartBaseStore(state => state.symbol);
const drawings = useDrawingStore(state => state.drawings);
```

## 効果測定

| 指標 | リファクタリング前 | リファクタリング後 |
|------|-------------------|-------------------|
| 最大ファイルサイズ | 722行 | 260行 |
| ファイル数 | 1 | 6 |
| 責務の数/ファイル | 5+ | 1 |
| テスト容易性 | 低 | 高 |
| パフォーマンス | 全体購読 | 部分購読可能 |

## まとめ

Chart Storeのリファクタリングにより、コードの保守性、パフォーマンス、テスタビリティが大幅に向上しました。
後方互換性を完全に維持しているため、既存のコードへの影響はありません。