# 残りのデータベース統合タスク

## 概要

データベース統合の基盤は完成しましたが、実際のアプリケーションへの適用と追加機能の実装が必要です。

## 1. UIコンポーネントのDB版ストア移行

### 現状
- **0個**のコンポーネントがDB版ストアを使用
- **20個**のファイルが非DB版の`chat.store`を使用
- テストページ（`/test-db-integration`）のみDB版を使用

### 必要な作業

#### チャットコンポーネント
```typescript
// 変更前
import { useChat } from '@/store/chat.store';

// 変更後
import { useChat } from '@/store/chat.store.db';
```

対象ファイル：
- `/components/chat/ChatPanel.tsx`
- `/components/chat/ChatSidebar.tsx`
- `/components/chat/MessageList.tsx`
- `/components/chat/MessageItem.tsx`
- `/components/chat/FloatingChatPanel.tsx`
- `/hooks/use-ai-chat.ts`
- `/hooks/chat/use-message-handling.ts`
- `/hooks/chat/use-approve-proposal.ts`

## 2. DB統合が必要なストア

### 優先度: 高
- **market.store.ts** - リアルタイム市場データ
  - `MarketData`モデル使用
  - 価格履歴の永続化
  - オフライン時のキャッシュ

- **config.store.ts** - アプリケーション設定
  - localStorage直接使用を置換
  - ユーザー別設定の保存
  - テーマ、言語、表示設定

### 優先度: 中
- **chart.store.ts** - チャート全体の状態
- **chart-range.store.ts** - チャートレンジ管理
- **proposal-approval.store.ts** - 提案承認フロー

### 優先度: 低
- **ui-event.store.ts** - UIイベント（一時的なデータ）
- チャートサブストア（`/chart/stores/`配下）

## 3. 未実装のデータベースサービス

### MarketDataService
```typescript
// 実装例
export class MarketDataService {
  static async saveMarketData(data: MarketDataInput) {
    return prisma.marketData.create({ data });
  }
  
  static async getHistoricalData(symbol: string, interval: string, limit: number) {
    return prisma.marketData.findMany({
      where: { symbol, interval },
      orderBy: { time: 'desc' },
      take: limit
    });
  }
}
```

### UserService（認証システム）
- Supabase Auth統合
- プロフィール管理
- 設定同期

### SystemLogService
- エラートラッキング
- パフォーマンス分析
- デバッグ支援

### TechnicalIndicatorService
- 計算結果のキャッシュ
- 履歴データ管理

## 4. localStorage直接使用の移行

### 対象ファイル
1. **use-view-persistence.ts**
   - チャートビューの永続化
   - ズームレベル、表示範囲

2. **browser-notifications.ts**
   - 通知設定
   - 許可状態

3. **config.store.ts**
   - アプリ全体の設定

## 5. セキュリティ実装

### Row Level Security (RLS)
```sql
-- 例: ユーザーは自分のセッションのみアクセス可能
CREATE POLICY "Users can only access own sessions" ON conversation_sessions
  FOR ALL USING (auth.uid() = user_id);
```

### 認証フロー
1. Supabase Auth設定
2. ミドルウェア実装
3. 保護されたルート設定

## 6. 実装順序の推奨

### フェーズ1（即座に実装可能）
1. コンポーネントのDB版ストアへの切り替え
2. 統合テストの実行

### フェーズ2（1-2週間）
1. market.store.tsのDB統合
2. config.store.tsのDB統合
3. MarketDataServiceの実装

### フェーズ3（2-4週間）
1. 認証システムの実装
2. RLSポリシーの設定
3. ユーザー別データ分離

### フェーズ4（長期）
1. リアルタイム同期
2. パフォーマンス最適化
3. 高度なキャッシュ戦略

## 注意事項

- **段階的移行**: 一度にすべてを変更せず、機能ごとに移行
- **後方互換性**: 既存ユーザーのデータを保護
- **テスト重視**: 各段階で十分なテストを実施
- **監視**: エラー率とパフォーマンスを継続的に監視

## まとめ

基盤は整いました。次のステップは実際のコンポーネントでDB版ストアを使用することです。これにより、ユーザーはデータの永続性とクロスデバイス同期の恩恵を受けられます。