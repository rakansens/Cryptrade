# Prisma Overview - Cryptradeプロジェクトでの活用

## 🎯 Prismaとは？

Prismaは次世代のNode.js/TypeScript向けORMで、以下の特徴があります：

### 1. **型安全なデータベースアクセス**
```typescript
// 自動生成された型付きクライアント
const user = await prisma.user.findUnique({
  where: { email: 'test@example.com' }
})
// user.email, user.name など、すべてTypeScriptで型補完が効く
```

### 2. **直感的なクエリAPI**
```typescript
// リレーションを含む複雑なクエリも簡単
const sessions = await prisma.conversationSession.findMany({
  where: {
    userId: 'user-id',
    createdAt: { gte: new Date('2024-01-01') }
  },
  include: {
    messages: true,
    analyses: {
      include: { touchEvents: true }
    }
  },
  orderBy: { createdAt: 'desc' }
})
```

### 3. **自動マイグレーション**
```bash
# スキーマ変更を検出して自動的にSQLを生成
npx prisma migrate dev

# 本番環境への適用
npx prisma migrate deploy
```

## ✅ Cryptradeプロジェクトへの適用状況

### 現在設定済みの機能：

1. **10個のデータベーステーブル**
   - ✅ users - ユーザー管理
   - ✅ conversation_sessions - チャットセッション
   - ✅ conversation_messages - メッセージ履歴
   - ✅ analysis_records - AI分析記録
   - ✅ touch_events - 価格タッチイベント
   - ✅ market_data - マーケットデータ
   - ✅ chart_drawings - チャート描画
   - ✅ pattern_analyses - パターン分析
   - ✅ system_logs - システムログ
   - ✅ technical_indicators - テクニカル指標

2. **リレーションシップ**
   - ユーザー → セッション → メッセージ
   - 分析記録 → タッチイベント
   - セッション → チャート描画

3. **型安全性**
   - すべてのモデルに対してTypeScript型が自動生成済み
   - IDEでの自動補完サポート

## 🚀 実装例

### 1. **ユーザーのセッションを取得**
```typescript
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function getUserSessions(userId: string) {
  return await prisma.conversationSession.findMany({
    where: { userId },
    include: {
      messages: {
        orderBy: { timestamp: 'desc' },
        take: 10
      }
    }
  })
}
```

### 2. **マーケットデータの保存**
```typescript
async function saveMarketData(data: {
  symbol: string
  interval: string
  ohlcv: { time: bigint; open: number; high: number; low: number; close: number; volume: number }[]
}) {
  return await prisma.marketData.createMany({
    data: data.ohlcv.map(candle => ({
      symbol: data.symbol,
      interval: data.interval,
      ...candle
    }))
  })
}
```

### 3. **AI分析の記録と追跡**
```typescript
async function createAnalysisWithTracking(analysisData: {
  symbol: string
  interval: string
  type: 'support' | 'resistance' | 'trendline'
  price: number
  confidence: number
}) {
  return await prisma.analysisRecord.create({
    data: {
      timestamp: BigInt(Date.now()),
      symbol: analysisData.symbol,
      interval: analysisData.interval,
      type: analysisData.type,
      proposalData: {
        price: analysisData.price,
        confidence: analysisData.confidence
      },
      trackingData: {
        status: 'monitoring',
        touches: 0
      }
    }
  })
}
```

### 4. **トランザクション処理**
```typescript
async function createSessionWithInitialMessage(userId: string, message: string) {
  return await prisma.$transaction(async (tx) => {
    // セッション作成
    const session = await tx.conversationSession.create({
      data: {
        userId,
        summary: 'New trading session'
      }
    })
    
    // 初期メッセージ追加
    const msg = await tx.conversationMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
        timestamp: new Date()
      }
    })
    
    return { session, message: msg }
  })
}
```

## 🛠️ 便利な機能

### 1. **Prisma Studio**
```bash
npm run db:studio
# http://localhost:5555 でGUIデータブラウザが開く
```

### 2. **型の自動生成**
```bash
npm run db:generate
# schema.prismaから型定義を自動生成
```

### 3. **データベースの内省**
```bash
npx prisma db pull
# 既存のデータベースからスキーマを生成
```

### 4. **シード処理**
```typescript
// prisma/seed.ts
async function seed() {
  await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User'
    }
  })
}
```

## 📊 パフォーマンス最適化

### 1. **選択的フィールド取得**
```typescript
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    _count: { select: { sessions: true } }
  }
})
```

### 2. **バッチ処理**
```typescript
await prisma.marketData.createMany({
  data: marketDataArray,
  skipDuplicates: true
})
```

### 3. **接続プーリング**
```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})
```

## 🔄 既存コードからの移行

### LocalStorageから：
```typescript
// Before
localStorage.setItem('analysis_history', JSON.stringify(data))

// After
await prisma.analysisRecord.create({ data })
```

### SQLiteから：
```typescript
// Before
db.run('INSERT INTO logs...', params)

// After
await prisma.systemLog.create({ data: logEntry })
```

## 🎉 まとめ

Cryptradeプロジェクトには、Prismaが完全に適用されており：

1. ✅ **スキーマ定義完了** - 10テーブル定義済み
2. ✅ **型安全性確保** - TypeScript型自動生成
3. ✅ **リレーション設定** - 適切な関連付け
4. ✅ **RLSポリシー適用** - セキュリティ設定済み
5. ✅ **開発環境整備** - Studio、マイグレーション対応

これにより、従来のSQLクエリ記述から解放され、型安全で保守性の高いデータベースアクセスが可能になりました！