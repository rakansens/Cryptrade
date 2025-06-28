# Phase 5: より深い重複削減 - Score 50以上の徹底対応

## 📊 新たな発見（2025-06-28）

### 分析条件と結果
- **類似度0.9 & 10行以上**: 99個の重複ペア
- **類似度0.85 & Score≥50**: 454個の重複ペア（！）

### Score分布（類似度0.85以上）
| Score範囲 | 個数 | 状態 |
|-----------|------|------|
| **Score ≥200** | 1個 | ⚠️ 新発見（Score 246.5） |
| **Score 150-199** | 10個 | ⚠️ 未対応 |
| **Score 100-149** | 22個 | ⚠️ 未対応 |
| **Score 50-99** | 多数 | 🔍 要調査 |

### 🚨 重要な発見
1. **最高Score 246.5** - useChartInstance（以前見逃していた）
2. **Score 100以上が33個**も残存
3. 以前の分析（261ペア）は不完全だった可能性

## 🎯 緊急対応が必要な重複（Score ≥100）

### 1. 🔥 Score 246.5: useChartInstance
```
./components/chart/hooks/useChartInstance.ts:40-335
- 272〜296行の巨大関数
- 最優先で基盤化が必要
```

### 2. 🔥 Score 199.0: useChartData（既知だが未完全）
```
./components/chart/hooks/useChartData.ts:19-226
- 既にuseChartDataBase使用しているが、まだ重複が残存
- 追加の統合が必要
```

### 3. 🟡 Score 192.7: use-approve-proposal
```
./hooks/chat/use-approve-proposal.ts:26-257
- 既にuseChatProposalBase使用しているが、重複が残存
```

### 4. 🟡 Score 183.1: benchmark-performance.js
```
./scripts/benchmark-performance.js:310-508
- パフォーマンステスト関連
- 共通ベンチマークユーティリティが必要
```

## 📋 Phase 5実装計画

### Step 1: 最高優先度（Score ≥200）
- [ ] useChartInstance基盤化（Score 246.5）
- [ ] useChartData追加統合（Score 199.0）

### Step 2: 高優先度（Score 150-199）
- [ ] use-approve-proposal追加統合（10個の関連重複）
- [ ] useStreaming系の追加統合

### Step 3: 中優先度（Score 100-149）
- [ ] useAsyncFn/useAsyncState統合（共通非同期パターン）
- [ ] usePatternDebug基盤化
- [ ] useAIChat関連の統合（22個の関連重複）

### Step 4: 標準優先度（Score 50-99）
- [ ] 詳細分析後に計画

## 💡 なぜ以前の分析で見逃したか

1. **similarity-tsのオプション差異**
   - 以前: デフォルトオプション
   - 今回: `-t 0.85 -m 10 --print`で詳細出力

2. **Score計算の理解不足**
   - Score = 類似度 × 平均行数
   - 長い関数ほど高Scoreになる

3. **段階的アプローチの重要性**
   - 類似度0.9 → 0.85 → 0.8と段階的に下げる必要性

## 🚀 実装アプローチ

### 1. useChartInstance基盤化（最優先）
```typescript
// 新規: hooks/shared/useChartInstanceBase.ts
export function useChartInstanceBase(config: ChartInstanceConfig) {
  // チャートインスタンス管理の共通ロジック
  // ライフサイクル管理
  // サイズ変更処理
  // クリーンアップ
}
```

### 2. 非同期処理基盤の統合
```typescript
// 新規: hooks/shared/useAsyncBase.ts
export function useAsyncBase<T>(config: AsyncConfig<T>) {
  // useAsyncFn + useAsyncStateの統合
  // エラーハンドリング
  // ローディング状態管理
}
```

### 3. ベンチマーク基盤の作成
```typescript
// 新規: scripts/shared/benchmark-base.ts
export function createBenchmarkRunner(config: BenchmarkConfig) {
  // 共通ベンチマーク実行ロジック
  // メトリクス収集
  // レポート生成
}
```

## 📊 期待される成果

### 数値目標
- **Score ≥100の重複**: 33個 → 0個
- **総重複ペア数**: 454個 → 300個以下
- **コード削減**: 追加1000行以上

### 品質改善
- より一貫性のあるコードベース
- 保守性の大幅向上
- バグ修正の一元化

## ⚡ 次のアクション

1. **即座に実行**
   - useChartInstance（Score 246.5）の詳細分析と基盤化
   - Score 100以上の33個の優先順位付け

2. **本日中に完了**
   - 最高優先度（Score ≥200）の完全解消
   - 高優先度（Score 150-199）の実装開始

3. **今週中に完了**
   - 全Score 100以上の解消
   - CI/CDへの新しいしきい値設定（Score 100でfail）

---
作成日: 2025-06-28  
ステータス: 🔴 緊急対応中