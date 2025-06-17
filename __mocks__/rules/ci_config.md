# CI/CD Configuration Report

## Overview
Cryptradeプロジェクトは、GitHub Actionsを使用した包括的なCI/CDパイプラインを実装しています。複数のワークフローが異なる目的で設定されており、品質保証とデプロイメントの自動化を実現しています。

## Workflow Triggers and Conditions

### 1. Main CI Workflow (`ci.yml`)
- **Triggers**: 
  - Push to `main` branch
  - Pull requests to `main` branch
- **Purpose**: メインのCI検証フロー

### 2. Test CI Workflow (`test.yml`)
- **Triggers**: 
  - Push to `main` branch
  - Pull requests to `main` branch
- **Matrix Strategy**: 
  - Node versions: 18.x, 20.x
  - Test suites: unit, integration
  - Shards: 1, 2, 3 (並列実行)

### 3. E2E Tests Workflow (`e2e.yml`)
- **Triggers**: 
  - Schedule: 毎日午前2時UTC（Nightly）
  - Manual trigger (`workflow_dispatch`)
- **Matrix Strategy**: 
  - Browsers: chromium, firefox, webkit
  - Shards: 1-5 (並列実行)

### 4. CI E2E Workflow (`ci-e2e.yml`)
- **Triggers**: 
  - Push to: `main`, `develop`, `feature/*`
  - Pull requests to: `main`, `develop`

### 5. Type Check Workflow (`type-check.yml`)
- **Triggers**: 
  - Push to: `main`, `develop`
  - Pull requests to: `main`, `develop`

### 6. Documentation Workflow (`docs.yml`)
- **Triggers**: 
  - Push to `main` (paths: `lib/**`, `types/**`, `docs/**`)
  - Manual trigger

### 7. TypeDoc Check Workflow (`typedoc-check.yml`)
- **Triggers**: 
  - Push to `main`
  - Pull requests to `main`
  - Schedule: 毎週月曜日午前9時JST
  - Manual trigger

### 8. Complete Test Suite (`test-all.yml`)
- **Triggers**: 
  - Manual trigger
  - Schedule: 毎週日曜日

## Build and Test Pipeline Steps

### Validation Phase
1. **Environment Check**: 環境変数の検証
2. **Type Checking**: TypeScript型チェック
3. **Linting**: コード品質チェック

### Test Phase
1. **Unit Tests**: 
   - 並列実行（3シャード）
   - カバレッジレポート生成
   - Node.js 18.x と 20.x でテスト

2. **Integration Tests**: 
   - PostgreSQLサービスコンテナ使用
   - データベースマイグレーション実行
   - 並列実行（3シャード）

3. **E2E Tests**: 
   - Playwright使用
   - 3ブラウザ（Chromium, Firefox, WebKit）
   - 5シャード並列実行
   - スクリーンショット・トレース保存

4. **Performance Tests**: 
   - k6によるロードテスト
   - パフォーマンスベンチマーク
   - PRでの比較レポート

### Build Phase
- Next.js ビルド
- 環境変数の注入
- TypeDocドキュメント生成

## Deployment Configurations

### GitHub Pages Deployment
- **Target**: API Documentation
- **Trigger**: mainブランチへのpush
- **Path**: `/docs`

### E2E Test Reports
- **Target**: GitHub Pages
- **Path**: `/e2e-reports/{run_number}`
- **Retention**: 30日間

## Environment Management

### Required Environment Variables
```yaml
# Authentication
OPENAI_API_KEY
ANTHROPIC_API_KEY

# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# WebSocket
NEXT_PUBLIC_HUB_WS_URL
HUB_JWT_SECRET
BINANCE_WS_BASE_URL

# Infrastructure
REDIS_URL
KAFKA_BROKER_URL
DATABASE_URL

# Monitoring
SENTRY_DSN
CODECOV_TOKEN
```

### Environment-Specific Configurations
- **Development**: `.env.local`
- **Test**: `.env.test`
- **CI/CD**: GitHub Secretsで管理

### Test Infrastructure
```yaml
Services:
  - PostgreSQL 15
  - Redis 7
  - Mock Binance WebSocket Server
```

## Quality Gates and Checks

### Pre-merge Checks
1. **Code Quality**:
   - ESLint validation
   - Prettier formatting check
   - TypeScript strict mode

2. **Test Coverage**:
   - Codecovへのアップロード
   - PRへのカバレッジコメント
   - 失敗時のCI停止

3. **Performance**:
   - ベンチマーク比較
   - パフォーマンス劣化検知
   - PRへの結果コメント

### Post-merge Actions
1. **Nightly E2E Tests**:
   - フルブラウザテストスイート
   - パフォーマンステスト
   - 失敗時のSlack通知

2. **Weekly Documentation Update**:
   - TypeDoc自動生成
   - TODO/未実装機能レポート
   - 自動PR作成

3. **Monitoring & Alerts**:
   - Email通知（失敗時）
   - GitHub Issue自動作成
   - Slack Webhook統合

## Caching Strategy
- **Node Modules**: `actions/cache@v4`
- **Playwright Browsers**: ブラウザバージョン別キャッシュ
- **Dependencies**: `npm ci`による高速インストール

## Artifacts Management
- **Test Results**: 7-30日保持
- **Coverage Reports**: 1日保持（マージ後）
- **Performance Results**: 90日保持
- **E2E Screenshots/Videos**: 失敗時のみ保存

## Security Measures
- **Secrets Management**: GitHub Secrets使用
- **CORS Configuration**: 本番環境用設定
- **API Authentication**: JWT認証
- **Environment Isolation**: 環境別の設定分離