# テストカバレッジ分析レポート

## Summary
- 実装ファイル総数: 333個
- テストファイル総数: 284個
- カバレッジ率: 約85%
- 重要な機能でテストが不足している箇所を特定

## 主な発見事項

### 1. テストが不足している重要な領域

#### APIルート（20個のルートにテストなし）
- `/api/analysis/*` - 分析関連のAPIルート全般
- `/api/memory/sessions/*` - メモリセッション管理
- `/api/chat/sessions/*` - チャットセッション管理
- `/api/chart/sessions/*` - チャートセッション管理
- `/api/health/db` - データベースヘルスチェック
- `/api/test/*` - テスト用エンドポイント（低優先度）

#### Core Services（10個のサービスにテストなし）
- `lib/services/conversation-memory.service.ts`
- `lib/services/semantic-embedding.service.secure.ts`
- `lib/api/base-service.ts` - 基底サービスクラス
- `lib/api/client.ts` - APIクライアント基盤
- `lib/api/*-api.ts` - 各種APIクライアント実装

#### Mastraエージェント/ツール
- `lib/mastra/agents/trading.agent.ts` - トレーディングエージェント
- `lib/mastra/agents/orchestrator.handlers.ts`
- `lib/mastra/agents/orchestrator.utils.ts`
- `lib/mastra/tools/market-snapshot.tool.ts`
- `lib/mastra/tools/ui-state.tool.ts`

#### 主要コンポーネント（6個）
- `components/chat/ProposalCard.tsx`
- `components/chat/EntryProposalCard.tsx`
- `components/chart/core/CandlestickChart.tsx`
- `components/chart/indicators/MacdChart.tsx`
- `components/chart/indicators/RsiChart.tsx`
- `components/chart/toolbar/ChartToolbar.tsx`

### 2. テストの重複と構成の問題

#### 重複の可能性がある領域
1. **Chart Data Analysis** - 3つのテストファイル
   - `chart-data-analysis.tool.test.ts` - 基本設定テスト
   - `chart-data-analysis.tool.unit.test.ts` - 計算ロジックテスト
   - `chart-data-analysis.tool.integration.test.ts` - 統合テスト
   - **判定**: 適切な分離。重複ではなく異なる側面をテスト

2. **Memory/Conversation** - 6つのテストファイル
   - 各ファイルが異なる層をテストしているため、重複ではない

#### 構成の問題
1. **統合テストがユニットテストディレクトリに混在**
   - `tests/unit/lib/mastra/tools/chart-data-analysis.tool.integration.test.ts`
   - `tests/unit/store/store-integration.test.ts`
   - **推奨**: tests/integration に移動

2. **テストファイルの命名規則の不統一**
   - 一部で `.unit.test.ts`、`.integration.test.ts` を使用
   - 大部分は単に `.test.ts`
   - **推奨**: 統一された命名規則の採用

### 3. 優先的に対応すべき項目

#### Priority 1 - ビジネスクリティカルな機能
1. **Trading Agent** (`lib/mastra/agents/trading.agent.ts`)
   - 取引に関わる重要なロジック
   - テストが完全に欠如

2. **Session Management APIs**
   - `/api/chat/sessions/*`
   - `/api/memory/sessions/*`
   - ユーザーデータの管理に関わる

3. **Core Chart Components**
   - `CandlestickChart.tsx`
   - チャート表示の中核機能

#### Priority 2 - 重要な基盤機能
1. **Base Service/API Client**
   - `lib/api/base-service.ts`
   - `lib/api/client.ts`
   - 全APIの基盤となるクラス

2. **Analysis APIs**
   - `/api/analysis/*`
   - 分析機能のエンドポイント

#### Priority 3 - UIコンポーネント
1. **Proposal Cards**
   - `ProposalCard.tsx`
   - `EntryProposalCard.tsx`

2. **Chart Indicators**
   - `MacdChart.tsx`
   - `RsiChart.tsx`

## 統計情報

### テストファイル分布
```
tests/unit/lib/utils: 24ファイル
tests/unit/lib/mastra/tools: 16ファイル
tests/integration: 16ファイル
tests/unit/lib/ws: 13ファイル
tests/unit/lib/mastra/utils: 10ファイル
```

### カバレッジ改善の推定効果
- Priority 1を完了: +15% カバレッジ向上
- Priority 2を完了: +10% カバレッジ向上
- Priority 3を完了: +5% カバレッジ向上

## 推奨アクション

1. **即座に対応**
   - Trading Agentのテスト作成
   - Session Management APIのテスト作成

2. **短期的に対応**
   - Base Service/API Clientのテスト作成
   - 統合テストの適切なディレクトリへの移動

3. **中期的に対応**
   - UIコンポーネントのテスト追加
   - テスト命名規則の統一

4. **継続的改善**
   - CI/CDでのカバレッジ測定の自動化
   - 新規コード作成時のテスト必須化

## 追加分析：テストの重複調査

### Orchestrator関連テスト（5ファイル）
調査の結果、それぞれ異なる側面をテストしていることが判明：
- `improved-orchestrator.test.ts` - インテント分析の純粋関数テスト
- `orchestrator.agent.test.ts` - エージェント設定と統合テスト
- `parallel-orchestrator.test.ts` - 並列実行ロジックのテスト
- `integration/orchestrator/orchestrator.test.ts` - E2E統合テスト
- **結論**: 重複ではなく、適切な層別テスト

### Proposal関連テスト（15ファイル）
提案機能の異なる側面をカバー：
- **統合テスト** (5ファイル) - E2E、UI統合、システム全体
- **ユニットテスト** (10ファイル) - フック、ツール、ストア、タイプ
- **結論**: 包括的なテストカバレッジで、重複は最小限

### Memory関連テスト（4ファイル）
各レイヤーを適切にテスト：
- `memory-recall.tool.ts` - ツールレベル
- `conversation-memory.store.ts` - 基本ストア
- `enhanced-conversation-memory.store.ts` - 拡張ストア
- `memory-processor.ts` - プロセッサーロジック
- **結論**: 重複なし、各層を適切にテスト

## 最終的な推奨事項

### 重複の削減は不要
- 調査の結果、見かけ上の重複は実際には異なる層やアスペクトをテスト
- 現在のテスト構成は適切

### 優先すべきアクション（更新版）
1. **新規テストの作成**（上記Priority 1-3）
2. **テストファイルの整理**
   - 統合テストを適切なディレクトリに移動
   - 命名規則の統一
3. **カバレッジの自動測定**
   - CI/CDパイプラインでの自動レポート

## Follow-ups
- [x] Trading Agentのテスト実装（モック設定の問題あり）
- [x] Session Management APIのテスト実装（完了）
- [x] Analysis APIのテスト実装（完了 - 4ファイル、29テスト）
- [x] Core Services のテスト実装
  - base-service.ts（完了 - 21テスト）
  - conversation-memory.service.ts（スキップ - シングルトンモック問題）
- [ ] Chart Indicators (MacdChart, RsiChart)のテスト実装
- [ ] Mastra Components (orchestrator.handlers, orchestrator.utils)のテスト実装
- [ ] テストファイル構成の整理
- [ ] カバレッジ測定ツールの導入（jest --coverage）
- [ ] テスト作成ガイドラインの更新