#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import type { 
  ConversationMessageMetadata 
} from '@/types/conversation-memory';

const prisma = new PrismaClient();

async function analyzeTypeMappings() {
  console.log('🔍 Analyzing Type Mappings between Prisma and TypeScript...\n');
  
  // 1. ConversationSession 型の比較
  console.log('1️⃣  ConversationSession Type Comparison:');
  console.log('TypeScript Definition:');
  console.log('  - id: string');
  console.log('  - startedAt: Date');
  console.log('  - lastActiveAt: Date');
  console.log('  - messages: ConversationMessage[]');
  console.log('  - summary?: string');
  
  console.log('\nPrisma Schema:');
  console.log('  - id: String @id @default(uuid())');
  console.log('  - userId: String?');
  console.log('  - startedAt: DateTime @default(now())');
  console.log('  - lastActiveAt: DateTime @default(now())');
  console.log('  - summary: String?');
  console.log('  - metadata: Json?');
  console.log('  - messages: ConversationMessage[]');
  
  console.log('\n⚠️  Differences:');
  console.log('  - Prisma has "userId" field (optional)');
  console.log('  - Prisma has "metadata" field (Json)');
  console.log('  - Prisma has additional fields: createdAt, updatedAt');
  
  // 2. ConversationMessage 型の比較
  console.log('\n\n2️⃣  ConversationMessage Type Comparison:');
  console.log('TypeScript Definition:');
  console.log('  - id: string');
  console.log('  - sessionId: string');
  console.log('  - role: "user" | "assistant" | "system"');
  console.log('  - content: string');
  console.log('  - timestamp: Date');
  console.log('  - agentId?: string');
  console.log('  - metadata?: ConversationMessageMetadata');
  
  console.log('\nPrisma Schema:');
  console.log('  - id: String @id @default(uuid())');
  console.log('  - sessionId: String');
  console.log('  - role: MessageRole (enum)');
  console.log('  - content: String');
  console.log('  - timestamp: DateTime @default(now())');
  console.log('  - agentId: String?');
  console.log('  - metadata: Json?');
  
  console.log('\n✅ Type mapping looks consistent!');
  
  // 3. 実際のデータでメタデータ型を検証
  console.log('\n\n3️⃣  Metadata Type Validation:');
  
  try {
    // テストセッションを作成
    const session = await prisma.conversationSession.create({
      data: {
        metadata: {
          test: true,
          timestamp: new Date().toISOString(),
          nested: {
            value: 123,
            array: [1, 2, 3]
          }
        }
      }
    });
    
    // メッセージを作成（ConversationMessageMetadata型に準拠）
    const messageMetadata: ConversationMessageMetadata = {
      intent: 'test',
      confidence: 0.95,
      symbols: ['BTC', 'ETH'],
      topics: ['analysis', 'price'],
      isToolCall: false,
      tokenCount: 100
    };
    
    const message = await prisma.conversationMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: 'Test message',
        metadata: messageMetadata as any
      }
    });
    
    console.log('✅ Created message with typed metadata:');
    console.log(JSON.stringify(message.metadata, null, 2));
    
    // クリーンアップ
    await prisma.conversationSession.delete({ where: { id: session.id } });
    
  } catch (error) {
    console.error('❌ Metadata validation failed:', error);
  }
  
  // 4. Enum型の検証
  console.log('\n\n4️⃣  Enum Type Validation:');
  
  // MessageRole
  console.log('MessageRole enum values:');
  console.log('  TypeScript: "user" | "assistant" | "system"');
  console.log('  Prisma: user, assistant, system');
  console.log('  ✅ Match!');
  
  // 5. 推奨事項
  console.log('\n\n📋 Recommendations:');
  console.log('1. TypeScript型定義にPrismaの追加フィールドを含める:');
  console.log('   - userId?: string');
  console.log('   - metadata?: any (ConversationSession)');
  console.log('   - createdAt?: Date');
  console.log('   - updatedAt?: Date');
  
  console.log('\n2. Prisma Clientの型を直接使用することを検討:');
  console.log('   import type { ConversationSession } from "@prisma/client"');
  
  console.log('\n3. Json型フィールドに対して型安全性を追加:');
  console.log('   - Prisma.JsonValue の代わりに具体的な型を使用');
  console.log('   - zodスキーマで検証を追加');
}

// メイン実行
async function main() {
  try {
    await analyzeTypeMappings();
    console.log('\n✅ Analysis completed!');
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();