# Phase 5 進捗報告 - 段階的重複削減アプローチ

## 📊 発見：より深い重複の存在

### 新しい分析手法の効果
**段階的しきい値**による詳細分析で、従来見逃していた重複を大量発見：

| 分析条件 | 重複ペア数 | 重要発見 |
|----------|------------|----------|
| 類似度0.90, 10行以上 | 99ペア | Score 100-200の完全コピペ特定 |
| 類似度0.85, Score≥50 | **455ペア** | Score 258.3の最高重複発見 |

### 🚨 重要：従来の分析（261ペア）は氷山の一角だった

## 📈 新発見の最高Priority重複

### 1. 🔥 Score 258.3: useChartInstance ↔ useWebSocket
- **類似度**: 86.52%
- **範囲**: 291-306行（平均298.5行）
- **パターン**: 長い依存配列 + 複雑なuseEffect管理

### 2. 🔥 Score 249.0: useChartInstance ↔ useStreamBase  
- **類似度**: 86.17%
- **以前**: 246.5から微増（useCleanupBase効果で若干改善）

### 3. 🟡 Score 199.0: useChartData ↔ use-approve-proposal
- **継続**: 既知の重複、未対応

## ✅ Phase 5 実装成果

### 1. useCleanupBase基盤作成
- **ファイル**: `hooks/shared/useCleanupBase.ts`
- **機能**: 
  - 統一されたクリーンアップタスク管理
  - Ref/Observer/EventListener/Timeout の安全なクリーンアップ
  - 優先度付きクリーンアップ実行
  - マウント状態考慮ログ出力

### 2. useChartInstance基盤適用
- **前**: 手動クリーンアップ（274-309行）
- **後**: useCleanupBase活用による統一パターン
- **効果**: コードの可読性向上、バグリスクの削減

## 🎯 発見された根本課題

### 1. 複雑なuseEffect依存配列パターン
多くのhooksで以下のパターンが重複：
```typescript
}, [
  dependency1,
  dependency2,
  // ... 10-20個の依存関係
  onCallback1,
  onCallback2,
  // ... さらに多数
]);
```

### 2. 類似のマウント状態管理
- `isMountedRef`パターン
- 同様のクリーンアップロジック
- エラーハンドリングパターンの重複

### 3. WebSocket/Stream系の共通パターン
- useWebSocket ↔ useStreamBase ↔ useChartInstanceに共通構造

## 🚀 Phase 6 戦略提案

### 即座実行（高ROI）
1. **useWebSocketのuseCleanupBase適用**（Score 258.3解消）
2. **依存配列管理ユーティリティ作成**
3. **マウント状態管理基盤の作成**

### 中期実行
1. **Score 150以上の22個を段階的に対応**
2. **useAsyncFn/useAsyncState統合**
3. **ChatHooks系の追加統合**

## 📊 期待効果

### Phase 6完了時の目標
- **Score 200以上**: 完全解消
- **総重複ペア**: 455 → 300以下
- **コード削減**: 追加800-1200行

### 品質改善
- より一貫性のあるhookパターン
- メモリリーク・バグのリスク大幅削減
- 新規hook作成時の指針明確化

## 📋 次のアクション優先度

### 1. 緊急（今日中）
- [ ] useWebSocket基盤適用（Score 258.3）
- [ ] dependency管理ユーティリティ作成

### 2. 高優先度（今週中）  
- [ ] Score 150以上の10個解消
- [ ] 非同期処理基盤統合

### 3. 標準優先度（来週）
- [ ] Score 100-149の22個対応

---
**結論**: 段階的アプローチにより、従来の分析では見逃していた**大量の重複**を発見。
Score 50以上で455ペア存在し、より体系的な対応が必要。

---
作成日: 2025-06-28  
ステータス: 🔄 Phase 6計画策定中