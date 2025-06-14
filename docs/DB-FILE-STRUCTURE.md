# データベース関連ファイル構成

## コアファイル構成

### 1. データベース接続
- **`/lib/db/prisma.ts`** - Prismaクライアント（メイン）
- **`/lib/db/supabase.ts`** - Supabaseクライアント（認証・Realtime用に保持）

### 2. データベースサービス (`/lib/services/database/`)
- **`chat.service.ts`** - チャット機能のDB操作
- **`chart-drawing.service.ts`** - チャート描画のDB操作
- **`analysis.service.ts`** - 分析履歴のDB操作

### 3. DB統合済みストア
- **`/store/chat.store.ts`** - チャットストア（DB統合済み）
- **`/store/analysis-history.store.ts`** - 分析履歴ストア（DB統合済み）
- **`/lib/store/conversation-memory.store.ts`** - 会話メモリストア（DB統合済み）
- **`/lib/store/enhanced-conversation-memory.store.ts`** - 拡張会話メモリストア（DB統合済み）

### 4. チャート永続化
- **`/lib/storage/chart-persistence.ts`** - チャート永続化マネージャー（DB統合済み）
- **`/lib/storage/chart-persistence-wrapper.ts`** - 互換性ラッパー

### 5. 初期化・プロバイダー
- **`/lib/store/initialize-db-stores.ts`** - ストア初期化ユーティリティ
- **`/components/providers/db-store-provider.tsx`** - Reactプロバイダー

### 6. テスト・デモページ
- **`/app/test-db-integration/page.tsx`** - DB統合テストページ
- **`/app/api/test/db-stats/route.ts`** - DB統計API

## 削除・統合されたファイル

### 削除されたファイル
- ❌ すべての `.db.ts` ファイル（既存ファイルに統合）
- ❌ 一時的なテストスクリプト（8ファイル）
- ❌ ルートディレクトリのテストファイル（3ファイル）

### アーカイブされたドキュメント
- 📁 `/docs/archive/` に移動：
  - DATABASE-MIGRATION-SUMMARY.md
  - TEST_EXECUTION_REPORT.md
  - TEST_IMPLEMENTATION_SUMMARY.md
  - COVERAGE_IMPROVEMENT_SUMMARY.md

## localStorage使用箇所（DB未統合・適切）

以下は引き続きlocalStorageを使用：
- `/hooks/use-view-persistence.ts` - UIビューステート
- `/hooks/use-view-persistence-simple.ts` - 簡易版
- `/store/config.store.ts` - アプリケーション設定
- `/lib/notifications/browser-notifications.ts` - 通知設定

これらはデバイス固有の設定のため、DB統合は不要です。

## ディレクトリ構造

```
cryptrade/
├── lib/
│   ├── db/
│   │   ├── prisma.ts              # Prismaクライアント
│   │   └── supabase.ts            # Supabaseクライアント
│   ├── services/
│   │   └── database/              # DBサービス層
│   │       ├── analysis.service.ts
│   │       ├── chart-drawing.service.ts
│   │       └── chat.service.ts
│   ├── storage/
│   │   ├── chart-persistence.ts   # DB統合済み
│   │   └── chart-persistence-wrapper.ts
│   └── store/
│       ├── conversation-memory.store.ts    # DB統合済み
│       ├── enhanced-conversation-memory.store.ts # DB統合済み
│       └── initialize-db-stores.ts
├── store/
│   ├── chat.store.ts              # DB統合済み
│   ├── analysis-history.store.ts  # DB統合済み
│   └── [その他のストア]           # 未統合
├── prisma/
│   └── schema.prisma              # データベーススキーマ
└── docs/
    ├── DB-DEFAULT-SETTINGS.md     # デフォルト設定
    ├── DB-FILE-STRUCTURE.md       # このファイル
    ├── DB-INTEGRATION-COMPLETE.md # 統合完了レポート
    ├── DB-TEST-SUMMARY.md         # テスト結果まとめ
    └── REMAINING-DB-TASKS.md      # 今後のタスク
```

## メリット

1. **シンプルな構成**: `.db.ts` ファイルを削除し、既存ファイルに統合
2. **一貫性**: すべてのDB操作がサービス層を通過
3. **保守性**: ファイル数を削減し、管理を簡素化
4. **互換性**: 既存のインポートはそのまま動作

## 今後の拡張ポイント

1. **未統合ストアのDB対応**:
   - `market.store.ts`
   - `chart.store.ts`
   - `proposal-approval.store.ts`

2. **リアルタイム機能**:
   - Supabase Realtimeの活用
   - WebSocket統合

3. **認証システム**:
   - Supabase Authの実装
   - Row Level Security