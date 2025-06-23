# TestContainersセットアップガイド

## 概要
DockerコンテナでPostgreSQLを使用した実データベーステスト環境の構築

## クイックスタート

### 1. 依存関係のインストール
```bash
npm install --save-dev @testcontainers/postgresql testcontainers pg
```

### 2. データベーステストの実行
```bash
# 全データベーステストを実行
npm run test:db

# ウォッチモードで実行
npm run test:db:watch

# マイグレーションスクリプトを実行
npm run db:test:migrate
```

## テストの書き方

```typescript
import { dbTestUtils } from '../../utils/db-test-utils';

describe('データベーステスト', () => {
  beforeAll(async () => {
    await dbTestUtils.waitForDatabase();
  });

  it('ユーザーを作成できる', async () => {
    const user = await dbTestUtils.createTestUser();
    expect(user.email).toBeDefined();
  });
});
```

## 主な機能

- 🐳 自動的なPostgreSQLコンテナの起動・停止
- 🔄 Prismaスキーマの自動マイグレーション
- 🧹 テスト毎のデータベースクリーンアップ
- 🏃 並列実行対応
- 📊 本番環境と同じPostgreSQLを使用

## トラブルシューティング

### Dockerが起動していない場合
```bash
# Docker Desktopを起動してください
docker version
```

### コンテナが起動しない場合
```bash
# タイムアウトを延長
jest.setTimeout(300000); // 5分
```