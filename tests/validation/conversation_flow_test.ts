import { executeImprovedOrchestrator } from '@/lib/mastra/agents/orchestrator.agent';
import { useEnhancedConversationMemory } from '@/lib/store/enhanced-conversation-memory.store';
import { ConversationContextProcessor } from '@/lib/store/conversation-context-processor';
import { logger } from '@/lib/utils/logger';

/**
 * Conversation Flow Tester (AGENT-015)
 * 
 * 自然な会話処理の検証
 */

interface ConversationTestCase {
  id: string;
  category: 'greeting' | 'small_talk' | 'market_chat' | 'help' | 'mixed' | 'emotional' | 'multi_turn';
  messages: Array<{
    content: string;
    expectedIntent?: string;
    expectedMood?: string;
    checkResponseQuality?: boolean;
  }>;
  description: string;
}

interface ConversationTestResult {
  testId: string;
  category: string;
  success: boolean;
  turns: Array<{
    input: string;
    response: string;
    intent: string;
    confidence: number;
    mood?: string;
    responseTime: number;
    quality: {
      natural: boolean;
      contextAware: boolean;
      appropriate: boolean;
    };
  }>;
  contextMaintenance: {
    topicsContinuity: boolean;
    moodTracking: boolean;
    relationshipProgression: boolean;
  };
  overallScore: number;
  issues: string[];
}

export class ConversationFlowTester {
  private processor = new ConversationContextProcessor();
  private testCases: ConversationTestCase[] = [
    // 挨拶と軽い会話
    {
      id: 'greeting-001',
      category: 'greeting',
      description: '基本的な挨拶の処理',
      messages: [
        { content: 'こんにちは！', expectedIntent: 'general_conversation' },
        { content: '今日はいい天気ですね', expectedIntent: 'general_conversation' },
        { content: '最近どう？', expectedIntent: 'general_conversation' },
      ],
    },
    
    // 市場雑談
    {
      id: 'market-chat-001',
      category: 'market_chat',
      description: '市場に関する軽い雑談',
      messages: [
        { content: '最近の仮想通貨市場はどんな感じ？', expectedIntent: 'general_conversation' },
        { content: 'ビットコインすごいね！', expectedIntent: 'general_conversation', expectedMood: 'excited' },
        { content: 'イーサリアムも気になるな', expectedIntent: 'general_conversation' },
      ],
    },
    
    // ヘルプリクエスト
    {
      id: 'help-001',
      category: 'help',
      description: 'ヘルプや説明の要求',
      messages: [
        { content: 'このアプリの使い方を教えて', expectedIntent: 'general_conversation' },
        { content: '価格を見るにはどうすればいい？', expectedIntent: 'general_conversation' },
        { content: 'チャートの見方がわからない', expectedIntent: 'general_conversation' },
      ],
    },
    
    // 技術的な質問と雑談の混合
    {
      id: 'mixed-001',
      category: 'mixed',
      description: '技術的な質問と雑談の混在',
      messages: [
        { content: 'BTCの価格を教えて', expectedIntent: 'price_inquiry' },
        { content: 'ありがとう！すごい高いね', expectedIntent: 'general_conversation', expectedMood: 'excited' },
        { content: 'ETHの分析もお願い', expectedIntent: 'trading_analysis' },
        { content: 'なるほど〜勉強になります', expectedIntent: 'general_conversation', expectedMood: 'positive' },
      ],
    },
    
    // 感情的な反応
    {
      id: 'emotional-001',
      category: 'emotional',
      description: '様々な感情を含む会話',
      messages: [
        { content: '今日は調子悪いな...', expectedMood: 'concerned' },
        { content: '仮想通貨の損失が心配', expectedMood: 'concerned' },
        { content: 'でも長期的には期待してる！', expectedMood: 'positive' },
        { content: 'やった！プラスになった！！', expectedMood: 'excited' },
      ],
    },
    
    // マルチターン会話
    {
      id: 'multi-turn-001',
      category: 'multi_turn',
      description: '文脈を保持した長い会話',
      messages: [
        { content: 'ビットコインについて教えて', expectedIntent: 'general_conversation' },
        { content: 'それの価格は？', expectedIntent: 'price_inquiry' },
        { content: 'じゃあイーサリアムは？', expectedIntent: 'price_inquiry' },
        { content: 'どっちがおすすめ？', expectedIntent: 'general_conversation' },
        { content: 'なるほど、詳しく分析して', expectedIntent: 'trading_analysis' },
        { content: 'ありがとう！助かった', expectedIntent: 'general_conversation', expectedMood: 'positive' },
      ],
    },
  ];
  
  async runAllTests(): Promise<ConversationTestResult[]> {
    const results: ConversationTestResult[] = [];
    
    for (const testCase of this.testCases) {
      logger.info(`[ConversationFlowTester] Running test: ${testCase.id}`);
      const result = await this.runTestCase(testCase);
      results.push(result);
      
      // テスト間の待機
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }
  
  private async runTestCase(testCase: ConversationTestCase): Promise<ConversationTestResult> {
    const sessionId = `test-${testCase.id}-${Date.now()}`;
    const memoryStore = useEnhancedConversationMemory.getState();
    
    // セッション作成
    await memoryStore.createSession(sessionId);
    
    const result: ConversationTestResult = {
      testId: testCase.id,
      category: testCase.category,
      success: true,
      turns: [],
      contextMaintenance: {
        topicsContinuity: true,
        moodTracking: true,
        relationshipProgression: true,
      },
      overallScore: 0,
      issues: [],
    };
    
    let previousTopics: string[] = [];
    let previousMood: string | undefined;
    
    // 各メッセージを処理
    for (let i = 0; i < testCase.messages.length; i++) {
      const message = testCase.messages[i];
      const startTime = Date.now();
      
      try {
        // メッセージを送信
        const response = await executeImprovedOrchestrator(
          message.content,
          sessionId,
          {
            userLevel: 'intermediate',
            marketStatus: 'open',
          }
        );
        
        const responseTime = Date.now() - startTime;
        
        // 会話コンテキストを取得
        const messages = memoryStore.getProcessedMessages(sessionId);
        const context = this.processor.extractContext(messages);
        
        // 応答品質を評価
        const quality = this.evaluateResponseQuality(
          message.content,
          response.executionResult?.response || '',
          context,
          i > 0
        );
        
        // ターン結果を記録
        const turn = {
          input: message.content,
          response: response.executionResult?.response || 'No response',
          intent: response.analysis.intent,
          confidence: response.analysis.confidence,
          mood: context.userMood,
          responseTime,
          quality,
        };
        
        result.turns.push(turn);
        
        // 期待値との比較
        if (message.expectedIntent && response.analysis.intent !== message.expectedIntent) {
          result.issues.push(`Turn ${i + 1}: Expected intent ${message.expectedIntent}, got ${response.analysis.intent}`);
          result.success = false;
        }
        
        if (message.expectedMood && context.userMood !== message.expectedMood) {
          result.issues.push(`Turn ${i + 1}: Expected mood ${message.expectedMood}, got ${context.userMood}`);
        }
        
        // コンテキスト維持の評価
        if (i > 0) {
          // トピックの継続性
          const topicOverlap = context.recentTopics.some(t => previousTopics.includes(t));
          if (!topicOverlap && testCase.category === 'multi_turn') {
            result.contextMaintenance.topicsContinuity = false;
          }
          
          // 感情追跡
          if (testCase.category === 'emotional' && previousMood === context.userMood) {
            // 感情が変化すべき場面で変化していない
            if (i > 1) {
              result.contextMaintenance.moodTracking = false;
            }
          }
        }
        
        previousTopics = context.recentTopics;
        previousMood = context.userMood;
        
      } catch (error) {
        logger.error(`[ConversationFlowTester] Error in turn ${i + 1}`, { error });
        result.issues.push(`Turn ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.success = false;
      }
    }
    
    // 全体スコアを計算
    result.overallScore = this.calculateOverallScore(result);
    
    // セッションをクリア
    memoryStore.clearSession(sessionId);
    
    return result;
  }
  
  private evaluateResponseQuality(
    input: string,
    response: string,
    context: any,
    isFollowUp: boolean
  ): { natural: boolean; contextAware: boolean; appropriate: boolean } {
    const quality = {
      natural: true,
      contextAware: true,
      appropriate: true,
    };
    
    // 自然さの評価
    if (response.length < 10 || response.includes('エラー') || response.includes('undefined')) {
      quality.natural = false;
    }
    
    // 定型文チェック
    const genericResponses = [
      'お手伝いできることはありますか',
      'ご質問ありがとうございます',
      '申し訳ございません',
    ];
    
    if (genericResponses.some(generic => response.includes(generic))) {
      quality.natural = false;
    }
    
    // コンテキスト認識の評価
    if (isFollowUp) {
      // フォローアップ質問で前の文脈を無視している
      if (input.includes('それ') || input.includes('じゃあ') || input.includes('どっち')) {
        if (!response.includes('先ほど') && !response.includes('前述') && 
            !response.includes('について') && !response.includes('に関して')) {
          quality.contextAware = false;
        }
      }
    }
    
    // 適切性の評価
    if (context.userMood === 'concerned' && response.includes('！！')) {
      quality.appropriate = false; // 心配している人に過度に興奮した返答
    }
    
    if (context.userMood === 'excited' && response.length < 20) {
      quality.appropriate = false; // 興奮している人に短すぎる返答
    }
    
    return quality;
  }
  
  private calculateOverallScore(result: ConversationTestResult): number {
    let score = 0;
    let totalChecks = 0;
    
    // 各ターンの品質スコア
    result.turns.forEach(turn => {
      if (turn.quality.natural) score += 1;
      if (turn.quality.contextAware) score += 1;
      if (turn.quality.appropriate) score += 1;
      totalChecks += 3;
    });
    
    // コンテキスト維持スコア
    if (result.contextMaintenance.topicsContinuity) score += 2;
    if (result.contextMaintenance.moodTracking) score += 2;
    if (result.contextMaintenance.relationshipProgression) score += 2;
    totalChecks += 6;
    
    // 基本的な成功
    if (result.success) score += 3;
    totalChecks += 3;
    
    return Math.round((score / totalChecks) * 100);
  }
  
  async generateReport(results: ConversationTestResult[]): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      totalTests: results.length,
      successRate: (results.filter(r => r.success).length / results.length) * 100,
      categoryBreakdown: {} as Record<string, { count: number; avgScore: number; issues: string[] }>,
      overallMetrics: {
        avgResponseTime: 0,
        naturalResponseRate: 0,
        contextAwarenessRate: 0,
        appropriatenessRate: 0,
      },
      detailedResults: results,
    };
    
    // カテゴリ別の分析
    const categories = ['greeting', 'small_talk', 'market_chat', 'help', 'mixed', 'emotional', 'multi_turn'];
    categories.forEach(category => {
      const categoryResults = results.filter(r => r.category === category);
      if (categoryResults.length > 0) {
        report.categoryBreakdown[category] = {
          count: categoryResults.length,
          avgScore: categoryResults.reduce((sum, r) => sum + r.overallScore, 0) / categoryResults.length,
          issues: categoryResults.flatMap(r => r.issues),
        };
      }
    });
    
    // 全体メトリクスの計算
    let totalTurns = 0;
    let totalResponseTime = 0;
    let naturalCount = 0;
    let contextAwareCount = 0;
    let appropriateCount = 0;
    
    results.forEach(result => {
      result.turns.forEach(turn => {
        totalTurns++;
        totalResponseTime += turn.responseTime;
        if (turn.quality.natural) naturalCount++;
        if (turn.quality.contextAware) contextAwareCount++;
        if (turn.quality.appropriate) appropriateCount++;
      });
    });
    
    if (totalTurns > 0) {
      report.overallMetrics.avgResponseTime = totalResponseTime / totalTurns;
      report.overallMetrics.naturalResponseRate = (naturalCount / totalTurns) * 100;
      report.overallMetrics.contextAwarenessRate = (contextAwareCount / totalTurns) * 100;
      report.overallMetrics.appropriatenessRate = (appropriateCount / totalTurns) * 100;
    }
    
    // レポートを保存
    const fs = await import('fs/promises');
    await fs.writeFile(
      '/Users/hirosato/Downloads/Cryptrade/conversation_test_results.json',
      JSON.stringify(report, null, 2)
    );
    
    // サマリーをログ出力
    logger.info('[ConversationFlowTester] Test Summary', {
      totalTests: report.totalTests,
      successRate: `${report.successRate.toFixed(1)}%`,
      avgResponseTime: `${report.overallMetrics.avgResponseTime.toFixed(0)}ms`,
      naturalResponseRate: `${report.overallMetrics.naturalResponseRate.toFixed(1)}%`,
      contextAwarenessRate: `${report.overallMetrics.contextAwarenessRate.toFixed(1)}%`,
      appropriatenessRate: `${report.overallMetrics.appropriatenessRate.toFixed(1)}%`,
    });
    
    // 日本語サマリーの生成
    const summary = this.generateJapaneseSummary(report);
    logger.info('[ConversationFlowTester] Japanese Summary', { summary });
  }
  
  private generateJapaneseSummary(report: any): string {
    const naturalRate = report.overallMetrics.naturalResponseRate;
    const contextRate = report.overallMetrics.contextAwarenessRate;
    const avgTime = report.overallMetrics.avgResponseTime;
    
    let quality = '要改善';
    if (naturalRate > 80 && contextRate > 80) {
      quality = '良好';
    } else if (naturalRate > 60 && contextRate > 60) {
      quality = '改善余地あり';
    }
    
    return `会話フロー検証完了。自然さ${naturalRate.toFixed(0)}%、文脈認識${contextRate.toFixed(0)}%、応答速度${avgTime.toFixed(0)}ms。品質評価：${quality}`;
  }
}

// テスト実行
export async function runConversationFlowTest() {
  const tester = new ConversationFlowTester();
  
  try {
    logger.info('[ConversationFlowTester] Starting conversation flow tests...');
    const results = await tester.runAllTests();
    await tester.generateReport(results);
    logger.info('[ConversationFlowTester] All tests completed');
  } catch (error) {
    logger.error('[ConversationFlowTester] Test execution failed', { error });
    throw error;
  }
}

// CLIから直接実行する場合
if (require.main === module) {
  runConversationFlowTest().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}