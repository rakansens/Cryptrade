# データベースデフォルト設定

## 概要

すべてのデータストアでデータベース同期がデフォルトで有効になりました。アプリケーション起動時から自動的にデータベースに保存され、localStorageは自動フォールバックとしてのみ使用されます。

## デフォルト設定

### 1. チャットストア (`/store/chat.store.ts`)
```typescript
isDbEnabled: true // デフォルトで有効
isSyncing: false
lastSyncTime: null
```

### 2. 分析履歴ストア (`/store/analysis-history.store.ts`)
```typescript
isDbEnabled: true // デフォルトで有効
isSyncing: false
currentSessionId: null
```

### 3. 会話メモリストア (`/lib/store/conversation-memory.store.ts`)
```typescript
isDbEnabled: true // デフォルトで有効
isSyncing: false
```

### 4. 拡張会話メモリストア (`/lib/store/enhanced-conversation-memory.store.ts`)
```typescript
isDbEnabled: true // デフォルトで有効
isSyncing: false
defaultProcessors: [
  TokenLimiter(127000),
  ToolCallFilter({ exclude: ['marketDataTool', 'chartControlTool'] })
]
```

### 5. チャート永続化マネージャー (`/lib/storage/chart-persistence.ts`)
```typescript
useDatabase: true // デフォルトで有効
fallbackToLocal: true
```

## 動作フロー

1. **データ保存時**:
   - データベースへの保存を試行
   - 失敗した場合、自動的にlocalStorageへフォールバック
   - エラーはログに記録されるが、ユーザー体験は中断されない

2. **データ読み込み時**:
   - データベースからの読み込みを試行
   - 失敗した場合、localStorageから読み込み
   - 両方で失敗した場合は空のデータを返す

3. **オフライン時**:
   - localStorageが自動的に使用される
   - オンライン復帰時に自動同期（実装予定）

## localStorage使用箇所（DB未対応）

以下の機能は引き続きlocalStorageを直接使用します：

1. **UI状態の永続化**:
   - `/hooks/use-view-persistence.ts`
   - `/hooks/use-view-persistence-simple.ts`
   - チャートのズームレベル、表示範囲など

2. **アプリケーション設定**:
   - `/store/config.store.ts`
   - テーマ、言語、表示設定など

3. **ブラウザ通知設定**:
   - `/lib/notifications/browser-notifications.ts`
   - 通知の許可状態

これらはブラウザ固有の設定であり、デバイス間での同期は不要なため、localStorageが適切です。

## 環境変数

データベース接続に必要な環境変数：

```env
# Supabase接続情報
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54332/postgres?pgbouncer=true
DIRECT_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54332/postgres

# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54331
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 注意事項

1. **初回起動時**: 既存のlocalStorageデータは自動的にデータベースに移行されます
2. **パフォーマンス**: データベース操作は非同期で行われ、UIをブロックしません
3. **エラーハンドリング**: すべてのDB操作にはフォールバックがあり、サービスが中断されることはありません
4. **セキュリティ**: 将来的にRow Level Security (RLS)を実装予定

## トラブルシューティング

### データが保存されない場合
1. Dockerが起動していることを確認
2. Supabaseコンテナが実行中であることを確認: `docker ps | grep supabase`
3. 環境変数が正しく設定されていることを確認
4. ブラウザの開発者ツールでエラーログを確認

### データベース接続エラー
- 自動的にlocalStorageにフォールバックされます
- エラーはコンソールに記録されますが、アプリケーションは正常に動作します

## 今後の改善予定

1. **オフライン同期キュー**: オフライン時の変更を記録し、オンライン復帰時に自動同期
2. **リアルタイム同期**: Supabase Realtimeを使用した複数デバイス間での即時同期
3. **データ圧縮**: 大量のチャート描画データの圧縮保存
4. **バックアップ機能**: ユーザーデータの定期バックアップ