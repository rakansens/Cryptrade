# UI Event System 型安全化マイグレーションガイド

## 概要

UIイベントシステムを完全に型安全化しました。`any`型を排除し、すべてのイベントが型定義から自動生成されるようになりました。

## 主な変更点

### 1. ❌ Before: ハードコードされたイベントタイプ
```typescript
// hooks/use-ui-event-stream.ts
eventTypes: [
  'ui-event',
  'ping',
  'draw:trendline',
  'draw:fibonacci',
  // ... 20+ ハードコードされたイベント
],
```

### 2. ✅ After: 型定義から自動生成
```typescript
// types/events/all-event-types.ts
export const AllEventTypes = {
  'draw:trendline': z.object({ /* schema */ }),
  'draw:fibonacci': z.object({ /* schema */ }),
  // ... すべて型定義付き
} as const;
```

## 移行手順

### Step 1: プロバイダーの置き換え

```diff
// app/layout.tsx
- import { UIEventProvider } from '@/components/providers/UIEventProvider';
+ import { TypedUIEventProvider } from '@/components/providers/TypedUIEventProvider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
-       <UIEventProvider>
+       <TypedUIEventProvider debug={process.env.NODE_ENV === 'development'}>
          {children}
-       </UIEventProvider>
+       </TypedUIEventProvider>
      </body>
    </html>
  );
}
```

### Step 2: イベント公開の型安全化

```diff
// Before: any型を使用
- const { publish } = useUIEventStream();
- await publish({
-   event: 'chart:addDrawing',
-   data: { id: '123', type: 'trendline' } // 型チェックなし
- });

// After: 完全型安全
+ const { publishEvent } = useUIEventContext();
+ await publishEvent('chart:addDrawing', {
+   id: '123',
+   type: 'trendline',
+   points: [{ time: 1234, value: 100 }], // 必須フィールドが強制される
+ });
```

### Step 3: イベントリスナーの型安全化

```diff
// Before: any型のイベントデータ
- useEffect(() => {
-   const handler = (event: any) => {
-     const data = event.detail; // any型
-     console.log(data.id); // 型チェックなし
-   };
-   window.addEventListener('chart:addDrawing', handler);
-   return () => window.removeEventListener('chart:addDrawing', handler);
- }, []);

// After: 型安全なリスナー
+ import { useTypedEventListener } from '@/hooks/use-typed-ui-event-stream';
+ 
+ useTypedEventListener('chart:addDrawing', (payload) => {
+   // payload は ChartEventPayload<'addDrawing'> 型
+   console.log(payload.id); // 型安全！
+   console.log(payload.points[0].time); // オートコンプリート可能
+ });
```

### Step 4: 便利なイベント公開関数

```typescript
// 事前定義されたイベント公開関数を使用
import { EventPublishers } from '@/components/providers/TypedUIEventProvider';

function MyComponent() {
  const publish = usePublishEvent();
  
  const handleDrawTrendline = () => {
    // 型安全な専用関数
    EventPublishers.drawTrendline(publish)({
      points: [
        { time: Date.now(), value: 100 },
        { time: Date.now() + 1000, value: 110 },
      ],
    });
  };
  
  const handleChangeSymbol = () => {
    EventPublishers.changeSymbol(publish)({
      symbol: 'BTCUSDT',
    });
  };
}
```

## 新しい型定義

### イベントタイプ一覧
```typescript
type EventTypeName = 
  // Drawing events
  | 'draw:trendline'
  | 'draw:fibonacci'
  | 'draw:horizontal'
  | 'draw:vertical'
  // Chart control
  | 'chart:fitContent'
  | 'chart:startDrawing'
  | 'chart:addDrawing'
  | 'chart:deleteDrawing'
  // UI control
  | 'ui:changeSymbol'
  | 'ui:changeTimeframe'
  | 'ui:toggleIndicator'
  // Proposals
  | 'proposal:approve'
  | 'proposal:reject'
  // ... etc
```

### イベントペイロード型
```typescript
// 各イベントのペイロードは自動的に推論される
type TrendlinePayload = EventPayload<'draw:trendline'>;
// {
//   points: Array<{ time: number; value: number }>;
//   style?: { color?: string; lineWidth?: number; };
// }
```

## フィルタリング機能

```typescript
// 特定のイベントグループのみ受信
<TypedUIEventProvider
  groupFilter={['drawing', 'chart']} // 描画とチャート関連のみ
  eventFilter={['ui:changeSymbol']} // 追加で個別イベントも
>
  {children}
</TypedUIEventProvider>
```

## デバッグ機能

```typescript
// デバッグモードで詳細ログ出力
<TypedUIEventProvider debug={true}>
  {/* すべてのイベント送受信がログに出力される */}
</TypedUIEventProvider>
```

## エラーハンドリング

```typescript
function MyApp() {
  return (
    <TypedUIEventProvider
      onError={(error) => {
        // 型安全なエラーハンドリング
        console.error('UI Event Error:', error);
        toast.error('イベント送信に失敗しました');
      }}
      onConnectionChange={(connected) => {
        // 接続状態の監視
        if (!connected) {
          toast.warning('サーバーとの接続が切断されました');
        }
      }}
    >
      {children}
    </TypedUIEventProvider>
  );
}
```

## パフォーマンス最適化

新しいシステムは以下の最適化を含みます：

1. **イベント検証の最適化**: Zodスキーマによる高速な検証
2. **フィルタリング**: 不要なイベントの早期除外
3. **型推論の最適化**: TypeScriptコンパイラの負荷軽減
4. **メモリ効率**: WeakMapを使用したイベントリスナー管理（将来実装予定）

## 互換性

- 既存の`useUIEventStream`は引き続き動作しますが、非推奨です
- 新規開発では`useTypedUIEventStream`を使用してください
- 段階的な移行が可能です

## トラブルシューティング

### Q: 型エラーが発生する
A: `EventPayload<T>`型を確認し、必須フィールドがすべて含まれているか確認してください

### Q: イベントが受信されない
A: `eventFilter`や`groupFilter`の設定を確認してください

### Q: CustomEventの型が合わない
A: `createTypedEvent`ヘルパー関数を使用してください