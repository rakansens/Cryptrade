# テストスイート エラー分析と修正計画

## エラー分析結果

### 1. **instanceof エラー（最優先）**
**影響範囲**: 多数のテストが Jest worker exception で失敗
**根本原因**: `app/api/ai/stream/route.ts:70` で `AgentError` と `ValidationError` のインポートエラー

```typescript
// エラー発生箇所
else if (error instanceof base_error_1.AgentError || error instanceof base_error_1.ValidationError)
```

**失敗テスト数**: 約150件以上（Jest worker exception による連鎖的失敗）

### 2. **WebSocket関連エラー**
**影響範囲**: 
- `tests/integration/ws/ws-manager-advanced.test.ts`
- `tests/unit/lib/ws/*.test.ts`
- 他多数の統合テスト

**問題点**:
- 接続共有の不具合（期待1接続、実際2接続）
- タイムアウト（30秒超過）
- EventSource モックの問題

### 3. **データベース関連エラー**
**影響範囲**:
- `lib/logging/storage/__tests__/postgres.test.ts`
- `tests/unit/lib/db/*.test.ts`

**問題点**:
- PostgreSQL接続エラー処理の不備
- 大量バッチ処理のタイムアウト（20秒超過）

### 4. **React/DOM関連エラー**
**影響範囲**: 
- コンポーネントテスト全般
- `tests/unit/components/**/*.test.tsx`

**問題点**:
- React Testing Library のセットアップ問題
- DOM環境の不整合

### 5. **モジュール解決エラー**
**影響範囲**: 
- 多数のユニットテスト

**問題点**:
- TypeScript パス解決の問題
- モックセットアップの不備

## カテゴリ別修正計画

### Phase 1: 即時修正（Critical）
#### 1.1 instanceof エラーの修正
```bash
# タスク: AgentError/ValidationError のインポート修正
# 対象: app/api/ai/stream/route.ts
# 修正内容: 
# - base_error_1 から正しいパスへの変更
# - エラークラスの存在確認
# 推定時間: 30分
```

#### 1.2 Jest 設定の修正
```bash
# タスク: Jest worker 設定の最適化
# 対象: jest.config.js, scripts/jest-memory-fix.js
# 修正内容:
# - maxWorkers の調整
# - worker timeout の延長
# - メモリ設定の最適化
# 推定時間: 1時間
```

### Phase 2: WebSocket/ストリーミング修正
#### 2.1 WebSocket モックの改善
```bash
# タスク: WebSocket モック実装の改修
# 対象: __mocks__/ws.ts, tests/mocks/*
# 修正内容:
# - MockWebSocket のインスタンス管理修正
# - EventSource モックの安定化
# 推定時間: 2時間
```

#### 2.2 タイムアウト設定の調整
```bash
# タスク: 非同期テストのタイムアウト調整
# 対象: 統合テスト全般
# 修正内容:
# - jest.setTimeout() の追加
# - 個別テストのタイムアウト延長
# 推定時間: 1時間
```

### Phase 3: データベース関連修正
#### 3.1 PostgreSQL モックの改善
```bash
# タスク: DB接続エラーハンドリング
# 対象: lib/logging/storage/postgres.ts
# 修正内容:
# - 接続エラーの適切な処理
# - バッチサイズの最適化
# 推定時間: 2時間
```

### Phase 4: React/コンポーネントテスト修正
#### 4.1 テスト環境のセットアップ
```bash
# タスク: React Testing Library 環境整備
# 対象: test-utils.tsx, setupTests.ts
# 修正内容:
# - グローバルモックの整備
# - DOM 環境の初期化
# 推定時間: 2時間
```

### Phase 5: モジュール解決の修正
#### 5.1 TypeScript パス設定
```bash
# タスク: tsconfig パスマッピング修正
# 対象: tsconfig.json, jest.config.js
# 修正内容:
# - moduleNameMapper の調整
# - パスエイリアスの統一
# 推定時間: 1時間
```

## 実行優先順位

1. **即座に実行（ブロッカー解消）**
   - instanceof エラー修正（Phase 1.1）
   - Jest worker 設定（Phase 1.2）

2. **短期（1-2日）**
   - WebSocket モック修正（Phase 2.1）
   - タイムアウト調整（Phase 2.2）

3. **中期（3-5日）**
   - DB関連修正（Phase 3）
   - React環境整備（Phase 4）
   - モジュール解決（Phase 5）

## 期待される改善

- **修正前**: 165件の失敗テスト
- **Phase 1後**: 約50件まで減少見込み
- **Phase 2後**: 約20件まで減少見込み
- **全Phase完了後**: 5件以下を目標

## 実装開始コマンド

```bash
# Phase 1 の実行
npm run test:fix:phase1

# 個別修正の確認
npm test -- --testPathPattern="stream/route.test.ts" --verbose
```