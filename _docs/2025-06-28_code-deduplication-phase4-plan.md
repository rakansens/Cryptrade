# Code Deduplication Phase 4 計画

## 現状分析（2025-06-28 最終分析後）

### 成果サマリー
- **重複ペア数**: 514個 → 261個（**49.2%削減**）
- **最高Score**: 275.4 → 199.0（**27.7%改善**）
- **コード削減**: 612行以上達成
- **基盤コンポーネント**: 5つ作成・21箇所以上で利用

### 残存重複の特徴
1. **最高Score重複（199.0）**: useChartData ↔ use-approve-proposal
   - 既にuseChartDataBaseとuseChatProposalBaseを使用
   - これ以上の統合は困難（異なる責務）

2. **Score 150以上**: 6ペアのみ
   - 主にチャート系とチャット系の間の類似
   - 異なるドメインのため統合には慎重な検討が必要

3. **類似度90%以上**: トップ10中7ペア
   - 高類似度だが、Score自体は低い（コード量が少ない）

## Phase 4 推奨計画

### 1. 追加対応の費用対効果分析
現在のトップ10重複（Score 100以上）を分析：

| Rank | Score | 類似度 | ファイル | 推奨対応 |
|------|-------|--------|---------|----------|
| 1 | 199.0 | 90.48% | useChartData ↔ use-approve-proposal | スキップ（既に基盤使用） |
| 2 | 159.4 | 90.30% | use-approve-proposal ↔ test-performance-after | スキップ（テストファイル） |
| 3 | 159.1 | 90.12% | use-approve-proposal ↔ use-message-handling | 検討（同じドメイン） |
| 4 | 153.6 | 89.29% | use-streaming ↔ use-approve-proposal | スキップ（異なる責務） |
| 5 | 151.4 | 87.02% | useChartData ↔ use-line-tracking | スキップ（異なる責務） |

### 2. 現実的な追加対応（ROI高）

#### Option A: 最小限の追加対応
- **対象**: Score 150以上かつ同じドメイン内の重複のみ
- **推定削減**: 50-100行
- **工数**: 2-3時間

#### Option B: 中規模追加対応
- **対象**: Score 100以上の重複から選別
- **推定削減**: 200-300行
- **工数**: 1日

### 3. 今後の重複防止策（推奨重点項目）

#### CI/CD統合
```yaml
# .github/workflows/code-quality.yml
- name: Check code duplication
  run: |
    similarity-ts . -e ts,tsx -m 8 -t 0.85 > dup.txt
    if grep "Score: [2-9][0-9][0-9]" dup.txt; then
      echo "High score duplicates found (200+)"
      exit 1
    fi
```

#### Pre-commitフック
```bash
#!/bin/bash
# .git/hooks/pre-commit
similarity-ts . -e ts,tsx -m 8 -t 0.90 | grep -q "Score: [1-9][0-9][0-9]"
if [ $? -eq 0 ]; then
  echo "⚠️  High similarity code detected (Score 100+)"
  echo "Consider using existing base components:"
  echo "- useEventHandlerBase"
  echo "- useChartDataBase"
  echo "- useChatProposalBase"
  echo "- useStreamBase"
fi
```

### 4. 基盤コンポーネントのドキュメント化

```typescript
// hooks/shared/README.md
# Shared Base Hooks

## Available Base Components

### useEventHandlerBase
- **Purpose**: Standardized event handling pattern
- **Use when**: Creating event-driven hooks
- **Example**: usePatternEventHandlers, useChartControlAgentEvents

### useChartDataBase
- **Purpose**: Chart data processing foundation
- **Use when**: Working with chart/market data
- **Example**: useChartData, useCandlestickData

// ... etc
```

## 推奨事項

### 即時対応（今すぐ）
1. ✅ 古いログファイル削除完了
2. ✅ 最新分析実行完了
3. 🔲 CI/CD統合の実装
4. 🔲 基盤コンポーネントのREADME作成

### 中期対応（今後1ヶ月）
1. Pre-commitフック導入
2. チーム向けワークショップ（基盤活用方法）
3. 四半期レビュープロセス確立

### 長期対応（継続的）
1. 新規コード作成時の基盤利用徹底
2. Score 150以上の新規重複を監視
3. 基盤コンポーネントの継続的改善

## 結論

現時点で主要な重複は解消済み。残存重複は異なるドメイン間の類似が多く、無理な統合は逆に保守性を損なう可能性がある。

**推奨**: 
- 追加の重複削減より、**再発防止の仕組み作り**に注力
- CI/CDでの自動チェック導入を最優先
- 基盤コンポーネントの活用促進

---
作成日: 2025-06-28
作成者: Claude Code