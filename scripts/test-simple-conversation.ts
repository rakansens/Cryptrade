#!/usr/bin/env node
import 'dotenv/config';
import { config } from 'dotenv';
import { executeImprovedOrchestrator } from '../lib/mastra/agents/orchestrator.agent';
import { logger } from '../lib/utils/logger';

// .env.localを読み込む
config({ path: '.env.local' });

/**
 * シンプルな会話処理テスト
 * 問題を切り分けるため最小限のテスト
 */

async function testSimpleConversation() {
  logger.info('=== Simple Conversation Test ===');
  
  // 最もシンプルな挨拶だけテスト
  const query = 'こんにちは！';
  
  try {
    logger.info(`Testing: "${query}"`);
    
    const result = await executeImprovedOrchestrator(
      query,
      'test-simple-' + Date.now(),
      { userLevel: 'intermediate', marketStatus: 'open' }
    );
    
    logger.info('Analysis:', {
      intent: result.analysis.intent,
      confidence: result.analysis.confidence,
    });
    
    if (result.executionResult) {
      logger.info('Execution Result:', {
        hasResponse: !!result.executionResult.response,
        hasMetadata: !!result.executionResult.metadata,
        metadata: result.executionResult.metadata,
      });
      
      if (result.executionResult.response) {
        logger.info('Response:', result.executionResult.response);
      }
    } else {
      logger.error('No execution result');
    }
    
    // エラーの詳細を確認
    if (result.agentError) {
      logger.error('Agent Error:', result.agentError);
    }
    
  } catch (error) {
    logger.error('Test failed:', error);
  }
}

// 実行
testSimpleConversation().catch(error => {
  logger.error('Script failed:', error);
  process.exit(1);
});