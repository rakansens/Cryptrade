# データベース統合改善実装ドキュメント

## 概要
このドキュメントは、Cryptradeプロジェクトのデータベース統合における改善実装について説明します。

## 実装した改善

### 1. エラーハンドリングの強化

#### 問題
- `Failed to add message` エラーでエラーオブジェクトが空 `{}` になっていた
- エラーの詳細情報が失われていた

#### 解決策
- `logger.ts` でErrorオブジェクトの適切なシリアライゼーション実装
- スタックトレースは開発環境のみで記録
- エラーの詳細情報（message, cause, カスタムプロパティ）を保持

### 2. データベース接続の健全性チェック

#### 実装内容
- `lib/db/health-check.ts` - データベースヘルスチェック機能
- `/api/health/db` - ヘルスチェックAPIエンドポイント
- 接続の検証と自動再接続
- グレースフルシャットダウン処理

#### 使用方法
```typescript
import { checkDatabaseHealth, validateDatabaseConnection } from '@/lib/db/health-check';

// ヘルスチェック
const health = await checkDatabaseHealth();
console.log(health); // { status: 'healthy', latency: 23, timestamp: '...' }

// 接続検証
const isConnected = await validateDatabaseConnection();
```

### 3. データ検証とサニタイゼーション

#### 実装内容
- `lib/services/database/chat.validation.ts` - Zodスキーマによる包括的な検証
- XSS攻撃防止のためのDOMPurify統合
- コンテンツ長制限（10,000文字）
- メタデータサイズ制限（10KB）

#### 検証スキーマ
- `ChatMessageSchema` - メッセージ検証
- `CreateSessionSchema` - セッション作成検証
- `UpdateSessionSchema` - セッション更新検証
- `PaginationSchema` - ページネーション検証

### 4. レート制限

#### 実装内容
- `lib/services/database/rate-limiter.ts` - インメモリレート制限
- 操作別の制限設定
- 自動クリーンアップ機能

#### 制限設定
```typescript
{
  createSession: {
    windowMs: 60 * 60 * 1000, // 1時間
    maxRequests: 5,
  },
  addMessage: {
    windowMs: 60 * 1000, // 1分
    maxRequests: 30,
  },
  bulkOperations: {
    windowMs: 60 * 1000, // 1分
    maxRequests: 5,
  },
}
```

### 5. キャッシング層

#### 実装内容
- `lib/services/database/chat-cache.ts` - LRUキャッシュ実装
- セッション、メッセージ、カウントのキャッシュ
- TTL（Time To Live）設定
- キャッシュ無効化機能

#### キャッシュ設定
- セッション: 1000件、10分TTL
- セッションリスト: 100件、5分TTL
- メッセージ: 500件、5分TTL
- メッセージカウント: 1000件、15分TTL

### 6. パフォーマンス最適化

#### 実装内容
- カーソルベースのページネーション
- バッチ操作のサポート
- インデックスの最適化
- クエリ結果のキャッシング

### 7. モニタリングとロギング

#### 実装内容
- Prismaクエリロギング（開発環境）
- エラーの詳細なロギング
- パフォーマンスメトリクス
- キャッシュ統計

## API使用例

### ヘルスチェック
```bash
curl http://localhost:3000/api/health/db
```

レスポンス例:
```json
{
  "status": "healthy",
  "timestamp": "2025-06-13T11:30:00.000Z",
  "checks": {
    "database": {
      "status": "healthy",
      "latency": 23,
      "timestamp": "2025-06-13T11:30:00.000Z"
    },
    "cache": {
      "status": "healthy",
      "stats": {
        "sessions": 42,
        "sessionLists": 5,
        "messages": 156,
        "messageCounts": 89
      }
    }
  }
}
```

## エラー対応

### "Failed to add message" エラーの解決

1. **データベース接続確認**
   ```bash
   npm run db:push
   ```

2. **ヘルスチェック実行**
   ```bash
   curl http://localhost:3000/api/health/db
   ```

3. **ログ確認**
   - `[Prisma Error]` でフィルタ
   - `[ChatDB]` でフィルタ

### レート制限エラー
```
Rate limit exceeded. Try again in 45 seconds
```
- 指定された時間待機
- または別のセッション/ユーザーIDを使用

## 本番環境への推奨事項

1. **Redis導入**
   - キャッシュとレート制限の分散対応
   - セッション管理の永続化

2. **監視ツール**
   - Datadogやnew Relicの統合
   - カスタムメトリクスの送信

3. **バックアップ**
   - 定期的な自動バックアップ
   - ポイントインタイムリカバリの設定

4. **セキュリティ**
   - Row Level Security (RLS) の実装
   - APIキーによる認証
   - IPアドレス制限

## トラブルシューティング

### 問題: データベース接続エラー
```
解決策:
1. Docker/Supabaseが起動しているか確認
2. 環境変数DATABASE_URLが正しいか確認
3. npm run db:push を実行
```

### 問題: キャッシュが効いていない
```
解決策:
1. キャッシュ統計を確認: /api/health/db
2. TTL設定を確認
3. invalidateSessionCache()が適切に呼ばれているか確認
```

### 問題: レート制限が厳しすぎる
```
解決策:
1. chatRateLimitsの設定を調整
2. 環境変数で設定可能にする
3. ユーザー種別によって制限を変える
```

## 今後の改善提案

1. **GraphQL統合**
   - より効率的なデータフェッチ
   - リアルタイムサブスクリプション

2. **イベントソーシング**
   - 完全な監査ログ
   - タイムトラベルデバッグ

3. **マルチテナント対応**
   - 組織単位のデータ分離
   - カスタムドメイン対応

4. **AI最適化**
   - ベクトルデータベース統合
   - 会話履歴の意味検索