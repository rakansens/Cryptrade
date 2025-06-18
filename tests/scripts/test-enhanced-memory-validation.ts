#!/usr/bin/env tsx

/**
 * Enhanced Memory System Validator (AGENT-008)
 * 
 * Comprehensive validation of memory system features:
 * - Session management
 * - Message storage and retrieval  
 * - Context window management
 * - Memory processor application
 * - Cross-session search
 * - Token optimization
 * - Performance metrics
 */

import { useEnhancedConversationMemory, createEnhancedSession, addToolCallMessage } from '@/lib/store/enhanced-conversation-memory.store';
import { TokenLimiter, ToolCallFilter } from '@/lib/store/processors';
import type { ConversationMessage } from '@/types/conversation-memory';
import { logger } from '@/lib/utils/logger';
import { writeFileSync } from 'fs';
import { join } from 'path';

// Color utilities
const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  magenta: (text: string) => `\x1b[35m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};

interface TestResult {
  name: string;
  status: 'pass' | 'fail';
  duration: number;
  details?: any;
  error?: string;
}

interface ValidationReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  duration: number;
  tests: TestResult[];
  performance: {
    sessionCreation: number;
    messageAddition: number;
    messageRetrieval: number;
    contextGeneration: number;
    searchOperation: number;
  };
  memoryStats: {
    totalSessions: number;
    totalMessages: number;
    averageMessagesPerSession: number;
    tokenUsage: {
      total: number;
      optimized: number;
      savingsPercent: number;
    };
  };
}

class MemorySystemValidator {
  private results: TestResult[] = [];
  private startTime: number = 0;
  private performanceMetrics: any = {};

  async runAllTests(): Promise<ValidationReport> {
    console.log(colors.bold(colors.cyan('\n🧠 Enhanced Memory System Validation\n')));
    this.startTime = Date.now();

    // Clear any existing state
    useEnhancedConversationMemory.setState({ 
      sessions: {}, 
      currentSessionId: null,
      isDbEnabled: false // Disable DB for testing
    });

    // Run test suites
    await this.testSessionCreation();
    await this.testMessageStorage();
    await this.testContextWindowManagement();
    await this.testMemoryProcessors();
    await this.testCrossSessionSearch();
    await this.testTokenOptimization();
    await this.testContextPreservation();
    await this.testPerformance();

    const report = this.generateReport();
    this.saveReport(report);
    this.printSummary(report);

    return report;
  }

  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    console.log(colors.yellow(`\n📋 ${name}`));
    const start = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - start;
      this.results.push({
        name,
        status: 'pass',
        duration,
      });
      console.log(colors.green(`✅ Passed (${duration}ms)`));
    } catch (error) {
      const duration = Date.now() - start;
      this.results.push({
        name,
        status: 'fail',
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(colors.red(`❌ Failed: ${error}`));
    }
  }

  private async testSessionCreation() {
    await this.runTest('Session Creation', async () => {
      const start = Date.now();
      
      // Test 1: Create session with default processors
      const sessionId1 = await createEnhancedSession();
      const state = useEnhancedConversationMemory.getState();
      const session1 = state.sessions[sessionId1];
      
      if (!session1) throw new Error('Session not created');
      if (session1.processors.length !== 2) throw new Error('Default processors not applied');
      
      // Test 2: Create session with custom processors
      const customId = 'custom-session';
      const sessionId2 = await createEnhancedSession(customId, {
        maxTokens: 50000,
        excludeTools: ['marketDataTool'],
      });
      
      const updatedState = useEnhancedConversationMemory.getState();
      const session2 = updatedState.sessions[sessionId2];
      if (!session2) throw new Error('Custom session not created');
      // When DB is disabled, the custom ID should be preserved
      if (sessionId2 !== customId) throw new Error('Custom session ID not preserved');
      
      this.performanceMetrics.sessionCreation = Date.now() - start;
      console.log(colors.gray(`  - Created ${Object.keys(updatedState.sessions).length} sessions`));
    });
  }

  private async testMessageStorage() {
    await this.runTest('Message Storage & Retrieval', async () => {
      const start = Date.now();
      const sessionId = await createEnhancedSession();
      const store = useEnhancedConversationMemory.getState();
      
      // Add various message types
      await store.addMessage({
        sessionId,
        role: 'user',
        content: 'What is the price of Bitcoin?',
        metadata: {
          intent: 'price_query',
          symbols: ['BTC'],
        },
      });
      
      await store.addMessage({
        sessionId,
        role: 'assistant',
        content: 'Bitcoin is currently trading at $45,000...',
        metadata: {
          topics: ['cryptocurrency', 'bitcoin', 'price'],
        },
      });
      
      await addToolCallMessage(sessionId, 'marketDataTool', 'Fetching BTC price...', {
        symbol: 'BTC',
        price: 45000,
      });
      
      // Verify storage - need to get fresh state after async operations
      const updatedState = useEnhancedConversationMemory.getState();
      const session = updatedState.sessions[sessionId];
      if (!session) throw new Error('Session not found');
      if (session.messages.length < 3) throw new Error(`Only ${session.messages.length} messages stored, expected at least 3`);
      
      // Verify metadata
      const toolMessage = session.messages.find(m => m.metadata?.isToolCall);
      if (!toolMessage) throw new Error('Tool call message not found');
      if (toolMessage.metadata?.toolName !== 'marketDataTool') {
        throw new Error('Tool metadata not preserved');
      }
      
      this.performanceMetrics.messageAddition = Date.now() - start;
      console.log(colors.gray(`  - Stored ${session.messages.length} messages with metadata`));
    });
  }

  private async testContextWindowManagement() {
    await this.runTest('Context Window Management', async () => {
      const sessionId = await createEnhancedSession();
      const store = useEnhancedConversationMemory.getState();
      
      // Add many messages to test window limits
      for (let i = 0; i < 60; i++) {
        await store.addMessage({
          sessionId,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'x'.repeat(100)}`, // ~25 tokens each
        });
      }
      
      // Get fresh state after all messages added
      const currentState = useEnhancedConversationMemory.getState();
      const session = currentState.sessions[sessionId];
      if (!session) throw new Error('Session not found');
      
      // Check memory limit enforcement (MAX_MESSAGES_IN_MEMORY = 50)
      if (session.messages.length > 50) {
        throw new Error(`Too many messages in memory: ${session.messages.length}`);
      }
      
      // Verify newest messages are kept
      const lastMessage = session.messages[session.messages.length - 1];
      // When we add 60 messages and only keep 50, the first 10 are dropped
      // So the last message should be "Message 59" (0-indexed)
      const expectedLastMessageContent = 'Message 59';
      if (!lastMessage || !lastMessage.content.includes(expectedLastMessageContent)) {
        throw new Error(`Context window not maintaining recent messages. Expected: ${expectedLastMessageContent}, Got: ${lastMessage?.content}`);
      }
      
      console.log(colors.gray(`  - Context window limited to ${session.messages.length} messages`));
    });
  }

  private async testMemoryProcessors() {
    await this.runTest('Memory Processor Application', async () => {
      const start = Date.now();
      
      // Create session with token limiter
      const sessionId = await createEnhancedSession('processor-test', {
        maxTokens: 1000, // Very low limit for testing
      });
      
      const store = useEnhancedConversationMemory.getState();
      
      // Add messages that exceed token limit
      for (let i = 0; i < 20; i++) {
        await store.addMessage({
          sessionId,
          role: 'user',
          content: `Long message ${i}: ${'x'.repeat(200)}`, // ~50 tokens each
        });
      }
      
      // Get processed messages
      const processed = store.getProcessedMessages(sessionId);
      const session = store.sessions[sessionId];
      
      if (!session) throw new Error('Session not found');
      
      // Token limiter should reduce the number of messages when token limit is exceeded
      const totalTokens = session.messages.reduce((sum, msg) => {
        return sum + (msg.metadata?.tokenCount || Math.ceil(msg.content.length * 0.25));
      }, 0);
      
      if (totalTokens > 1000 && processed.length >= session.messages.length) {
        throw new Error('Token limiter not filtering messages');
      }
      
      // Test tool call filter
      await addToolCallMessage(sessionId, 'excludedTool', 'Tool call', {});
      
      const sessionWithFilter = await createEnhancedSession('filter-test', {
        excludeTools: ['excludedTool'],
      });
      
      await addToolCallMessage(sessionWithFilter, 'excludedTool', 'Should be filtered', {});
      await addToolCallMessage(sessionWithFilter, 'allowedTool', 'Should be included', {});
      
      const filteredMessages = store.getProcessedMessages(sessionWithFilter);
      const hasExcluded = filteredMessages.some(m => 
        m.metadata?.toolName === 'excludedTool'
      );
      
      if (hasExcluded) {
        throw new Error('Tool call filter not working');
      }
      
      this.performanceMetrics.processorApplication = Date.now() - start;
      console.log(colors.gray(`  - Processors reduced ${session.messages.length} to ${processed.length} messages`));
    });
  }

  private async testCrossSessionSearch() {
    await this.runTest('Cross-Session Memory Search', async () => {
      const start = Date.now();
      const store = useEnhancedConversationMemory.getState();
      
      // Create multiple sessions with different topics
      const cryptoSession = await createEnhancedSession('crypto-session');
      await store.addMessage({
        sessionId: cryptoSession,
        role: 'user',
        content: 'Tell me about Bitcoin and Ethereum',
        metadata: { symbols: ['BTC', 'ETH'] },
      });
      
      const stockSession = await createEnhancedSession('stock-session');
      await store.addMessage({
        sessionId: stockSession,
        role: 'user',
        content: 'What about Apple and Tesla stocks?',
        metadata: { symbols: ['AAPL', 'TSLA'] },
      });
      
      // Test search across sessions
      const btcResults = store.searchMessages('Bitcoin');
      if (btcResults.length === 0) throw new Error('Search failed to find Bitcoin message');
      
      const symbolResults = store.searchMessages('AAPL');
      if (symbolResults.length === 0) throw new Error('Search failed to find symbol in metadata');
      
      // Test session-specific search
      const cryptoOnly = store.searchMessages('Bitcoin', cryptoSession);
      if (cryptoOnly.length !== 1) throw new Error('Session-specific search not working');
      
      this.performanceMetrics.searchOperation = Date.now() - start;
      console.log(colors.gray(`  - Found ${btcResults.length + symbolResults.length} messages across sessions`));
    });
  }

  private async testTokenOptimization() {
    await this.runTest('Token Optimization', async () => {
      const sessionId = await createEnhancedSession('token-test', {
        maxTokens: 10000,
      });
      
      const store = useEnhancedConversationMemory.getState();
      
      // Add messages with known token counts
      const messages = [
        { content: 'Short message', expectedTokens: 3 },
        { content: 'This is a medium length message with more tokens', expectedTokens: 10 },
        { content: 'x'.repeat(400), expectedTokens: 100 }, // Long message
      ];
      
      for (const msg of messages) {
        await store.addMessage({
          sessionId,
          role: 'user',
          content: msg.content,
        });
      }
      
      const stats = store.getMemoryStats(sessionId);
      const session = store.sessions[sessionId];
      
      if (!session) throw new Error('Session not found');
      
      // Verify token counting
      if (stats.estimatedTokens === 0) {
        throw new Error('Token counting not working');
      }
      
      // Check token usage tracking
      const tokenUsage = session.tokenUsage;
      if (!tokenUsage || tokenUsage.total === 0) {
        throw new Error('Token usage not being tracked');
      }
      
      console.log(colors.gray(`  - Optimized ${stats.totalMessages} messages to ~${stats.estimatedTokens} tokens`));
    });
  }

  private async testContextPreservation() {
    await this.runTest('Context Preservation', async () => {
      const start = Date.now();
      const sessionId = await createEnhancedSession();
      const store = useEnhancedConversationMemory.getState();
      
      // Build conversation context
      const conversation = [
        { role: 'user' as const, content: 'What is Bitcoin?' },
        { role: 'assistant' as const, content: 'Bitcoin is a cryptocurrency...' },
        { role: 'user' as const, content: 'How much is it worth?' },
        { role: 'assistant' as const, content: 'Currently around $45,000' },
      ];
      
      for (const msg of conversation) {
        await store.addMessage({ sessionId, ...msg });
      }
      
      // Test context generation
      const context = store.getSessionContext(sessionId);
      
      if (!context.includes('User:') || !context.includes('Assistant:')) {
        throw new Error('Context format incorrect');
      }
      
      // Test context with summary
      await store.summarizeSession(sessionId);
      const contextWithSummary = store.getSessionContext(sessionId);
      
      if (!contextWithSummary.includes('Session Summary:')) {
        throw new Error('Summary not included in context');
      }
      
      this.performanceMetrics.contextGeneration = Date.now() - start;
      console.log(colors.gray(`  - Generated context with ${conversation.length} messages`));
    });
  }

  private async testPerformance() {
    await this.runTest('Performance Benchmarks', async () => {
      const iterations = 100;
      const timings = {
        sessionCreation: [],
        messageAddition: [],
        messageRetrieval: [],
      };
      
      // Benchmark session creation
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await createEnhancedSession();
        timings.sessionCreation.push(Date.now() - start);
      }
      
      // Benchmark message operations
      const testSession = await createEnhancedSession();
      const store = useEnhancedConversationMemory.getState();
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await store.addMessage({
          sessionId: testSession,
          role: 'user',
          content: `Test message ${i}`,
        });
        timings.messageAddition.push(Date.now() - start);
      }
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        store.getProcessedMessages(testSession, 10);
        timings.messageRetrieval.push(Date.now() - start);
      }
      
      // Calculate averages
      const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
      
      console.log(colors.gray(`  - Session creation: ${avg(timings.sessionCreation).toFixed(2)}ms avg`));
      console.log(colors.gray(`  - Message addition: ${avg(timings.messageAddition).toFixed(2)}ms avg`));
      console.log(colors.gray(`  - Message retrieval: ${avg(timings.messageRetrieval).toFixed(2)}ms avg`));
    });
  }

  private generateReport(): ValidationReport {
    const duration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    
    // Calculate memory statistics
    const state = useEnhancedConversationMemory.getState();
    const sessions = Object.values(state.sessions);
    const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);
    const totalProcessedMessages = sessions.reduce((sum, s) => {
      const processed = state.getProcessedMessages(s.id);
      return sum + processed.length;
    }, 0);
    
    const totalTokens = sessions.reduce((sum, s) => 
      sum + (s.tokenUsage?.total || 0), 0
    );
    
    return {
      timestamp: new Date().toISOString(),
      totalTests: this.results.length,
      passed,
      failed,
      duration,
      tests: this.results,
      performance: {
        sessionCreation: this.performanceMetrics.sessionCreation || 0,
        messageAddition: this.performanceMetrics.messageAddition || 0,
        messageRetrieval: this.performanceMetrics.messageRetrieval || 0,
        contextGeneration: this.performanceMetrics.contextGeneration || 0,
        searchOperation: this.performanceMetrics.searchOperation || 0,
      },
      memoryStats: {
        totalSessions: sessions.length,
        totalMessages,
        averageMessagesPerSession: sessions.length > 0 
          ? Math.round(totalMessages / sessions.length) 
          : 0,
        tokenUsage: {
          total: totalTokens,
          optimized: totalProcessedMessages,
          savingsPercent: totalMessages > 0
            ? Math.round((1 - totalProcessedMessages / totalMessages) * 100)
            : 0,
        },
      },
    };
  }

  private saveReport(report: ValidationReport) {
    const outputPath = join(process.cwd(), 'memory_test_results.json');
    writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(colors.gray(`\n📄 Report saved to: ${outputPath}`));
  }

  private printSummary(report: ValidationReport) {
    console.log(colors.bold(colors.cyan('\n📊 Validation Summary\n')));
    
    const status = report.failed === 0 ? colors.green('PASSED') : colors.red('FAILED');
    console.log(`Status: ${status}`);
    console.log(`Tests: ${report.passed}/${report.totalTests} passed`);
    console.log(`Duration: ${report.duration}ms`);
    
    console.log(colors.cyan('\n⚡ Performance Metrics:'));
    console.log(`- Session Creation: ${report.performance.sessionCreation}ms`);
    console.log(`- Message Addition: ${report.performance.messageAddition}ms`);
    console.log(`- Context Generation: ${report.performance.contextGeneration}ms`);
    
    console.log(colors.cyan('\n💾 Memory Statistics:'));
    console.log(`- Total Sessions: ${report.memoryStats.totalSessions}`);
    console.log(`- Total Messages: ${report.memoryStats.totalMessages}`);
    console.log(`- Token Optimization: ${report.memoryStats.tokenUsage.savingsPercent}% saved`);
    
    // Generate Japanese summary
    const summary = this.generateJapaneseSummary(report);
    console.log(colors.bold(colors.magenta('\n🇯🇵 日本語サマリー:')));
    console.log(summary);
  }

  private generateJapaneseSummary(report: ValidationReport): string {
    const status = report.failed === 0 ? '成功' : '失敗';
    const optimizationRate = report.memoryStats.tokenUsage.savingsPercent;
    
    return `メモリシステム検証${status}。${report.totalTests}件中${report.passed}件合格。` +
           `セッション${report.memoryStats.totalSessions}件、メッセージ${report.memoryStats.totalMessages}件処理。` +
           `トークン最適化率${optimizationRate}%達成。`;
  }
}

// Main execution
async function main() {
  try {
    const validator = new MemorySystemValidator();
    await validator.runAllTests();
    process.exit(0);
  } catch (error) {
    console.error(colors.red('\n❌ Validation failed:'), error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}