# Phase 2 リファクタリング実行計画

Phase 1の成果を基に、残りの重複箇所とさらなる共通化機会を特定し、実行計画を策定。

## 調査結果サマリー

### Phase 1 成果
- ✅ APIハンドラーファクトリー実装完了 (createApiHandler, createStreamingHandler)
- ✅ 統一エラーハンドリング導入 (AppError, ValidationError, ApiError等)
- ✅ ストリーミングHook基底クラス実装
- ✅ WebSocket管理Hook統一
- ✅ 型定義整理とテストスイート構築

### 現在の課題

#### 1. ロギングシステム統一 🔥 **高優先度**
**現状**: 3つの独立したロギング実装が存在
- `lib/utils/logger.ts` - Transport-agnostic logger with DI
- `lib/utils/logger-enhanced.ts` - Wrapper with storage capabilities  
- `lib/logs/enhanced-logger.ts` - Full storage integration (removed, replaced by `lib/logging/`)

**問題**: 
- 開発者が混乱しやすい
- 機能重複によるメンテナンス負荷
- 一貫性のないログ出力

#### 2. APIルート未リファクタリング 🔥 **高優先度**
**現状**: 15個のAPIルートのうち11個が旧パターン使用
- 未適用: binance routes, events, logs, metrics, monitoring, ui-events
- 手動エラーハンドリング、CORS、バリデーション処理が散在

#### 3. テストユーティリティ重複 🟡 **中優先度**
**現状**: 全テストファイルで共通パターンが重複
- Logger mocking (全ファイルで同じコード)
- MSW server setup patterns
- Mock transport implementations
- beforeEach/afterEach cleanup patterns

#### 4. ストリーミング/SSEパターン 🟡 **中優先度**
**現状**: SSEエンドポイントで手動実装が散在
- events/route.ts, ai/stream/route.ts, ui-events/route.ts
- 同様のストリーム管理、クリーンアップロジック

## Phase 2 実行計画

### 🎯 Phase 2.1: ロギングシステム統一 (優先度: 🔥 HIGH)

#### タスク分割
1. **統一ロガー設計** (1.5h)
   - 3システムの機能マトリックス分析
   - 統一アーキテクチャ設計
   - 後方互換性保証機能設計

2. **統一実装** (2h)
   - 新統一ロガー実装 (`lib/logging/unified-logger.ts`)
   - Transport層統合
   - 設定管理統一

3. **マイグレーション** (1h)
   - 既存コード移行
   - import文更新
   - テスト更新

#### 成果物
- `lib/logging/unified-logger.ts` - 統一ロガー
- `lib/logging/transports/` - 統一Transport実装
- 移行ガイド文書

### 🎯 Phase 2.2: APIルート大量リファクタリング (優先度: 🔥 HIGH)

#### タスク分割
1. **Binanceルート群** (1h)
   - `api/binance/klines/route.ts`
   - `api/binance/ticker/route.ts`

2. **ログ&メトリクスルート群** (1h) 
   - `api/logs/route.ts`
   - `api/logs/stats/route.ts`
   - `api/metrics/route.ts`

3. **イベント&ストリーミングルート群** (1.5h)
   - `api/events/route.ts`
   - `api/ui-events/route.ts`
   - `api/logs/stream/route.ts`

4. **モニタリングルート群** (0.5h)
   - `api/monitoring/circuit-breaker/route.ts`
   - `api/monitoring/telemetry/route.ts`

#### 成果物
- 11個のAPIルート完全リファクタリング
- コード行数35-40%削減予想
- 統一エラーハンドリング適用

### 🎯 Phase 2.3: テストユーティリティ統一 (優先度: 🟡 MEDIUM)

#### タスク分割
1. **共通テストヘルパー** (1h)
   - `__tests__/helpers/mock-logger.ts`
   - `__tests__/helpers/mock-setup.ts`
   - `__tests__/helpers/msw-server.ts`

2. **既存テスト更新** (1h)
   - 全テストファイルの重複削除
   - 共通ヘルパー適用

#### 成果物
- テストコード重複50%削減
- 統一テストパターン確立

### 🎯 Phase 2.4: ストリーミング抽象化 (優先度: 🟡 MEDIUM)

#### タスク分割
1. **SSEファクトリー実装** (1h)
   - `lib/api/create-sse-handler.ts`
   - ストリーム管理統一

2. **SSEルート適用** (0.5h)
   - 3つのSSEエンドポイント更新

#### 成果物
- SSEコード重複70%削減
- 統一ストリーム管理

## 並列実行戦略

### tmux セッション構成 (5 panes)
```
┌─────────────┬─────────────┐
│   Pane 1    │   Pane 2    │
│ Logging     │ API Routes  │
│ Unification │ Binance+Log │
├─────────────┼─────────────┤
│   Pane 3    │   Pane 4    │
│ API Routes  │ Test Utils  │
│ Events+Mon  │ & SSE       │
├─────────────┴─────────────┤
│        Pane 5 (統制)       │
│     Project Manager      │
└───────────────────────────┘
```

### 並列タスク依存関係
- **Phase 2.1 (Logging)**: 独立実行可能
- **Phase 2.2 (API Routes)**: 2つのサブタスクで並列実行
- **Phase 2.3 (Test Utils)**: Phase 2.1完了後実行
- **Phase 2.4 (SSE)**: Phase 2.2完了後実行

## 想定成果

### 定量的効果
- **APIルートコード**: 35-40%削減 (800行 → 500行)
- **テストコード重複**: 50%削減 (400行 → 200行)
- **ロギング実装**: 70%統合 (3システム → 1システム)
- **SSEコード**: 70%削減 (300行 → 90行)

### 定性的効果
- 開発者体験の大幅改善
- メンテナンス性向上
- コード品質・一貫性向上
- 新機能開発速度向上

## リスク管理

### 高リスク項目
1. **ロギング統一**: 既存ログに依存するツール影響
   - **対策**: 段階的移行、後方互換性保証

2. **API大量変更**: 既存クライアント影響
   - **対策**: レスポンス形式保持、段階デプロイ

### 中リスク項目
1. **テスト並列実行**: CI/CD環境での競合
   - **対策**: 独立テストファイル、適切なモック分離

## 次回実行指示

プロジェクトマネージャーは以下の順序でタスクを各ペインに割り当て:

1. **Pane 1**: Phase 2.1 ロギングシステム統一
2. **Pane 2**: Phase 2.2a Binance+ログルート群
3. **Pane 3**: Phase 2.2b イベント+モニタリングルート群  
4. **Pane 4**: Phase 2.3 テストユーティリティ統一
5. **Pane 5**: 進捗管理・承認処理・最終検証

各ペインには具体的な実装指示と成果物要件を明示して並列実行開始。