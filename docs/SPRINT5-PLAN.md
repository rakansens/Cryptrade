# Sprint 5: Mastra/MCP ベストプラクティス実装

## 🎯 Sprint Goals

1. **Phase 1**: marketDataTool を Retry + CircuitBreaker 化 ✅
2. **Phase 2**: Telemetry & Streaming 対応 ✅
3. **Phase 3**: Memory/RAG 実装 ✅
4. **Phase 4**: Security強化（ToolAuthGuard、Prompt Lint）

## ✅ Phase 1 完了内容

### Retry + Circuit Breaker実装

**実装ファイル:**
- `lib/utils/retry-with-circuit-breaker.ts` - 汎用的なRetry/CB実装
- `lib/mastra/tools/market-data-resilient.tool.ts` - 強化版marketDataTool
- `lib/utils/__tests__/retry-with-circuit-breaker.test.ts` - 包括的なテスト

**主な機能:**
1. **Exponential Backoff**: 1秒 → 2秒 → 4秒の段階的リトライ
2. **Circuit Breaker States**: CLOSED → OPEN → HALF_OPEN
3. **Error Filtering**: 5xx/ネットワークエラーのみカウント
4. **Cache Layer**: 5秒TTLの簡易キャッシュ
5. **Metrics**: 成功/失敗/キャッシュヒット等の監視

**設定値:**
```typescript
{
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    backoffMultiplier: 2
  },
  circuitBreaker: {
    failureThreshold: 3,
    resetTimeout: 30000,
    halfOpenAttempts: 2
  }
}
```

**API:**
- `GET /api/monitoring/circuit-breaker` - CB状態確認
- `POST /api/monitoring/circuit-breaker` - 手動リセット（要認証）

## ✅ Phase 2 実装内容

### 2-1. Telemetry Sampling設定 ✅

**実装ファイル:**
- `config/env.ts` - 環境変数スキーマ更新
- `lib/mastra/mastra-config.ts` - 拡張Mastra設定
- `app/api/monitoring/telemetry/route.ts` - 監視API

**機能:**
1. **環境変数制御**: `TELEMETRY_SAMPLING_RATE=0.001` (0.1%)
2. **環境別設定**:
   - Development: `always_on`
   - Production: 確率的サンプリング
   - Test: `always_off`
3. **動的確認**: `/api/monitoring/telemetry`で現在の設定確認

### 2-2. Streaming対応 ✅

**実装ファイル:**
- `app/api/ai/stream/route.ts` - SSEストリーミングAPI
- `hooks/use-ai-stream.ts` - React Hook
- `components/chat/StreamingChatPanel.tsx` - UIコンポーネント

**機能:**
1. **Server-Sent Events**: リアルタイムストリーミング
2. **Abort制御**: ストリーミング中断機能
3. **エラーハンドリング**: 自動リトライ/フォールバック
4. **TypeScript型安全**: 完全な型定義

**使用例:**
```typescript
const { messages, isStreaming, sendMessage } = useAIStream({
  agentId: 'tradingAgent',
  onStreamStart: () => console.log('開始'),
  onStreamEnd: () => console.log('終了')
});
```

## 📊 メトリクス追加

### Circuit Breaker関連
- `market_data_requests` - リクエスト総数
- `market_data_success` - 成功数
- `market_data_failures` - 失敗数
- `market_data_circuit_open` - CB開放回数
- `market_data_cache_hits` - キャッシュヒット数
- `market_data_fallback` - フォールバック使用数

## 🧪 テスト

### 単体テスト
```bash
npm test retry-with-circuit-breaker.test.ts
```

### 統合テスト
```bash
# Circuit Breaker状態確認
curl http://localhost:3000/api/monitoring/circuit-breaker

# Telemetry設定確認
curl http://localhost:3000/api/monitoring/telemetry

# ストリーミングテスト
curl -X POST http://localhost:3000/api/ai/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "BTCの価格を教えて"}'
```

## 🐛 既知の問題と対策

1. **Circuit Breaker共有**: 現在は全symbolで共有 → symbol別CBも検討
2. **Cache無効化**: 手動クリアのみ → TTL自動削除実装予定
3. **Streaming互換性**: 一部のエージェントは未対応 → フォールバック実装済み

## 📈 パフォーマンス改善

### Before
- API障害時: 即座に失敗、ユーザーエラー表示
- 高負荷時: 全リクエスト処理、レスポンス遅延

### After
- API障害時: 3回リトライ後、キャッシュ/フォールバック
- 高負荷時: CB開放で即座にフォールバック応答
- 通常時: 5秒キャッシュで負荷軽減

## ✅ Phase 3 完了内容

### 3-1. Conversation Memory Store 実装 ✅

**実装ファイル:**
- `lib/store/conversation-memory.store.ts` - 会話履歴管理
- `lib/mastra/tools/memory-recall.tool.ts` - メモリアクセスツール
- `lib/services/semantic-embedding.service.ts` - 埋め込みベクトル生成
- `lib/store/__tests__/conversation-memory.store.test.ts` - 包括的テスト

**機能:**
1. **会話履歴管理**: 最新50メッセージを自動保持
2. **8メッセージコンテキスト**: Orchestratorは直近8件を参照
3. **セマンティック検索**: OpenAI Embeddingによる意味検索
4. **永続化**: Zustand persistで自動保存
5. **メタデータ抽出**: シンボル・トピック自動抽出

### 3-2. Orchestrator Memory Integration ✅

**更新内容:**
```typescript
// Memory設定追加
memory: {
  lastMessages: 8,
  semanticRecall: true,
}

// 自動的に会話履歴を保持・参照
```

**実装詳細:**
- 各クエリで自動的にメッセージを記録
- コンテキストを次のエージェントに渡す
- メタデータ（intent, symbols, topics）を自動抽出

### 3-3. Semantic Embedding Service ✅

**特徴:**
1. **OpenAI text-embedding-3-small**使用
2. **Circuit Breaker付きリトライ**
3. **埋め込みキャッシュ** (最大1000件)
4. **バッチ処理対応**
5. **コサイン類似度計算**

**使用例:**
```typescript
// セマンティック検索
const similar = await semanticSearch('BTCの分析', sessionId, 0.7);

// メモリツール使用
memoryRecallTool({
  sessionId: "current-session",
  operation: "search",
  query: "価格分析",
  limit: 10
})
```

## 📊 Phase 3 メトリクス

- メモリ容量: 50メッセージ/セッション
- コンテキスト参照: 最新8メッセージ
- 埋め込み次元: 1536 (text-embedding-3-small)
- キャッシュサイズ: 最大1000埋め込み
- 類似度閾値: 0.7 (デフォルト)

## 🧪 Phase 3 テスト

### 単体テスト
```bash
npm test conversation-memory.store.test.ts
```

### Memory API テスト
```bash
# セッション作成とメッセージ追加
curl -X POST http://localhost:3000/api/memory/session \
  -H "Content-Type: application/json" \
  -d '{"message": "BTCの価格を教えて"}'

# コンテキスト取得
curl http://localhost:3000/api/memory/context/{sessionId}

# セマンティック検索
curl -X POST http://localhost:3000/api/memory/search \
  -H "Content-Type: application/json" \
  -d '{"query": "価格分析", "sessionId": "..."}'
```

## 🚀 Next Steps (Phase 4)

### Phase 4: Security
- ToolAuthGuardミドルウェア
- Prompt Injection検出
- denylist.jsonによる危険語フィルタ

---

**Sprint 5 Status**: Phase 1, 2 & 3 ✅ COMPLETE  
**Remaining**: Phase 4 (Security)

Last Updated: 2025-01-03