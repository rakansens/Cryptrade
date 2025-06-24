# スキップされたテストの詳細分析

## Summary
- 合計74個のテストがスキップされている
- 8つのファイルに分散
- 主な原因：モジュール依存関係、タイミング問題、アーキテクチャの制約

## Skipped Tests by File

### 1. shared-data-store.test.ts (38 tests skipped)
**最多のスキップ数**

#### 問題の根本原因
- Singletonパターンの実装によるテスト間の状態共有
- `getInstance()`が常に同じインスタンスを返すため、テスト間で状態がリセットされない

#### スキップされたテスト
- "should maintain singleton instance across imports"
- "should share data between different tool instances"
- "should handle concurrent access gracefully"
- その他35個のテスト

#### 修正方針
1. テスト用のリセット機能を追加
2. 依存性注入パターンへの移行を検討
3. テスト環境でのみ利用可能なクリーンアップメソッドの実装

### 2. binance-api.service.test.ts (16 tests skipped - 全テストスイート)
**全体がスキップ**

#### 問題の根本原因
- アーキテクチャ上の問題：クラスとインスタンスの混在
- モジュールモックが正しく機能しない

#### 修正方針
1. サービスアーキテクチャの見直し
2. モックしやすい設計への変更
3. 依存性注入の導入

### 3. orchestrator.agent.test.ts (7 tests skipped)

#### 問題の根本原因
- @mastra/coreモジュールの複雑な依存関係
- createToolのモック化が困難

#### スキップされたテスト
- "should execute orchestrator agent with basic query"
- "should handle agent communication flow"
- その他5個

#### 修正方針
1. @mastra/coreのモック戦略の見直し
2. 統合テストへの移行を検討

### 4. enhanced-line-analysis.tool.test.ts (6 tests skipped)

#### 問題の根本原因
- createTool関数のモック化の問題
- 複雑な依存関係

### 5. chart-data-analysis.tool.test.ts (5 tests skipped)

#### 問題の根本原因
- ロガーの呼び出し検証の問題
- 非同期処理のタイミング

### 6. pattern-detector.test.ts (3 tests skipped)

#### 問題の根本原因
- 複雑なパターン検出ロジック
- 境界条件のテストが困難

### 7. chart-control.tool.test.ts (3 tests skipped)

#### 問題の根本原因
- AI応答のモック化の複雑さ
- 動的な応答生成のテスト

### 8. memory-recall.tool.test.ts (2 tests skipped)

#### 問題の根本原因
- Date.now()を使用した動的なタイムスタンプ
- 時間依存のテストの不安定性

#### 修正済み
- 固定日付を使用するように修正
- Jest fake timersの使用を検討

## 優先順位付けされた修正計画

### 高優先度
1. **shared-data-store.test.ts** (38 tests)
   - 影響範囲が最大
   - シングルトンパターンの見直しが必要

2. **binance-api.service.test.ts** (16 tests)
   - 全テストスイートがスキップ
   - アーキテクチャレベルの修正が必要

### 中優先度
3. **orchestrator.agent.test.ts** (7 tests)
   - 重要な機能のテスト
   - モック戦略の改善で対応可能

4. **enhanced-line-analysis.tool.test.ts** (6 tests)
5. **chart-data-analysis.tool.test.ts** (5 tests)

### 低優先度
6. **pattern-detector.test.ts** (3 tests)
   - ビジネスロジックの複雑さによる
   
7. **chart-control.tool.test.ts** (3 tests)
   - 部分的な問題

8. **memory-recall.tool.test.ts** (2 tests)
   - 一部修正済み

## 推奨アクション

1. **即座に対応可能**
   - memory-recall.tool.test.tsの残りの修正
   - Jest fake timersの導入

2. **短期的対応**
   - shared-data-storeにテスト用リセット機能追加
   - モック戦略の文書化

3. **長期的対応**
   - binance-api.serviceのアーキテクチャ改善
   - 依存性注入の全面的な導入
   - 統合テストスイートの拡充

## まとめ
スキップされたテストの大部分は、設計上の問題（シングルトン、密結合）に起因している。
テスタビリティを考慮した設計への段階的な移行が必要。