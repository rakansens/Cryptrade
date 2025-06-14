# Server-Sent Events (SSE) Implementation Plan

## 概要
現在、UI操作イベントは`window.dispatchEvent`を使用してクライアント側で配信していますが、サーバー側での実行時にはSSEによるリアルタイム通信が必要です。

## 現状
- `agent-selection.tool.ts`の`broadcastUIOperations`関数で以下のチェックを実施:
  ```typescript
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(event, { detail: data }));
  }
  ```
- サーバー環境では現在ログ出力のみ

## 実装計画

### Phase 1: SSE基盤構築
1. `/api/sse/events`エンドポイントの作成
2. イベントキューシステムの実装
3. クライアント側のEventSource接続管理

### Phase 2: イベント配信
1. UIイベントのサーバー側キューイング
2. SSE経由でのイベント配信
3. クライアント側でのイベント受信と処理

### Phase 3: 信頼性向上
1. 再接続メカニズム
2. イベントの順序保証
3. エラーハンドリング

## 実装例

### サーバー側 (Next.js API Route)
```typescript
// app/api/sse/events/route.ts
export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // イベントキューからの配信
      eventQueue.on('ui-event', (event) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      });
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### クライアント側
```typescript
// hooks/use-sse-events.ts
export function useSSEEvents() {
  useEffect(() => {
    const eventSource = new EventSource('/api/sse/events');
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // カスタムイベントとして配信
      window.dispatchEvent(
        new CustomEvent(data.event, { detail: data.data })
      );
    };
    
    return () => eventSource.close();
  }, []);
}
```

## 優先度
- **中**: 現在はクライアント側実行で問題ないが、将来的なサーバーサイドレンダリングやエッジ実行を考慮すると実装が望ましい

## 関連ファイル
- `/lib/mastra/tools/agent-selection.tool.ts` - broadcastUIOperations関数
- `/components/chart/hooks/useAgentEventHandlers.ts` - イベントリスナー実装