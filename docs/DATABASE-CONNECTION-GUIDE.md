# Database Connection Implementation Guide

## 現在の状況

### ✅ 準備完了
- Prismaスキーマ定義
- Supabaseローカル環境
- データベーステーブル
- TypeScript型定義

### ❌ 未実装
- データベースクライアントの初期化
- データ保存/読み込みのサービス層
- localStorageからの移行処理

## 実装が必要な箇所

### 1. **チャート描画の永続化**

現在（localStorage）:
```typescript
// lib/storage/chart-persistence.ts
localStorage.setItem('cryptrade_chart_drawings', JSON.stringify(drawings))
```

データベース版:
```typescript
// lib/services/database/chart.service.ts
import { prisma } from '@/lib/db/prisma'

export class ChartService {
  static async saveDrawing(sessionId: string, drawing: any) {
    return await prisma.chartDrawing.create({
      data: {
        sessionId,
        type: drawing.type,
        points: drawing.points,
        style: drawing.style,
        visible: drawing.visible
      }
    })
  }
  
  static async getDrawings(sessionId: string) {
    return await prisma.chartDrawing.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' }
    })
  }
}
```

### 2. **チャット履歴の永続化**

現在（Zustand + localStorage）:
```typescript
// store/chat.store.ts
persist: {
  name: 'chat-storage'
}
```

データベース版:
```typescript
// lib/services/database/chat.service.ts
export class ChatService {
  static async createSession(userId: string) {
    return await prisma.conversationSession.create({
      data: { userId }
    })
  }
  
  static async addMessage(sessionId: string, message: any) {
    return await prisma.conversationMessage.create({
      data: {
        sessionId,
        role: message.role,
        content: message.content,
        metadata: message.metadata
      }
    })
  }
}
```

### 3. **分析履歴の永続化**

現在:
```typescript
// store/analysis-history.store.ts
localStorage.setItem('analysis-history-storage', JSON.stringify(state))
```

データベース版（作成済み）:
```typescript
// lib/services/database/analysis.service.ts
AnalysisService.saveAnalysis(data)
AnalysisService.recordTouchEvent(touchData)
```

## 移行戦略

### Phase 1: ハイブリッドアプローチ
1. localStorageとデータベースの両方に保存
2. 読み込み時はデータベースを優先、なければlocalStorage
3. バックグラウンドで同期

### Phase 2: 完全移行
1. 新規データはデータベースのみ
2. 既存データの移行ツール実行
3. localStorageはキャッシュとして使用

## 実装例：チャート描画の移行

```typescript
// components/chart/hooks/useChartSync.ts
import { useEffect } from 'react'
import { ChartService } from '@/lib/services/database/chart.service'
import { chartPersistence } from '@/lib/storage/chart-persistence'

export function useChartSync(sessionId: string) {
  useEffect(() => {
    // 起動時：データベースから読み込み
    ChartService.getDrawings(sessionId).then(drawings => {
      // ストアに反映
      useChartStore.setState({ drawings })
    })
  }, [sessionId])
  
  // 保存時：両方に保存
  const saveDrawing = async (drawing: any) => {
    // localStorage（即座に反映）
    chartPersistence.saveDrawing(drawing)
    
    // データベース（バックグラウンド）
    try {
      await ChartService.saveDrawing(sessionId, drawing)
    } catch (error) {
      console.error('DB save failed, using localStorage', error)
    }
  }
}
```

## リアルタイム同期（Supabase Realtime）

```typescript
// lib/hooks/useRealtimeSync.ts
import { supabase } from '@/lib/db/supabase'

export function useRealtimeDrawings(sessionId: string) {
  useEffect(() => {
    const channel = supabase
      .channel(`drawings:${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chart_drawings',
        filter: `sessionId=eq.${sessionId}`
      }, (payload) => {
        // 他のクライアントからの変更を反映
        if (payload.eventType === 'INSERT') {
          addDrawingToStore(payload.new)
        }
      })
      .subscribe()
      
    return () => {
      channel.unsubscribe()
    }
  }, [sessionId])
}
```

## 注意点

1. **BigInt の扱い**
   - タイムスタンプはBigIntで保存
   - JSON化時は文字列に変換必要

2. **トランザクション**
   - 関連データは同時に保存
   - エラー時のロールバック

3. **パフォーマンス**
   - 頻繁な更新はデバウンス
   - バッチ処理の活用

4. **オフライン対応**
   - localStorageをキャッシュとして使用
   - オンライン復帰時に同期