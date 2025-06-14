# コードベース リファクタリング計画

## 概要
コードベース全体を分析した結果、重複コードの削減、共通パターンの抽出、保守性向上のための以下のリファクタリング機会を特定しました。

## 1. API ルートハンドラーの共通化

### 現状の問題点
- 各APIルートで同様のミドルウェア構成が重複
- エラーハンドリングパターンが統一されていない
- レスポンス構築ロジックが散在
- SSE/ストリーミングレスポンスの実装が複数箇所で重複

### リファクタリング提案

#### 1.1 統一APIハンドラーファクトリー
```typescript
// lib/api/create-api-handler.ts
export function createApiHandler<T>({
  middleware,
  schema,
  handler,
  streaming = false
}: ApiHandlerConfig<T>) {
  return async (request: NextRequest) => {
    // 共通ミドルウェア処理
    // バリデーション
    // エラーハンドリング
    // レスポンス構築
  };
}
```

#### 1.2 SSE/ストリーミング抽象化
```typescript
// lib/api/streaming.ts
export class StreamingResponseBuilder {
  constructor(private encoder = new TextEncoder()) {}
  
  createSSEStream(eventGenerator: AsyncGenerator) {
    // 共通SSE実装
  }
  
  createEventStream(handler: StreamHandler) {
    // イベントストリーム共通実装
  }
}
```

## 2. React Hooks の共通ロジック抽出

### 現状の問題点
- ストリーミング/SSE接続ロジックが複数hookで重複
- エラーハンドリングパターンが不統一
- WebSocket接続管理が分散

### リファクタリング提案

#### 2.1 基底ストリーミングHook
```typescript
// hooks/base/use-streaming.ts
export function useStreaming<T>({
  endpoint,
  onMessage,
  onError,
  options
}: StreamingHookOptions<T>) {
  // 共通ストリーミングロジック
  // エラーハンドリング
  // 再接続ロジック
  // クリーンアップ
}
```

#### 2.2 WebSocket接続管理の統一
```typescript
// hooks/base/use-websocket.ts
export function useWebSocket({
  url,
  protocols,
  reconnect,
  heartbeat
}: WebSocketOptions) {
  // 統一WebSocket管理
  // 自動再接続
  // ハートビート
}
```

## 3. エラーハンドリングの標準化

### 現状の問題点
- エラークラスが統一されていない
- エラーレスポンス形式が不統一
- エラーロギングが散在

### リファクタリング提案

#### 3.1 統一エラークラス階層
```typescript
// lib/errors/index.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
  }
}

export class ValidationError extends AppError {}
export class ApiError extends AppError {}
export class StreamingError extends AppError {}
```

#### 3.2 グローバルエラーハンドラー
```typescript
// lib/api/error-boundary.ts
export function withErrorBoundary<T>(
  handler: ApiHandler<T>
): ApiHandler<T> {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error) {
      return handleError(error, res);
    }
  };
}
```

## 4. ロギング・モニタリングの統一

### 現状の問題点
- 複数のロガー実装が存在
- ログフォーマットが不統一
- メトリクス収集が分散

### リファクタリング提案

#### 4.1 統一ロガーインターフェース
```typescript
// lib/logging/unified-logger.ts
export interface UnifiedLogger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error?: Error, meta?: any): void;
  
  // 構造化ロギング
  log(level: LogLevel, event: LogEvent): void;
}
```

#### 4.2 メトリクス収集の中央化
```typescript
// lib/monitoring/metrics-collector.ts
export class CentralMetricsCollector {
  private collectors: Map<string, MetricCollector>;
  
  register(name: string, collector: MetricCollector) {}
  collect(name: string, value: number, labels?: Labels) {}
  export(format: 'prometheus' | 'json'): string {}
}
```

## 5. 型定義の整理と共通化

### 現状の問題点
- 似た型定義が複数ファイルに散在
- API レスポンス型が不統一
- イベント型定義が重複

### リファクタリング提案

#### 5.1 共通レスポンス型
```typescript
// types/api/responses.ts
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata: ResponseMetadata;
}

export interface StreamingResponse<T = any> {
  event: string;
  data: T;
  timestamp: number;
}
```

#### 5.2 イベント型の統一
```typescript
// types/events/index.ts
export interface BaseEvent {
  type: string;
  timestamp: number;
  sessionId?: string;
}

export interface UIEvent extends BaseEvent {
  event: string;
  data: any;
}
```

## 6. 実装優先順位

### Phase 1 (高優先度・即効性高)
1. **API ハンドラーファクトリーの実装**
   - 影響範囲: 全APIルート
   - 工数: 2-3日
   - 効果: コード削減率 30-40%

2. **エラーハンドリング統一**
   - 影響範囲: 全体
   - 工数: 2日
   - 効果: デバッグ効率向上、ユーザー体験改善

3. **ストリーミングHook基底クラス**
   - 影響範囲: 4つのhook
   - 工数: 1日
   - 効果: コード削減率 40%

### Phase 2 (中優先度)
4. **ロギング統一**
   - 影響範囲: 全体
   - 工数: 3日
   - 効果: 運用効率向上

5. **型定義整理**
   - 影響範囲: 全体
   - 工数: 2日
   - 効果: 開発効率向上

### Phase 3 (低優先度)
6. **テストユーティリティ共通化**
   - 影響範囲: テストファイル
   - 工数: 2日
   - 効果: テスト保守性向上

## 7. リスクと対策

### リスク
1. **破壊的変更による既存機能への影響**
   - 対策: 段階的移行、既存APIの一時的な互換レイヤー

2. **リファクタリング中の新機能開発との競合**
   - 対策: ブランチ戦略、小さな単位でのマージ

3. **パフォーマンスへの影響**
   - 対策: ベンチマークテスト、段階的ロールアウト

## 8. 成功指標

- コード行数削減率: 目標 25-30%
- 重複コード削減率: 目標 60%以上
- ビルド時間短縮: 目標 20%
- テストカバレッジ向上: 目標 80%以上
- 開発者の生産性: 新機能実装時間 30%短縮

## 9. 実装例

### Before (現状のAPIルート)
```typescript
// app/api/ai/chat/route.ts
export async function POST(request: NextRequest) {
  const middlewareResponse = await middleware(request);
  if (middlewareResponse) return middlewareResponse;
  
  try {
    const body = await request.json();
    // バリデーション...
    // 処理...
    const response = NextResponse.json(result);
    return applyCorsHeaders(applySecurityHeaders(response));
  } catch (error) {
    // エラーハンドリング...
  }
}
```

### After (リファクタリング後)
```typescript
// app/api/ai/chat/route.ts
export const POST = createApiHandler({
  middleware: [rateLimitMiddleware, authMiddleware],
  schema: ChatRequestSchema,
  handler: async ({ data, context }) => {
    return await chatService.process(data, context);
  }
});
```

## まとめ

このリファクタリング計画により、コードベースの保守性、拡張性、開発効率が大幅に向上します。段階的な実装により、リスクを最小限に抑えながら、継続的な改善を実現できます。