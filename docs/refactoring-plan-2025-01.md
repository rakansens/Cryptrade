# コード重複削減リファクタリング計画 2025年1月

## 概要
similarity-tsツールによる分析の結果、261個の重複ペアが検出されました。本ドキュメントでは、これらの重複を分類し、優先順位をつけてリファクタリング計画を提示します。

## 重複パターンの分類

### 1. 非同期・ストリーミングフック (優先度: 高)

#### 主な重複パターン
- `useApproveProposal` と `useChartData` (90.48% 類似)
- `useApproveProposal` と `useMessageHandling` (90.12% 類似)
- `useSSE` と `useApproveProposal` (89.29% 類似)
- `useAsyncState` と複数のフック間での類似パターン

#### 共通パターン
```typescript
// 以下のパターンが複数のフックで重複
- エラーハンドリング
- ローディング状態管理
- 非同期操作のキャンセル処理
- クリーンアップ処理
- ログ出力
```

#### リファクタリング方針
1. 基底フック `useAsyncOperation` を作成
2. 共通の状態管理パターンを抽出
3. エラーハンドリングとログの標準化

### 2. インディケーター計算関数 (優先度: 中)

#### 主な重複パターン
- `calculateBollingerBands` と `calculateRSI` (94.24% 類似)
- `calculateMACD` と `calculateRSI` (92.35% 類似)
- `calculateSMA` と `calculateEMA` (98.12% 類似)

#### 共通パターン
```typescript
// 各インディケーター関数で重複しているパターン
- データバリデーション
- エラーハンドリング
- ループ処理構造
- 結果のフォーマット
```

#### リファクタリング方針
1. 基底クラス `BaseIndicator` を作成
2. 共通のバリデーションロジックを抽出
3. テンプレートメソッドパターンの適用

### 3. テストユーティリティ (優先度: 中)

#### 主な重複パターン
- `benchmarkAnalysis` と複数のテスト関数
- `mockFetch` と他のモック関数
- テストファクトリー関数間の重複

#### リファクタリング方針
1. 共通テストユーティリティライブラリの作成
2. モック生成の標準化
3. ベンチマーク処理の統合

### 4. イベントハンドリング (優先度: 低)

#### 主な重複パターン
- `useUIEventStream` と複数のイベント処理フック
- `useEventHandlerBase` の重複利用パターン

#### リファクタリング方針
1. イベントハンドリングの共通化
2. イベントタイプの標準化

## 実装計画

### Phase 1: 非同期フックの基底クラス作成 (1週目)

1. **`useAsyncOperation` 基底フックの作成**
   ```typescript
   // hooks/base/use-async-operation.ts
   export function useAsyncOperation<T>({
     hookName,
     onSuccess,
     onError,
     enableAutoCleanup = true
   }) {
     // 共通の状態管理
     // エラーハンドリング
     // クリーンアップ処理
   }
   ```

2. **既存フックのリファクタリング**
   - `useApproveProposal` を基底フックを使用するよう修正
   - `useChartData` を基底フックを使用するよう修正
   - 他の非同期フックも順次移行

### Phase 2: インディケーター基底クラス作成 (2週目)

1. **`BaseIndicator` クラスの作成**
   ```typescript
   // lib/indicators/base-indicator.ts
   export abstract class BaseIndicator<TInput, TOutput> {
     protected abstract calculate(data: TInput[]): TOutput[];
     
     public execute(data: TInput[]): TOutput[] {
       // バリデーション
       // エラーハンドリング
       // 計算実行
     }
   }
   ```

2. **各インディケーターの移行**
   - `SMAIndicator extends BaseIndicator`
   - `EMAIndicator extends BaseIndicator`
   - `RSIIndicator extends BaseIndicator`
   - その他のインディケーターも順次移行

### Phase 3: テストユーティリティの統合 (3週目)

1. **共通テストユーティリティの作成**
   ```typescript
   // tests/utils/common.ts
   export const TestUtils = {
     createMockData,
     setupBenchmark,
     mockAPIResponse,
     // その他の共通ユーティリティ
   }
   ```

2. **既存テストの更新**
   - 重複したテストヘルパーを削除
   - 共通ユーティリティを使用するよう修正

## 期待される効果

### 定量的効果
- コード行数: 約30-40%削減（重複部分）
- テストカバレッジ: 維持または向上
- ビルド時間: 約10-15%短縮

### 定性的効果
- 保守性の向上
- バグ修正の一元化
- 新機能追加の容易化
- コードレビューの効率化

## リスクと対策

### リスク
1. 既存機能への影響
2. パフォーマンスの低下
3. 過度の抽象化

### 対策
1. 段階的な移行とテストの充実
2. パフォーマンステストの実施
3. 適切な抽象化レベルの維持

## 次のステップ

1. チームでのレビューと承認
2. Phase 1の実装開始（基底フックの作成）
3. 進捗の週次レビュー
4. 各Phaseごとの効果測定

## 参考資料

- [similarity-ts分析結果](./similarity-analysis-full.txt)
- [現在のコード構造図](./current-architecture.md)
- [リファクタリング後の構造図](./proposed-architecture.md)