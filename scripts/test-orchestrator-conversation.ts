#!/usr/bin/env node
import 'dotenv/config';
import { config } from 'dotenv';
import { executeImprovedOrchestrator } from '../lib/mastra/agents/orchestrator.agent';
import { logger } from '../lib/utils/logger';

// .env.localを読み込む
config({ path: '.env.local' });

/**
 * Orchestratorの会話機能統合テスト
 */

async function testOrchestrator() {
  logger.info('=== Orchestrator Conversation Integration Test ===');
  
  const testCases = [
    {
      query: 'こんにちは！今日も元気ですか？',
      expectedIntent: 'greeting',
      description: '挨拶テスト',
    },
    {
      query: '最近の市場はどうですか？',
      expectedIntent: 'market_chat',
      description: '市場雑談テスト',
    },
    {
      query: 'ありがとう！助かりました',
      expectedIntent: 'small_talk',
      description: '雑談テスト',
    },
    {
      query: 'BTCの価格を教えて',
      expectedIntent: 'price_inquiry',
      description: '価格照会テスト（専門エージェント委譲）',
    },
    {
      query: 'ETHのトレンドラインを描いて',
      expectedIntent: 'ui_control',
      description: 'UI操作テスト（専門エージェント委譲）',
    },
  ];
  
  for (const testCase of testCases) {
    logger.info(`\n--- Testing: ${testCase.description} ---`);
    logger.info(`Query: "${testCase.query}"`);
    
    try {
      const result = await executeImprovedOrchestrator(
        testCase.query,
        `test-session-${Date.now()}`,
        {
          userLevel: 'intermediate',
          marketStatus: 'open',
        }
      );
      
      logger.info('Intent Analysis:', {
        intent: result.analysis.intent,
        confidence: result.analysis.confidence,
        expectedIntent: testCase.expectedIntent,
        isCorrect: result.analysis.intent === testCase.expectedIntent,
      });
      
      if (result.executionResult) {
        const response = result.executionResult.response || 
                        result.executionResult.executionResult?.response || 
                        result.executionResult.message || 
                        'No response';
                        
        logger.info('Response:', response);
        
        // メタデータをチェック
        if (result.executionResult.metadata) {
          logger.info('Metadata:', {
            processedBy: result.executionResult.metadata.processedBy,
            intent: result.executionResult.metadata.intent,
          });
        }
      }
      
      logger.info('Execution Time:', `${result.executionTime}ms`);
      
    } catch (error) {
      logger.error('Test failed:', error);
    }
  }
  
  logger.info('\n=== Test Complete ===');
}

// 実行
testOrchestrator().catch(error => {
  logger.error('Test script failed:', error);
  process.exit(1);
});