import { Agent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { generateCorrelationId } from '@/types/agent-payload';
import { traceManager } from '@/lib/monitoring/trace';
import { logger } from '@/lib/utils/logger';
import { agentSelectionTool } from '../tools/agent-selection.tool';
import { memoryRecallTool } from '../tools/memory-recall.tool';
import { marketSnapshotTool, trendingTopicsTool } from '../tools/market-snapshot.tool';
import { marketDataResilientTool } from '../tools/market-data-resilient.tool';
import { useEnhancedConversationMemory, createEnhancedSession } from '@/lib/store/enhanced-conversation-memory.store';
import { registerAllAgents } from '../network/agent-registry';

/**
 * Orchestrator Agent - Unified Implementation
 * 
 * ベストプラクティスに完全準拠した簡潔なオーケストレーター
 * - 最小限の責務: 意図分析とエージェント選択のみ
 * - 明確なツール使用パターン
 * - 実行ロジックを他のコンポーネントに委任
 * - 高いテスタビリティと保守性
 */

// 意図分析結果の型定義
export interface IntentAnalysisResult {
  intent: 'price_inquiry' | 'ui_control' | 'trading_analysis' | 'conversational' | 'proposal_request' | 'market_chat' | 'small_talk' | 'greeting' | 'help_request';
  confidence: number;
  extractedSymbol?: string;
  reasoning: string;
  analysisDepth: 'basic' | 'detailed' | 'comprehensive';
  isProposalMode?: boolean;
  proposalType?: 'trendline' | 'support-resistance' | 'pattern' | 'all';
  conversationMode?: 'formal' | 'casual' | 'friendly';
  emotionalTone?: 'positive' | 'neutral' | 'concerned' | 'excited';
}

// 簡潔なスキーマ定義
const IntentAnalysisOutput = z.object({
  intent: z.enum(['price_inquiry', 'ui_control', 'trading_analysis', 'conversational', 'proposal_request', 'market_chat', 'small_talk', 'greeting', 'help_request']),
  confidence: z.number().min(0).max(1),
  extractedSymbol: z.string().optional(),
  reasoning: z.string(),
  analysisDepth: z.enum(['basic', 'detailed', 'comprehensive']),
  selectedAgent: z.string(),
  executionResult: z.unknown().optional(),
  isProposalMode: z.boolean().optional(),
  proposalType: z.enum(['trendline', 'support-resistance', 'pattern', 'all']).optional(),
  conversationMode: z.enum(['formal', 'casual', 'friendly']).optional(),
  emotionalTone: z.enum(['positive', 'neutral', 'concerned', 'excited']).optional(),
});

export const orchestratorAgent = new Agent({
  name: 'cryptrade-orchestrator-v2',
  // 動的モデル選択: コンテキストに応じてモデルを切り替え
  model: (context) => {
    // コンテキストから情報を取得
    const queryComplexity = context?.queryComplexity || 'simple';
    const userTier = context?.userTier || 'free';
    const isProposalMode = context?.isProposalMode || false;
    
    // 提案モードや複雑なクエリの場合は高性能モデルを使用
    if (isProposalMode || queryComplexity === 'complex') {
      return openai('gpt-4o'); // より高性能なモデル
    }
    
    // プレミアムユーザーには標準モデル
    if (userTier === 'premium') {
      return openai('gpt-4o-mini');
    }
    
    // デフォルトは最もコスト効率の良いモデル
    return openai('gpt-3.5-turbo');
  },
  // Memory configuration disabled for now due to type mismatch
  // memory: {
  //   lastMessages: 8, // Keep last 8 messages for context
  //   semanticRecall: true, // Enable semantic search (when available)
  // },
  // 動的インストラクション: ユーザーレベルに応じて指示を調整
  instructions: (context) => {
    const userLevel = context?.userLevel || 'intermediate';
    const marketStatus = context?.marketStatus || 'open';
    const language = context?.language || 'ja';
    
    const baseInstructions = `
あなたはCryptrade暗号通貨取引プラットフォームの意図分析専門エージェントです。

## 責務: 
- ユーザーの質問を分析し、適切な専門エージェントを選択する
- 一般的な会話や挨拶は直接処理する（AIファースト、定型文なし）

## メモリとコンテキスト:
- 過去8件のメッセージ履歴を参照可能
- memoryRecallToolを使用して会話コンテキストを取得
- 必要に応じて過去の会話を検索
`;

    // ユーザーレベルに応じた追加指示
    const levelInstructions = {
      beginner: `
## 初心者向け特別指示:
- より丁寧で分かりやすい説明を心がける
- 専門用語は避けるか、使用時は説明を追加
- 操作手順は詳細に説明
`,
      intermediate: '',
      expert: `
## エキスパート向け特別指示:
- 技術的な詳細を含む簡潔な応答
- 高度な分析機能を積極的に活用
- プロフェッショナルな用語使用可
`,
    };

    // 市場状況に応じた追加指示
    const marketInstructions = marketStatus === 'closed' ? `
## 市場クローズ時の特別指示:
- リアルタイムデータの代わりに履歴データを活用
- 次の市場オープンに向けた準備を提案
- テクニカル分析と学習に重点
` : '';

    const agentDescriptions = `
## 利用可能な専門エージェント:

### 🔍 price_inquiry (価格照会)
- 対象: シンプルな価格確認
- 例: "BTCの価格", "ETHいくら", "現在価格"
- 特徴: 高速レスポンス

### 🎮 ui_control (UI操作・描画)
- 対象: チャート操作・描画・表示変更
- 例: "トレンドラインを引いて", "BTCに変更", "移動平均を表示", "フィボナッチ描画"
- 特徴: インタラクティブ操作

### 📊 trading_analysis (取引分析)
- 対象: 詳細分析・投資判断・レポート
- 例: "BTCを分析", "買うべき？", "市場状況", "投資戦略"
- 特徴: 包括的分析

### 💬 conversational (一般会話)
- 対象: 挨拶・ヘルプ・その他
- 例: "こんにちは", "使い方", "ありがとう"
- 特徴: 汎用対応

## 実行パターン:
1. 必要に応じてmemoryRecallToolでコンテキストを取得
2. agentSelectionToolを使用して適切なエージェントを実行
`;

    // 会話処理用の追加インストラクション
    const conversationInstructions = `
## 一般会話の処理:
簡単な挨拶や雑談は直接応答してください。

### 会話のガイドライン:
- 暗号通貨に詳しい友達のような存在として振る舞う
- 明るく前向きで、時には一緒に興奮したり心配したりする
- 専門知識を持ちながらも、難しい言葉は避ける
- 適度に絵文字を使って親しみやすさを演出（使いすぎない）
- ユーザーの感情に共感し、寄り添う
- 時には質問を返して会話を盛り上げる

### 挨拶・雑談:
- 時間帯に応じた挨拶（おはよう、こんにちは、お疲れ様）
- 天気や季節の話題から市場へ自然に繋げる
- 「今日の市場は〜」「最近の〜はどうですか？」

### 市場の雑談:
- 専門用語を使わず、例え話で説明
- 「BTCがジェットコースターみたいに動いてます🎢」
- 「市場が眠そうな感じですね😴」
- トレンドを身近な話題に例える
`;

    return baseInstructions + 
           (levelInstructions[userLevel as keyof typeof levelInstructions] || '') +
           marketInstructions +
           conversationInstructions +
           agentDescriptions;
  },
  // 動的ツール選択: 状況に応じて利用可能なツールを変更
  tools: (context) => {
    const baseTools = {
      agentSelectionTool,
      memoryRecallTool,
    };
    
    // 会話用ツール（軽量）
    const conversationTools = {
      marketSnapshot: marketSnapshotTool,
      trendingTopics: trendingTopicsTool,
      quickPrice: marketDataResilientTool, // 価格確認が必要な場合
    };
    
    // 全てのツールを含める（Orchestratorが判断）
    return { ...baseTools, ...conversationTools };
  },
});

// Import unified intent analysis
import { analyzeIntent, type IntentAnalysisResult as UnifiedIntentResult } from '../utils/intent';

// Export for backward compatibility with tests
export const analyzeUserIntent = analyzeIntent;

/**
 * 単体テスト対応の実行関数
 */
// Runtime context type
export interface OrchestratorRuntimeContext {
  userTier?: 'free' | 'premium';
  userLevel?: 'beginner' | 'intermediate' | 'expert';
  marketStatus?: 'open' | 'closed';
  queryComplexity?: 'simple' | 'complex';
  isProposalMode?: boolean;
}

// Execution result type
export interface OrchestratorExecutionResult {
  response?: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  toolResults?: Array<{ toolName: string; result: unknown }>;
  error?: Error;
}

// Execution response type
export interface OrchestratorExecutionResponse {
  analysis: IntentAnalysisResult;
  executionResult?: OrchestratorExecutionResult;
  executionTime: number;
  success: boolean;
  memoryContext?: string;
}

export async function executeImprovedOrchestrator(
  userQuery: string, 
  sessionId?: string,
  runtimeContext?: OrchestratorRuntimeContext
): Promise<OrchestratorExecutionResponse> {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();
  const memoryStore = useEnhancedConversationMemory.getState();
  
  // Ensure session exists with enhanced processors
  const activeSessionId = sessionId || memoryStore.currentSessionId || 
    await createEnhancedSession(undefined, {
      maxTokens: 127000, // GPT-4o limit
      excludeTools: ['marketDataTool', 'chartControlTool'], // Heavy tools
    });
  
  const trace = traceManager.startTrace({
    sessionId: activeSessionId,
    agentId: 'improved-orchestrator',
    operationType: 'agent_call',
  });

  // A2A通信のためのエージェント登録確認
  try {
    registerAllAgents();
    logger.debug('[Improved Orchestrator] A2A agents registered for session', {
      correlationId,
      sessionId: activeSessionId,
    });
  } catch (registrationError) {
    logger.warn('[Improved Orchestrator] Agent registration failed, continuing without A2A', {
      correlationId,
      error: String(registrationError),
    });
  }

  try {
    logger.info('[Improved Orchestrator] Processing query with memory', {
      correlationId,
      sessionId: activeSessionId,
      queryLength: userQuery.length,
    });

    // Step 1: Add user message to memory
    await memoryStore.addMessage({
      sessionId: activeSessionId,
      role: 'user',
      content: userQuery,
      agentId: 'improved-orchestrator',
    });

    // Step 2: Get processed conversation context (with Memory Processors applied)
    const memoryContext = memoryStore.getSessionContext(activeSessionId);
    const memoryStats = memoryStore.getMemoryStats(activeSessionId);
    
    logger.debug('[Improved Orchestrator] Enhanced memory context retrieved', {
      correlationId,
      contextLength: memoryContext.length,
      totalMessages: memoryStats.totalMessages,
      processedMessages: memoryStats.processedMessages,
      estimatedTokens: memoryStats.estimatedTokens,
      processors: memoryStats.processors,
    });

    // Step 3: 統一された意図分析関数を使用
    const unifiedAnalysis = analyzeIntent(userQuery);
    
    // Debug logging for intent analysis
    logger.debug('[Improved Orchestrator] Raw unified analysis', {
      correlationId,
      userQuery,
      unifiedAnalysis: JSON.stringify(unifiedAnalysis, null, 2),
    });
    
    // Convert to IntentAnalysisResult format
    const analysis: IntentAnalysisResult = {
      intent: unifiedAnalysis.intent,
      confidence: unifiedAnalysis.confidence,
      extractedSymbol: unifiedAnalysis.extractedSymbol,
      reasoning: unifiedAnalysis.reasoning,
      analysisDepth: unifiedAnalysis.analysisDepth,
      isProposalMode: unifiedAnalysis.isProposalMode,
      proposalType: unifiedAnalysis.proposalType,
    };
    
    // Extract metadata for memory
    const { symbols, topics } = extractMetadataFromQuery(userQuery);
    
    logger.info('[Improved Orchestrator] Intent analysis completed', {
      correlationId,
      intent: analysis.intent,
      confidence: analysis.confidence,
      symbols,
      topics,
    });

    // Step 4: エージェント実行またはOrchestratorで直接処理
    let executionResult;
    try {
      // 一般会話はOrchestratorで直接処理
      const conversationalIntents = ['market_chat', 'small_talk', 'greeting', 'help_request', 'conversational'];
      
      if (conversationalIntents.includes(analysis.intent)) {
        logger.info('[Improved Orchestrator] Handling conversation directly', {
          correlationId,
          intent: analysis.intent,
          emotionalTone: unifiedAnalysis.emotionalTone,
          conversationMode: unifiedAnalysis.conversationMode,
        });
        
        // 関係性レベルを判定
        const relationshipLevel = memoryStats.totalMessages < 5 ? 'new' : 
                                memoryStats.totalMessages < 20 ? 'familiar' : 'regular';
        
        // Orchestratorで直接会話を処理
        executionResult = await handleConversation({
          intent: analysis.intent,
          userQuery,
          relationshipLevel,
          emotionalTone: (unifiedAnalysis as { emotionalTone?: string }).emotionalTone,
          conversationMode: (unifiedAnalysis as { conversationMode?: string }).conversationMode,
          extractedSymbol: analysis.extractedSymbol,
          correlationId,
        });
        
      } else {
        // 専門的な質問は従来通りエージェントへ委譲
        let targetAgent: string;
        
        switch (analysis.intent) {
          case 'price_inquiry':
            targetAgent = 'priceInquiryAgent';
            break;
          case 'ui_control':
            targetAgent = 'uiControlAgent';
            break;
          case 'trading_analysis':
          case 'proposal_request':
            targetAgent = 'tradingAnalysisAgent';
            break;
          default:
            targetAgent = 'tradingAnalysisAgent'; // デフォルトは分析エージェント
        }
        
        logger.info('[Improved Orchestrator] Delegating to specialized agent', {
          correlationId,
          originalIntent: analysis.intent,
          targetAgent,
        });
        
        const agentResult = await agentSelectionTool.execute({
          context: {
            agentType: targetAgent,
            query: userQuery,
            context: {
              extractedSymbol: analysis.extractedSymbol || 'BTCUSDT',
              analysisDepth: analysis.analysisDepth,
              sessionId: activeSessionId,
              memoryContext: memoryContext.substring(0, 1000), // Limit context size
              isProposalMode: analysis.isProposalMode,
              proposalType: analysis.proposalType,
              isEntryProposal: (analysis as { isEntryProposal?: boolean }).isEntryProposal,
              interval: '1h', // デフォルトの時間足
              conversationMode: (unifiedAnalysis as { conversationMode?: string }).conversationMode,
              emotionalTone: (unifiedAnalysis as { emotionalTone?: string }).emotionalTone,
              relationshipLevel: memoryStats.totalMessages < 5 ? 'new' : 
                              memoryStats.totalMessages < 20 ? 'familiar' : 'regular',
            },
            correlationId,
          },
        });
        
        // 専門エージェントの結果にメタデータを追加
        executionResult = {
          ...agentResult,
          metadata: {
            ...agentResult.metadata,
            processedBy: targetAgent,
            intent: analysis.intent,
            delegatedFrom: 'orchestrator',
          },
        };
      }
      
      // Add assistant response to memory
      if (executionResult) {
        let responseContent = '';
        
        if (typeof executionResult === 'object' && executionResult !== null) {
          if ('response' in executionResult) {
            responseContent = String(executionResult.response);
          } else if ('executionResult' in executionResult && executionResult.executionResult?.response) {
            responseContent = String(executionResult.executionResult.response);
          } else if ('message' in executionResult) {
            responseContent = String(executionResult.message);
          }
        }
        
        if (responseContent) {
          await memoryStore.addMessage({
            sessionId: activeSessionId,
            role: 'assistant',
            content: responseContent,
            agentId: analysis.intent,
            metadata: {
              intent: analysis.intent,
              confidence: analysis.confidence,
              symbols,
              topics,
              processedBy: executionResult.metadata?.processedBy || 'unknown',
            },
          });
        }
      }
    } catch (agentError) {
      logger.warn('[Improved Orchestrator] Agent execution failed, but analysis succeeded', {
        correlationId,
        agentError: String(agentError),
      });
      // エージェント実行失敗でも分析結果は返す
    }

    const executionTime = Date.now() - startTime;

    traceManager.endTrace(correlationId, {
      latencyMs: executionTime,
      tokensInput: userQuery.length / 4,
      tokensOutput: 0,
      costUsd: 0.001,
      success: true,
    });

    return {
      analysis,
      executionResult,
      executionTime,
      success: true,
      memoryContext,
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error('[Improved Orchestrator] Failed', {
      correlationId,
      error: String(error),
      executionTime,
    });

    traceManager.endTrace(correlationId, {
      latencyMs: executionTime,
      tokensInput: userQuery.length / 4,
      tokensOutput: 0,
      costUsd: 0,
      success: false,
      errorCode: 'ORCHESTRATOR_FAILED',
    });

    // フォールバック分析
    const fallbackAnalysis = {
      intent: 'conversational' as const,
      confidence: 0.5,
      reasoning: 'エラーフォールバック',
      analysisDepth: 'basic' as const,
    };

    return {
      analysis: fallbackAnalysis,
      executionTime,
      success: false,
    };
  }
}

/**
 * Extract metadata from query for memory storage
 */
function extractMetadataFromQuery(query: string): { symbols: string[]; topics: string[] } {
  const symbols: string[] = [];
  const topics: string[] = [];
  
  // Extract cryptocurrency symbols
  const cryptoSymbols = ['BTC', 'ETH', 'ADA', 'SOL', 'DOGE', 'XRP', 'DOT', 'LINK', 'UNI', 'AVAX', 'MATIC'];
  const queryUpper = query.toUpperCase();
  
  for (const symbol of cryptoSymbols) {
    if (queryUpper.includes(symbol)) {
      symbols.push(symbol);
    }
  }
  
  // Extract topics
  const queryLower = query.toLowerCase();
  if (queryLower.includes('価格') || queryLower.includes('price')) topics.push('price');
  if (queryLower.includes('分析') || queryLower.includes('analysis')) topics.push('analysis');
  if (queryLower.includes('チャート') || queryLower.includes('chart')) topics.push('chart');
  if (queryLower.includes('取引') || queryLower.includes('trading')) topics.push('trading');
  
  return { symbols, topics };
}

/**
 * 会話処理を専用関数で実行
 */
async function handleConversation(params: {
  intent: string;
  userQuery: string;
  relationshipLevel: string;
  emotionalTone?: string;
  conversationMode?: string;
  extractedSymbol?: string;
  correlationId: string;
}): Promise<unknown> {
  const { intent, userQuery, relationshipLevel, emotionalTone, conversationMode, extractedSymbol, correlationId } = params;
  
  try {
    // すべての会話でAIに考えさせる
    logger.info('[handleConversation] Generating AI response', {
      correlationId,
      intent,
      emotionalTone,
      relationshipLevel,
    });
    
    // 会話用のAIエージェントを作成
    const conversationAgent = new Agent({
      name: 'dynamic-conversation',
      model: openai('gpt-4o-mini'),
      instructions: `
あなたはCryptrade暗号通貨取引プラットフォームの親しみやすい会話相手です。

## 現在の状況:
- ユーザーの意図: ${intent}
- 感情トーン: ${emotionalTone || 'neutral'}
- 関係性レベル: ${relationshipLevel}
- 会話モード: ${conversationMode || 'casual'}
${extractedSymbol ? `- 言及された通貨: ${extractedSymbol}` : ''}

## 応答ガイドライン:
1. 毎回異なる自然な応答を生成する（定型文禁止）
2. ユーザーの感情に共感し、適切なトーンで応答
3. 暗号通貨の話題を自然に織り交ぜる（押し付けない）
4. 関係性レベルに応じて距離感を調整:
   - new: 丁寧で親切な初対面の対応
   - familiar: 少し打ち解けた感じ
   - regular: 親しい友人のような距離感
5. 適度に絵文字を使用（使いすぎない）

## 意図別の追加指示:
${intent === 'greeting' ? `
- 時間帯に応じた挨拶
- 市場の状況を軽く触れる
- 今日の気分を聞いてみる` : ''}
${intent === 'market_chat' ? `
- ${extractedSymbol || 'BTC'}の現在の状況について触れる
- 専門用語を使わず、例え話で説明
- ユーザーの投資への関心を引き出す質問` : ''}
${intent === 'small_talk' || intent === 'conversational' ? `
- 雑談から自然に市場の話題へ
- ユーザーの気持ちに寄り添う
- 次の行動を促す提案` : ''}
${intent === 'help_request' ? `
- 具体的で実用的なアドバイス
- 初心者にも分かりやすく
- 追加のサポートを提案` : ''}

重要: 必ず文脈に応じた新しい応答を生成してください。同じパターンの繰り返しは避けてください。
      `.trim(),
    });
    
    // AIに応答を生成させる
    const aiResponse = await conversationAgent.generate([
      { role: 'user' as const, content: userQuery },
    ]);
    
    const responseText = aiResponse?.text || '申し訳ございません。応答を生成できませんでした。';
    
    return {
      response: responseText,
      toolResults: [],
      metadata: {
        processedBy: 'orchestrator-direct',
        intent,
        relationshipLevel,
        conversationMode,
        emotionalTone,
      },
    };
    
  } catch (error) {
    logger.error('[handleConversation] Failed to generate response', {
      correlationId,
      error: String(error),
    });
    
    // フォールバック応答
    return {
      response: '申し訳ございません。現在、応答を生成できません。',
      metadata: {
        processedBy: 'orchestrator-direct-fallback',
        intent,
        error: String(error),
      },
    };
  }
}

// ランダム選択関数は削除 - すべてAI生成に置き換え