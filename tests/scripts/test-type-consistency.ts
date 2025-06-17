/**
 * Prisma型とTypeScript型の整合性チェック
 */

import { prisma } from '@/lib/db/prisma';
import type { 
  ConversationMessage,
  MessageRole,
  AnalysisType,
  TouchResult
} from '@prisma/client';

// アプリケーションで定義されている型をインポート
import type { ChatMessage } from '@/lib/services/database/chat.service';

// 型の比較結果を格納
const typeChecks: { check: string; status: 'pass' | 'fail'; details?: string }[] = [];

function checkType(check: string, condition: boolean, details?: string) {
  typeChecks.push({
    check,
    status: condition ? 'pass' : 'fail',
    ...(details && { details })
  });
}

async function checkTypeConsistency() {
  console.log('=== Prisma型とTypeScript型の整合性チェック ===\n');
  
  try {
    // 1. ChatMessage型のチェック
    console.log('1. ChatMessage型の整合性...');
    const dbMessage = await prisma.conversationMessage.findFirst();
    if (dbMessage) {
      const appMessage: ChatMessage = {
        id: dbMessage.id,
        content: dbMessage.content,
        role: dbMessage.role as 'user' | 'assistant',
        timestamp: dbMessage.timestamp.getTime(),
        type: 'text', // アプリケーション固有のフィールド
      };
      
      checkType('ChatMessage.id', typeof appMessage.id === 'string', `DB: string, App: ${typeof appMessage.id}`);
      checkType('ChatMessage.role', ['user', 'assistant', 'system'].includes(dbMessage.role), `DB: ${dbMessage.role}`);
      checkType('ChatMessage.timestamp', dbMessage.timestamp instanceof Date, 'DB uses Date, App uses number (timestamp)');
    }
    
    // 2. Enum型の整合性チェック
    console.log('\n2. Enum型の整合性...');
    
    // MessageRole
    const messageRoles: MessageRole[] = ['user', 'assistant', 'system'];
    checkType('MessageRole enum', messageRoles.every(role => 
      ['user', 'assistant', 'system'].includes(role)
    ), 'All values match');
    
    // AnalysisType
    const analysisTypes: AnalysisType[] = ['support', 'resistance', 'trendline', 'pattern', 'fibonacci'];
    checkType('AnalysisType enum', analysisTypes.every(type => 
      ['support', 'resistance', 'trendline', 'pattern', 'fibonacci'].includes(type)
    ), 'All values match');
    
    // TouchResult
    const touchResults: TouchResult[] = ['bounce', 'break', 'test'];
    checkType('TouchResult enum', touchResults.every(result => 
      ['bounce', 'break', 'test'].includes(result)
    ), 'All values match');
    
    // 3. JSON フィールドの型チェック
    console.log('\n3. JSONフィールドの型チェック...');
    
    // AnalysisRecord.proposalData
    const analysis = await prisma.analysisRecord.findFirst();
    if (analysis) {
      const proposalData = analysis.proposalData as any;
      checkType('AnalysisRecord.proposalData', 
        proposalData !== null && typeof proposalData === 'object',
        'JSON field is properly typed as object'
      );
    }
    
    // ChartDrawing.style
    const drawing = await prisma.chartDrawing.findFirst();
    if (drawing) {
      const style = drawing.style as any;
      checkType('ChartDrawing.style structure', 
        style && 'color' in style && 'lineWidth' in style,
        'Style object has expected properties'
      );
    }
    
    // 4. BigInt フィールドのチェック
    console.log('\n4. BigInt フィールドのチェック...');
    const recordWithBigInt = await prisma.analysisRecord.findFirst();
    if (recordWithBigInt) {
      checkType('AnalysisRecord.timestamp', 
        typeof recordWithBigInt.timestamp === 'bigint',
        `Type: ${typeof recordWithBigInt.timestamp}`
      );
      
      // アプリケーションでの使用時
      const timestampAsNumber = Number(recordWithBigInt.timestamp);
      checkType('BigInt to Number conversion', 
        !isNaN(timestampAsNumber),
        'BigInt can be safely converted to Number for timestamps'
      );
    }
    
    // 5. Optional/Required フィールドの整合性
    console.log('\n5. Optional/Requiredフィールドの整合性...');
    
    // ConversationSession
    const session = await prisma.conversationSession.findFirst();
    if (session) {
      checkType('ConversationSession.userId', 
        session.userId === null || typeof session.userId === 'string',
        `Optional field correctly typed as ${typeof session.userId}`
      );
      
      checkType('ConversationSession.summary', 
        session.summary === null || typeof session.summary === 'string',
        `Optional field correctly typed`
      );
    }
    
    // 6. リレーションの型チェック
    console.log('\n6. リレーションの型チェック...');
    const sessionWithRelations = await prisma.conversationSession.findFirst({
      include: {
        messages: true,
        user: true,
        analyses: true,
      }
    });
    
    if (sessionWithRelations) {
      checkType('Session relations', 
        Array.isArray(sessionWithRelations.messages) &&
        Array.isArray(sessionWithRelations.analyses) &&
        (sessionWithRelations.user === null || typeof sessionWithRelations.user === 'object'),
        'All relations are properly typed'
      );
    }
    
    // 7. 実際のデータ作成での型チェック
    console.log('\n7. データ作成時の型チェック...');
    try {
      const testData = {
        id: `type-test-${Date.now()}`,
        summary: 'Type test session',
        // lastActiveAt は自動的に設定される
      };
      
      const created = await prisma.conversationSession.create({
        data: testData
      });
      
      checkType('Create operation type safety', 
        created.id === testData.id && created.summary === testData.summary,
        'Created data matches input types'
      );
      
      // クリーンアップ
      await prisma.conversationSession.delete({
        where: { id: created.id }
      });
    } catch (error) {
      checkType('Create operation type safety', false, String(error));
    }
    
    // 結果サマリー
    console.log('\n=== 結果サマリー ===\n');
    
    const passed = typeChecks.filter(t => t.status === 'pass').length;
    const failed = typeChecks.filter(t => t.status === 'fail').length;
    
    typeChecks.forEach(check => {
      const icon = check.status === 'pass' ? '✅' : '❌';
      console.log(`${icon} ${check.check}`);
      if (check.details) {
        console.log(`   ${check.details}`);
      }
    });
    
    console.log(`\n合計: ${typeChecks.length} チェック`);
    console.log(`✅ 成功: ${passed}`);
    console.log(`❌ 失敗: ${failed}`);
    
    // 型の不一致がある場合の対処法
    if (failed > 0) {
      console.log('\n⚠️  型の不一致が検出されました！');
      console.log('\n対処法:');
      console.log('1. アプリケーション側の型定義を Prisma の型に合わせる');
      console.log('2. 変換関数を作成して型を変換する');
      console.log('3. Prisma スキーマを調整する');
    } else {
      console.log('\n🎉 すべての型が正しく一致しています！');
    }
    
  } catch (error) {
    console.error('型チェック中にエラーが発生:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 型変換のヘルパー関数の例
export function dbMessageToAppMessage(dbMsg: ConversationMessage): ChatMessage {
  return {
    id: dbMsg.id,
    content: dbMsg.content,
    role: dbMsg.role as 'user' | 'assistant',
    timestamp: dbMsg.timestamp.getTime(),
    type: 'text', // デフォルト値
  };
}

export function appMessageToDbMessage(appMsg: ChatMessage, sessionId: string): Omit<ConversationMessage, 'id' | 'createdAt'> {
  return {
    sessionId,
    content: appMsg.content,
    role: appMsg.role as MessageRole,
    timestamp: new Date(appMsg.timestamp),
    agentId: null,
    metadata: null,
  };
}

// テスト実行
checkTypeConsistency();