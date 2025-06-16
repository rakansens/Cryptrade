# E2E環境セットアップガイド

## 概要

このドキュメントでは、CryptradeプロジェクトのE2E（End-to-End）テスト環境の構築方法について説明します。

## 環境構成

### 1. テストサーバー (`test-server.js`)

Next.jsアプリケーションのテスト用サーバーです。以下の機能を提供します：

- **ポート**: 3001（デフォルト）
- **モックAPI**:
  - Binance API: `/api/binance/*`
  - OpenAI API: `/api/ai/*`, `/api/chat/*`
  - WebSocket: `ws://localhost:3001/ws`

### 2. Playwright設定 (`playwright.config.ts`)

最適化されたE2Eテスト設定：

- **並列実行**: ローカル4ワーカー、CI/CD 2ワーカー
- **タイムアウト**: テスト60秒、アサーション10秒
- **デバッグ機能**: スクリーンショット、ビデオ、トレース
- **ブラウザ**: Chrome、Firefox、Safari、モバイル

### 3. 環境変数 (`.env.test`)

テスト専用の環境変数：

```bash
# 基本設定
NODE_ENV=test
PORT=3001

# モックサービス
USE_MOCK_BINANCE=true
USE_MOCK_OPENAI=true

# データベース
DATABASE_URL=postgresql://test:test@localhost:5432/cryptrade_test
```

### 4. Docker構成 (`docker-compose.test.yml`)

完全なテスト環境をコンテナで構築：

- PostgreSQLデータベース
- Redisキャッシュ
- モックBinance WebSocketサーバー
- アプリケーションサーバー
- Playwrightテストランナー

## セットアップ手順

### ローカル環境

1. **依存関係のインストール**
   ```bash
   npm install
   ```

2. **環境変数の設定**
   ```bash
   cp .env.test .env.local
   ```

3. **テストサーバーの起動**
   ```bash
   npm run test:server
   # または
   node test-server.js
   ```

4. **E2Eテストの実行**
   ```bash
   npm run test:e2e
   ```

### Docker環境

1. **環境の起動**
   ```bash
   docker-compose -f docker-compose.test.yml up -d
   ```

2. **テストの実行**
   ```bash
   docker-compose -f docker-compose.test.yml run playwright
   ```

3. **環境の停止**
   ```bash
   docker-compose -f docker-compose.test.yml down
   ```

## npmスクリプト

`package.json`に以下のスクリプトを追加してください：

```json
{
  "scripts": {
    "test:server": "node test-server.js",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "PWDEBUG=1 playwright test",
    "test:e2e:docker": "docker-compose -f docker-compose.test.yml run playwright"
  }
}
```

## デバッグ

### UIモードでのデバッグ
```bash
npm run test:e2e:ui
```

### ステップ実行
```bash
npm run test:e2e:debug
```

### テスト結果の確認
- HTMLレポート: `playwright-report/index.html`
- JSONレポート: `e2e-test-results/results.json`
- スクリーンショット: `e2e-test-results/`

## CI/CD統合

GitHub Actionsでの実行例：

```yaml
- name: Run E2E tests
  run: |
    npm run test:server &
    npx wait-on http://localhost:3001
    npm run test:e2e
  env:
    CI: true
```

## トラブルシューティング

### ポート競合
- `PORT`環境変数でポートを変更
- `TEST_PORT`でテストサーバーのポートを指定

### タイムアウトエラー
- `playwright.config.ts`でタイムアウトを調整
- ネットワーク遅延を考慮した設定

### データベース接続
- PostgreSQLが起動していることを確認
- 接続文字列が正しいことを確認

## ベストプラクティス

1. **テストの独立性**: 各テストは独立して実行可能に
2. **データクリーンアップ**: テスト後のデータ削除
3. **適切なウェイト**: 明示的なウェイトよりも条件待機を使用
4. **エラーハンドリング**: 失敗時の詳細なログ出力

## 参考リンク

- [Playwright Documentation](https://playwright.dev/)
- [Next.js Testing](https://nextjs.org/docs/testing)
- [Docker Compose](https://docs.docker.com/compose/)