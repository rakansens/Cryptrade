# コード重複リファクタリング計画

実施日: 2025-06-28
担当: Claude Code

## 概要

`similarity-ts` による解析結果、450個の重複ペアを発見しました。特に高い類似度（85%以上）を示すコードが多数存在し、リファクタリングによる大幅な改善が見込めます。

## 主要な重複パターン

### 1. React Hooks における共通パターン

#### 最も深刻な重複（86-90%の類似度）

1. **useApproveProposal と類似フック群**
   - `useApproveProposal` (232行)
   - `useAIStream` (190行) - 86.79%類似
   - `useLineTracking` (140行) - 86.96%類似
   - `useMessageHandling` (121行) - 90.12%類似

   **問題点**: SSEストリーミング、状態管理、エラーハンドリングのパターンが重複

2. **ストリーミング関連フック**
   - `useStreamBase` (272行)
   - `useChartInstance` (308行) - 86.17%類似
   
   **問題点**: WebSocket/SSE接続管理ロジックが重複

### 2. 技術計算関数の重複

1. **指標計算関数**
   - `calculateSMA` / `calculateEMA` / `calculateRSI` / `calculateBollingerBands`
   - 複数箇所に同じ実装が存在（94%以上の類似度）

2. **パフォーマンステスト内の重複**
   - `scripts/benchmark-performance.js:calculateRSI`
   - `tests/scripts/test-performance-after.ts:calculateRSI`
   - 99.17%類似（ほぼ完全に同一）

### 3. テストヘルパー関数の重複

1. **モック生成関数**
   - 複数のテストファイルで同様のモック生成パターン
   - zustand middlewareのモック実装が特に重複

### 4. API/ミドルウェアパターンの重複

1. **エラーハンドリング**
   - 複数のAPI routeで同じエラーハンドリングパターン
   - レート制限、サーキットブレーカーの実装が重複

## リファクタリング戦略

### Phase 1: 共通基盤の構築（優先度: 高）

#### 1.1 React Hooks基盤

```typescript
// hooks/base/use-streaming-base.ts
export function useStreamingBase<T>({
  endpoint,
  onMessage,
  onError,
  onOpen,
  onClose,
  transformPayload
}: StreamingOptions<T>) {
  // 共通のSSE/WebSocket管理ロジック
}

// hooks/base/use-async-operation.ts
export function useAsyncOperation<T>({
  operation,
  onSuccess,
  onError,
  dependencies = []
}: AsyncOperationOptions<T>) {
  // 共通の非同期操作パターン
}
```

#### 1.2 指標計算ライブラリの統合

```typescript
// lib/indicators/index.ts
export * from './moving-averages';
export * from './oscillators';
export * from './volatility';

// lib/indicators/moving-averages.ts
export class MovingAverageCalculator {
  static sma(data: number[], period: number): number[]
  static ema(data: number[], period: number): number[]
}
```

### Phase 2: 既存コードのリファクタリング（優先度: 中）

#### 2.1 Hooks の移行

1. `useApproveProposal` → `useChatProposalBase` + `useStreamingBase`
2. `useAIStream` → `useStreamingBase` + カスタムハンドラー
3. `useLineTracking` → `useAsyncOperation` + 専用ロジック

#### 2.2 重複関数の削除

1. テスト用計算関数を共通ライブラリに統合
2. モックヘルパーを `tests/helpers` に集約

### Phase 3: テストとドキュメント（優先度: 中）

1. リファクタリング後の包括的なテスト
2. 移行ガイドの作成
3. 型定義の強化

## 実装スケジュール

### Week 1: 基盤構築
- [ ] streaming基盤の実装
- [ ] async操作基盤の実装
- [ ] 指標計算ライブラリの統合

### Week 2: Hooks移行
- [ ] useApproveProposal系の移行
- [ ] ストリーミング系フックの移行
- [ ] テストの更新

### Week 3: クリーンアップ
- [ ] 重複コードの削除
- [ ] ドキュメント更新
- [ ] パフォーマンステスト

## 期待される効果

1. **コード量削減**: 約30-40%のコード削減
2. **保守性向上**: 単一責任の原則に従った設計
3. **テスト効率**: 共通部分のテストが一箇所で完結
4. **型安全性**: より厳密な型定義による安全性向上

## リスクと対策

1. **破壊的変更のリスク**
   - 段階的な移行とfeature flagの使用
   - 十分なテストカバレッジの確保

2. **パフォーマンスへの影響**
   - ベンチマークテストによる性能監視
   - 必要に応じた最適化

## 具体的な重複パターンの詳細分析

### 1. ストリーミング処理パターンの重複

**該当ファイル:**
- `hooks/use-ai-stream.ts` (242行)
- `hooks/base/use-streaming.ts` (373行)

**重複内容:**
```typescript
// 両ファイルで類似の状態管理
const [messages/data, setMessages/setData] = useState<T[]>([]);
const [isStreaming, setIsStreaming] = useState(false);
const [error, setError] = useState<Error | null>(null);

// 再接続ロジックの重複
reconnectAttemptsRef.current = 0;
reconnectTimeoutRef.current = setTimeout(() => {
  if (isMountedRef.current) {
    connect();
  }
}, delay);
```

**問題点:**
- SSE処理とfetchストリーム処理が別々に実装されている
- エラーハンドリングと再接続ロジックが重複
- `use-ai-stream.ts`は`use-sse-stream.ts`を使用しているが、`use-streaming.ts`にも独自のSSE実装がある

### 2. 提案承認処理の基盤パターン

**該当ファイル:**
- `hooks/chat/use-approve-proposal.ts` (257行)
- `hooks/shared/useChatProposalBase.ts`（基盤）

**重複内容:**
```typescript
// バリデーション処理（基盤使用しているが不完全）
const validation = proposalBase.validateProposalRequest(message, proposalId, true);
if (!validation.success) {
  throw new Error(validation.error || 'Validation failed');
}

// エラーハンドリング（まだ独自実装が残る）
proposalBase.handleProposalError(error, validation.context, 'Proposal approval');
showProposalApprovalError(error as Error);
```

**問題点:**
- 基盤を使用しているが、まだ多くの独自ロジックが残っている
- チャートイベント処理（84-148行）、分析レコード作成（159-213行）などが基盤化されていない

### 3. インジケーター計算パターン

**該当ファイル:**
- `lib/indicators/moving-average.ts` (SMA: 23-84行, EMA: 93-153行)
- `lib/indicators/rsi.ts` (29-128行)
- `lib/indicators/ema-indicator.ts`（新規クラスベース）

**重複内容:**
```typescript
// 全てのインジケーターで同じバリデーションパターン
const validation = validatePriceData(data, {
  minLength: period,
  checkMonotonic: true,
  allowNaN: false,
  allowInfinity: false
});

if (!validation.valid) {
  return handleIndicatorError('SMA/EMA/RSI', new Error(validation.error!), []);
}

if (validation.warnings) {
  validation.warnings.forEach(warning => {
    logger.warn(`[SMA/EMA/RSI] ${warning}`);
  });
}
```

**問題点:**
- 同じバリデーション、エラーハンドリング、ログ処理が各インジケーターで重複
- EMAは`@deprecated`でクラスベースに移行中だが、他のインジケーターはまだ関数ベース

## 具体的な重複解消例

### Before:
```typescript
// hooks/chat/use-approve-proposal.ts
export function useApproveProposal() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // 200行以上の実装...
}

// hooks/use-ai-stream.ts
export function useAIStream() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // ほぼ同じパターンの実装...
}
```

### After:
```typescript
// hooks/chat/use-approve-proposal.ts
export function useApproveProposal() {
  const proposalBase = useChatProposalBase({
    hookName: 'useApproveProposal',
    defaultSymbol: 'BTCUSDT',
  });

  const stream = useStreamingBase({
    endpoint: '/api/chat/approve',
    onMessage: handleProposalUpdate,
    transformPayload: transformProposalPayload
  });

  // 専用ロジックのみ（50行程度）
}
```

## リファクタリング優先順位

1. **高優先度: インジケーター基底クラス**
   - 最も重複が多く、影響範囲が明確
   - テストが充実しているため安全にリファクタリング可能
   - 推定削減コード: 約300行

2. **中優先度: ストリーミング処理の統合**
   - パフォーマンスに影響する可能性があるため慎重に実施
   - 既存のフックを使用している箇所への影響を考慮
   - 推定削減コード: 約400行

3. **低優先度: 提案処理の完全基盤化**
   - すでに部分的に基盤化されている
   - ビジネスロジックが複雑なため段階的に実施
   - 推定削減コード: 約200行

## 成功指標

1. 重複コード率を現在の40%から10%以下に削減
2. テスト実行時間を20%短縮
3. 新機能開発時の実装時間を30%短縮

## 次のステップ

1. このプランのレビューと承認
2. Phase 1の詳細設計
3. プロトタイプ実装とベンチマーク

## Follow-ups

- [x] similarity-tsによる重複コード分析の実施
- [x] 重複コードの具体例を詳細に分析
- [ ] BaseIndicatorクラスの詳細設計
- [ ] ストリーミング処理統合の影響調査
- [ ] 提案処理基盤の拡張計画
- [ ] パフォーマンスベンチマークの実施