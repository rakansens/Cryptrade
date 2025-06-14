# Log Management System

## 概要

Enhanced Logger は、既存のロギングシステムを拡張し、フィルタリング、ページネーション、リアルタイム監視機能を提供します。

## 主な機能

- 🔍 **高度なフィルタリング** - レベル、ソース、時間範囲、メタデータで検索
- 📄 **ページネーション** - 大量のログを効率的に取得
- 📊 **統計情報** - エラー率、パフォーマンス指標を集計
- 🚀 **リアルタイム配信** - Server-Sent Eventsでログをストリーミング
- 💾 **柔軟なストレージ** - SQLite（開発）、PostgreSQL（本番）対応
- 🔄 **既存コードとの互換性** - 既存のlogger呼び出しを変更不要

## 使用方法

### 1. 基本的な使用（既存コードとの互換性）

```typescript
import { logger } from '@/lib/utils/logger';

// 既存のコードはそのまま動作
logger.info('User logged in', { userId: '123' });
logger.error('Payment failed', { error: 'Insufficient funds' });
```

### 2. 拡張機能の使用

#### コンテキスト管理

```typescript
// セッション全体にコンテキストを設定
await logger.withContext({ sessionId: 'abc123', userId: 'user456' }, async () => {
  // このブロック内のすべてのログにsessionIdとuserIdが自動付与
  logger.info('Processing order');
  await processOrder();
  logger.info('Order completed');
});
```

#### エージェント固有のロガー

```typescript
import { createAgentLogger } from '@/lib/utils/logger-enhanced';

const agentLogger = createAgentLogger('TradingAgent');
agentLogger.info('Analysis started', { symbol: 'BTCUSDT' });
// → [TradingAgent] Analysis started { symbol: 'BTCUSDT', agentName: 'TradingAgent' }
```

#### パフォーマンスロギング

```typescript
import { logPerformance } from '@/lib/utils/logger-enhanced';

const result = await logPerformance('Market data fetch', async () => {
  return await fetchMarketData();
});
// → 自動的に実行時間をログに記録
```

### 3. ログのクエリ

#### REST API経由

```bash
# 最新のエラーログを取得
GET /api/logs?level=error&limit=10&order=desc

# 特定のエージェントのログを検索
GET /api/logs?agentName=TradingAgent&search=failed

# 時間範囲でフィルタリング
GET /api/logs?from=2024-06-10T00:00:00Z&to=2024-06-10T23:59:59Z

# 統計情報を取得
GET /api/logs/stats?level=error,critical
```

#### プログラマティック

```typescript
// エラーログを検索
const errors = await logger.query({
  level: ['error', 'critical'],
  timeRange: {
    from: new Date(Date.now() - 86400000), // 過去24時間
    to: new Date()
  }
}, {
  limit: 100,
  sortBy: 'timestamp',
  order: 'desc'
});

// 統計を取得
const stats = await logger.getStats({
  agentName: 'TradingAgent'
});
console.log(`Total logs: ${stats.total}`);
console.log(`Errors: ${stats.byLevel.error}`);
```

### 4. リアルタイム監視

```typescript
// ログをリアルタイムで監視
const subscription = logger.subscribe({
  level: ['error', 'critical'],
  source: 'api'
}, (log) => {
  console.log('New error:', log.message);
  // Slackに通知、アラート発火など
});

// 監視を停止
subscription.unsubscribe();
```

#### SSE経由でブラウザから監視

```javascript
const eventSource = new EventSource('/api/logs/stream?level=error');

eventSource.onmessage = (event) => {
  const log = JSON.parse(event.data);
  console.error('Server error:', log);
};
```

## API リファレンス

### GET /api/logs

ログを検索・取得します。

**クエリパラメータ:**
- `level` - ログレベル（debug, info, warn, error, critical）
- `source` - ソース名
- `from` / `to` - 時間範囲（ISO 8601形式）
- `correlationId` - 相関ID
- `userId` - ユーザーID
- `sessionId` - セッションID
- `agentName` - エージェント名
- `toolName` - ツール名
- `search` - テキスト検索
- `tags` - タグ（カンマ区切り）
- `minDuration` / `maxDuration` - 実行時間範囲
- `page` - ページ番号（デフォルト: 1）
- `limit` - 取得件数（デフォルト: 50、最大: 1000）
- `sortBy` - ソートキー（timestamp, level, source, duration）
- `order` - ソート順（asc, desc）

**レスポンス:**
```json
{
  "data": [
    {
      "id": "1234567890-abc",
      "timestamp": "2024-06-10T10:00:00Z",
      "level": "error",
      "source": "api",
      "message": "Payment processing failed",
      "metadata": {
        "userId": "user123",
        "amount": 100
      },
      "agentName": "PaymentAgent",
      "duration": 1523
    }
  ],
  "pagination": {
    "total": 1523,
    "page": 1,
    "pages": 31,
    "limit": 50,
    "hasNext": true,
    "hasPrev": false
  },
  "executionTime": 23
}
```

### GET /api/logs/stats

ログの統計情報を取得します。

**レスポンス:**
```json
{
  "total": 15234,
  "byLevel": {
    "debug": 5000,
    "info": 8000,
    "warn": 1500,
    "error": 700,
    "critical": 34
  },
  "bySource": {
    "api": 5000,
    "agent": 3000,
    "tool": 2000
  },
  "performance": {
    "avgDuration": 234,
    "p50Duration": 150,
    "p95Duration": 800,
    "p99Duration": 1200
  },
  "topErrors": [
    {
      "message": "Rate limit exceeded",
      "count": 123,
      "lastOccurrence": "2024-06-10T10:30:00Z"
    }
  ]
}
```

### GET /api/logs/stream

Server-Sent Eventsでログをストリーミングします。

## 設定

### 環境変数

```env
# ログレベル
LOG_LEVEL=info  # debug, info, warn, error, critical

# ストレージ
LOG_STORAGE=sqlite  # sqlite, postgres, memory
LOG_DB_PATH=.mastra/logs.db  # SQLiteの場合

# 保持期間（日数）
LOG_RETENTION_DEBUG=1
LOG_RETENTION_INFO=7
LOG_RETENTION_WARN=30
LOG_RETENTION_ERROR=90
LOG_RETENTION_CRITICAL=365
```

### プログラマティック設定

```typescript
import { UnifiedLogger } from '@/lib/logging';

const customLogger = new UnifiedLogger({
  source: 'my-service',
  minLevel: 'info',
  bufferSize: 1000,
  flushInterval: 10000, // 10秒
  storage: 'postgres',
  connectionString: process.env.DATABASE_URL,
  retention: {
    debug: 1,
    info: 7,
    warn: 30,
    error: 90,
    critical: 365
  },
  enableStackTrace: true,
  beforeLog: (entry) => {
    // カスタムフィルタリング
    if (entry.message.includes('sensitive')) {
      return null; // ログをスキップ
    }
    return entry;
  }
});
```

## パフォーマンス

- **バッファリング**: ログは100件ごと、または5秒ごとにバッチ保存
- **インデックス**: timestamp, level, source, correlationIdにインデックス
- **自動クリーンアップ**: 保持期間を過ぎたログは自動削除
- **ストリーミング**: 大量のログはカーソルベースでストリーミング

## トラブルシューティング

### ログが保存されない

1. ストレージが初期化されているか確認
2. ログレベルが適切か確認
3. バッファがフラッシュされているか確認

### パフォーマンスが遅い

1. インデックスが作成されているか確認
2. 保持期間を短く設定
3. 不要なメタデータを削減

### メモリ使用量が多い

1. バッファサイズを調整
2. フラッシュ間隔を短く設定
3. ストリーミングAPIを使用