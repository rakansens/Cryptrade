#!/usr/bin/env node
import 'dotenv/config';
import { config } from 'dotenv';
import { executeImprovedOrchestrator } from '../lib/mastra/agents/orchestrator.agent';
import { logger } from '../lib/utils/logger';

// .env.localを読み込む
config({ path: '.env.local' });

/**
 * Orchestratorの完全な会話統合テスト
 * ConversationalAgentを削除する前の最終確認
 */

async function testOrchestratorComplete() {
  logger.info('=== Orchestrator Complete Integration Test ===');
  
  // 同じセッションIDで会話を続ける
  const sessionId = `test-session-${Date.now()}`;
  
  const conversationFlow = [
    {
      query: 'こんにちは！',
      description: '初回挨拶',
    },
    {
      query: '最近の暗号通貨市場はどんな感じ？',
      description: '市場について気軽に聞く',
    },
    {
      query: 'BTCはどう思う？投資すべき？',
      description: '分析と会話の混合',
    },
    {
      query: 'ありがとう！とても参考になったよ',
      description: '感謝の表現',
    },
    {
      query: 'じゃあBTCの価格を確認して',
      description: '価格照会（専門エージェント）',
    },
  ];
  
  for (let i = 0; i < conversationFlow.length; i++) {
    const { query, description } = conversationFlow[i];
    logger.info(`\n--- Step ${i + 1}: ${description} ---`);
    logger.info(`Query: "${query}"`);
    
    try {
      const result = await executeImprovedOrchestrator(
        query,
        sessionId, // 同じセッションを使用
        {
          userLevel: 'intermediate',
          marketStatus: 'open',
        }
      );
      
      logger.info('Intent:', result.analysis.intent);
      logger.info('Confidence:', result.analysis.confidence);
      
      if (result.executionResult) {
        const response = result.executionResult.response || 
                        result.executionResult.executionResult?.response || 
                        result.executionResult.message || 
                        'No response';
                        
        logger.info('Response:', response);
        
        // どこで処理されたかチェック
        if (result.executionResult.metadata?.processedBy) {
          logger.info('Processed by:', result.executionResult.metadata.processedBy);
        }
      }
      
      // メモリコンテキストの長さをチェック
      if (result.memoryContext) {
        logger.info('Memory context length:', result.memoryContext.length);
      }
      
    } catch (error) {
      logger.error('Test failed:', error);
    }
    
    // 各ステップ間に少し待機
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  logger.info('\n=== Conversation Flow Complete ===');
  
  // ConversationalAgentなしでの会話機能の確認
  logger.info('\n=== Checking Conversation Capabilities Without ConversationalAgent ===');
  
  const conversationalQueries = [
    'おはよう！今日も頑張ろう',
    'なんだか市場が落ち着いてるね',
    'ビットコインって面白いよね',
    '疲れたなあ...',
    'Cryptradeってどんなサービス？',
  ];
  
  for (const query of conversationalQueries) {
    logger.info(`\nTesting: "${query}"`);
    
    try {
      const result = await executeImprovedOrchestrator(
        query,
        `standalone-${Date.now()}`,
        {
          userLevel: 'intermediate',
          marketStatus: 'open',
        }
      );
      
      const isConversational = ['market_chat', 'small_talk', 'greeting', 'help_request', 'conversational'].includes(result.analysis.intent);
      
      logger.info('Intent:', result.analysis.intent);
      logger.info('Is handled directly by Orchestrator?', isConversational);
      
      if (result.executionResult?.metadata?.processedBy === 'orchestrator-direct') {
        logger.info('✅ Successfully handled by Orchestrator directly');
      } else {
        logger.info('❌ Delegated to:', result.executionResult?.metadata?.processedBy || 'unknown');
      }
      
    } catch (error) {
      logger.error('Query failed:', error);
    }
  }
  
  logger.info('\n=== Test Complete ===');
}

// 実行
testOrchestratorComplete().catch(error => {
  logger.error('Test script failed:', error);
  process.exit(1);
});