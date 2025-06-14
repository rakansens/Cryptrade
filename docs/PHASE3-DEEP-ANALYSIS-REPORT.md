# Phase 3: 深層コードベース分析レポート

Phase 2完了後の詳細分析により、追加のリファクタリング機会と最適化箇所を特定。

## 🔍 主要発見事項サマリー

### 1. 🔥 **重複コードパターン (高優先度)**

#### A. ストリーミング関連の重複
**場所**: `hooks/use-analysis-stream.ts`, `hooks/use-ai-stream.ts`, `hooks/use-ui-event-stream.ts`

**問題**:
- 3つの異なるストリーミングフックで同じSSE処理ロジック
- カスタムfetch + ReadableStream処理の重複実装
- エラーハンドリングパターンの一貫性不足

**コード重複例**:
```typescript
// use-analysis-stream.ts:165-193 vs use-ai-stream.ts:119-150
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

const processStream = async () => {
  while (true) {
    const { done, value } = await reader.read();
    // 同じ処理ロジック...
  }
};
```

**推奨解決策**:
- `hooks/base/use-sse-stream.ts`: 統一SSEストリーミングフック
- `lib/api/sse-client.ts`: 再利用可能なSSEクライアント
- 予想コード削減: **60-70%**

#### B. 進捗表示コンポーネントの重複
**場所**: `components/chat/AnalysisProgress.tsx`, `components/chat/MLAnalysisProgress.tsx`

**問題**:
- 類似の進捗表示ロジック
- 同じ状態管理パターン (loading, progress, error)
- UI要素の重複 (Loader2, CheckCircle, XCircle)

**推奨解決策**:
- `components/shared/ProgressIndicator.tsx`: 汎用進捗コンポーネント
- プロップスインターフェースの標準化
- 予想コード削減: **40-50%**

#### C. 状態管理パターンの重複
**場所**: 複数のフックとコンポーネント

**問題**:
```typescript
// 8箇所で同じパターン
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [data, setData] = useState<T | null>(null);
```

**推奨解決策**:
- `hooks/base/use-async-state.ts`: 汎用非同期状態管理フック
- 予想コード削減: **30-40%**

### 2. 🎯 **抽象化機会 (高優先度)**

#### A. チャート描画アブストラクション不足
**場所**: `lib/chart/drawing-renderer.ts`, `lib/chart/pattern-renderer.ts`

**問題**:
- 各描画タイプで重複する座標変換ロジック
- キャンバス操作の散在

**推奨解決策**:
```typescript
// lib/chart/core/drawing-factory.ts
interface DrawingRenderer {
  render(ctx: CanvasRenderingContext2D, data: DrawingData): void;
  hitTest(point: Point, data: DrawingData): boolean;
  getBounds(data: DrawingData): Bounds;
}

class TrendlineRenderer implements DrawingRenderer { ... }
class FibonacciRenderer implements DrawingRenderer { ... }
```

#### B. API通信パターンの統一機会
**場所**: 複数のサービスクラス

**問題**:
- 異なるHTTPクライアント実装
- 一貫性のないエラーハンドリング
- レスポンス変換ロジックの重複

**推奨解決策**:
- `lib/api/base-service.ts`: 基底サービスクラス
- 統一レスポンス型とエラーハンドリング

### 3. 📋 **型定義統一機会 (中優先度)**

#### A. 重複型定義
**特定箇所**:
- `AnalysisStep` vs `MLAnalysisStep` (80%類似)
- `StreamMessage` vs `ChatMessage` (90%類似)
- `ProposalStatus` vs `AnalysisStatus` (70%類似)

**推奨解決策**:
```typescript
// types/shared/progress.ts
interface BaseProgressStep<T = any> {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  data?: T;
  startedAt?: Date;
  completedAt?: Date;
}

type AnalysisStep = BaseProgressStep<AnalysisStepData>;
type MLAnalysisStep = BaseProgressStep<MLStepData>;
```

#### B. 汎用化可能なインターフェース
**推奨新規型**:
```typescript
// types/shared/api.ts
interface PaginatedRequest {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pages: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

### 4. ⚙️ **設定管理改善機会 (中優先度)**

#### A. ハードコード値の散在
**発見箇所**:
- WebSocketタイムアウト: 30000ms (15箇所)
- リトライ回数: 3回 (12箇所)
- バッファサイズ: 100 (8箇所)
- レート制限: 60req/min (6箇所)

**推奨解決策**:
```typescript
// config/app-constants.ts
export const APP_CONSTANTS = {
  websocket: {
    timeout: 30000,
    maxRetries: 3,
    heartbeatInterval: 30000,
  },
  api: {
    rateLimit: {
      windowMs: 60000,
      maxRequests: 60,
    },
    timeout: 25000,
    retries: 3,
  },
  ui: {
    bufferSize: 100,
    animationDuration: 200,
    debounceMs: 300,
  },
} as const;
```

#### B. 環境変数アクセスの非統一
**問題**:
- `process.env.` 直接アクセス (23箇所)
- `getEnvVar()` ヘルパー使用 (15箇所)
- `env.` オブジェクト使用 (18箇所)

**推奨解決策**:
- 統一環境変数アクセサーの強制
- TypeScript設定でprocess.env直接アクセス禁止

### 5. 🛠️ **ユーティリティ整理機会 (低優先度)**

#### A. 散在ヘルパー関数
**重複発見**:
- 日付フォーマット処理 (7箇所)
- 数値検証ロジック (9箇所)  
- 文字列サニタイズ (5箇所)

**推奨統一**:
```typescript
// lib/utils/formatters.ts
export const formatters = {
  date: (date: Date, format: string) => { ... },
  number: (num: number, options?: NumberFormatOptions) => { ... },
  price: (price: number, currency?: string) => { ... },
};

// lib/utils/validators.ts
export const validators = {
  isValidSymbol: (symbol: string) => { ... },
  isValidInterval: (interval: string) => { ... },
  isValidPrice: (price: number) => { ... },
};
```

### 6. 🧩 **コンポーネント設計改善 (低優先度)**

#### A. プロップス標準化機会
**不統一パターン**:
- `onComplete` vs `onFinish` vs `onDone`
- `isLoading` vs `loading` vs `pending`
- `errorMessage` vs `error` vs `err`

**推奨標準化**:
```typescript
// types/shared/component-props.ts
interface BaseAsyncComponentProps {
  isLoading?: boolean;
  error?: string | Error | null;
  onComplete?: (result: any) => void;
  onError?: (error: Error) => void;
}

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  className?: string;
}
```

## 🎯 Phase 3実行計画提案

### ✅ 進捗トラッキング / TODO

> 更新日: **2025-06-11 24:05**

| 状態 | Phase | タスク | 備考 |
|:---:|:---|:---|:---|
| ✅ | 3.1 | LinearProgress 共通バー実装 & `AnalysisProgress`/`MLAnalysisProgress` へ導入 | PR #f1322b8 |
| ✅ | 3.1 | `stream-utils` でストリーム行パーサ共通化 | 使用箇所: `use-analysis-stream`, `use-ai-chat` |
| ✅ | 3.1 | `useAsyncState` 汎用フック追加 | `hooks/base/use-async-state.ts` |
| ✅ | 3.1 | `useSSEStream` 共通 SSE フック追加 | `hooks/base/use-sse-stream.ts` |
| ✅ | 3.1 | `use-ui-event-stream` を `useSSEStream` へ移行 | 旧 `sseManager` 依存解消 |
| 🟡 | 3.1 | `use-ai-stream.ts` を EventSource 版へ全面置換 | fetch+ReadableStream 実装を削除予定 |
| 🟡 | 3.1 | 主要フックで `useAsyncState` 置換 (`use-message-handling` 等) | 一部対応済み (#133311d) |
| ✅ | 3.1 | `components/shared/ProgressIndicator.tsx` 実装 & AnalysisProgress に適用 | PR #latest |
| ⬜ | 3.1 | `sseManager.ts` ファイル削除（参照箇所完全撤去後） | |
| 🟡 | 3.2 | 共通型定義抽出 (`types/shared/*`) | progress/chat・Proposal・ML 完了 |
| ✅ | 3.2 | `config/app-constants.ts` に設定値集約 | |
| 🟡 | 3.2 | `lib/api/base-service.ts` 実装 & 既存 API 置換 | base-service 完了、Binance 置換済み、他サービス残 |
| ⬜ | 3.3 | 共通フォーマッター & バリデーター統合 | |

**凡例**: ✅ 完了 / 🟡 進行中 / ⬜ 未着手

---

### 🆕 残タスク詳細（優先度順）

1. **use-ai-stream.ts**
   - [ ] fetch + `ReadableStream` を撤廃し `useSSEStream` ベースに書き換え
   - [ ] API `/api/ai/stream` のレスポンスを SSE フォーマットに完全統一

2. **ProgressIndicator コンポーネント**
   - [ ] `LinearProgress` + ラベル/アイコンをラップする汎用 UI を `components/shared/ProgressIndicator.tsx` として実装
   - [ ] `AnalysisProgress.tsx` / `MLAnalysisProgress.tsx` を置換

3. **useAsyncState 適用拡大**
   - [ ] `hooks/chat/use-message-handling.ts` を `useAsyncState` へ全面移行
   - [ ] `hooks/use-ai-chat.ts` など残りフックを段階的に置換

4. **型 & 設定の統合**
   - [ ] `types/shared/` で共通型を定義し各所インポート置換
   - [ ] `config/app-constants.ts` 作成後、ハードコード値を順次移行

5. **API 基盤の整理**
   - [ ] `lib/api/base-service.ts` を実装（fetch ラッパ + 共通エラーハンドリング）
   - [ ] 既存サービス/エンドポイントをベースサービス継承へ移行

6. **ユーティリティ統合**
   - [ ] `formatters.ts` / `validators.ts` を実装し、重複実装を削除

---

> 次のコミットでは **use-ai-stream.ts** の EventSource 化に着手することを推奨。

## 💡 期待効果

### 定量的効果
- **コード行数削減**: 15-20% (約1,200-1,600行)
- **重複排除**: 70%削減
- **開発時間短縮**: 新機能開発30%高速化
- **バグ発生率**: 25%削減予想

### 定性的効果
- コードベース理解性の大幅向上
- メンテナンス性向上
- 新メンバーのオンボーディング時間短縮
- アーキテクチャ一貫性確立

## 📋 次回実行指示

Phase 3実行時の推奨アプローチ:

1. **Phase 3.1** から順次実行
2. 各フェーズ完了後にテスト実行
3. 段階的マイグレーション（破壊的変更回避）
4. ドキュメント同時更新

**推奨実行時間**: 合計7-9時間
**推奨実行期間**: 2-3日間（段階的実行）

---

*このレポートは既存のPhase 1-2の成果を基に作成され、さらなる最適化機会を特定するものです。*