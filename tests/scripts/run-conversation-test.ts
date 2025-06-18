#!/usr/bin/env node
import 'dotenv/config';
import { config } from 'dotenv';
import { runConversationFlowTest } from '../validation/conversation_flow_test';
import { logger } from '@/lib/utils/logger';

// Load environment variables
config({ path: '.env.local' });

/**
 * Conversation Flow Test Runner
 * 
 * AGENT-015の会話フロー検証を実行
 */

async function main() {
  logger.info('=== Conversation Flow Test Runner ===');
  logger.info('Starting conversation validation tests...');
  
  try {
    await runConversationFlowTest();
    logger.info('Conversation flow tests completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Conversation flow tests failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Run the test
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});