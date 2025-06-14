import { logger } from '@/lib/utils/logger';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

/**
 * Fallback Handler for Agent Failures
 * 
 * エージェント実行失敗時の統一的なフォールバック処理
 * - A2A通信失敗
 * - ツール実行エラー
 * - タイムアウト
 * などの場合に一貫した応答を提供
 */

// Context types for fallback handler
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export interface FallbackContext {
  conversationHistory?: ConversationMessage[];
  agentState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface FallbackConfig {
  agentType: string;
  query: string;
  context?: FallbackContext;
  error?: Error | string;
  useStaticResponse?: boolean;
}

export interface FallbackResponse {
  response: string;
  metadata: {
    model: string;
    fallbackType: 'ai' | 'static' | 'error';
    originalAgent: string;
    error?: string;
    timestamp: number;
  };
}

// エージェントタイプ別の静的フォールバックメッセージ
const STATIC_FALLBACK_MESSAGES: Record<string, string> = {
  price_inquiry: 'ただいま価格データの取得ができません。しばらくしてから再度お試しください。',
  ui_control: 'UI操作を実行できませんでした。ブラウザをリロードしてお試しください。',
  trading_analysis: '分析処理中にエラーが発生しました。しばらくしてから再度お試しください。',
  conversational: '申し訳ございません。一時的にシステムで問題が発生しています。',
  default: 'リクエストの処理中にエラーが発生しました。しばらくしてから再度お試しください。',
};

// エージェントタイプ別のAIプロンプトテンプレート
const AI_FALLBACK_PROMPTS: Record<string, (query: string, context?: string) => string> = {
  price_inquiry: (query, context) => `
${context || ''}
User request: "${query}"

あなたは暗号通貨価格専門のアシスタントです。
一時的にリアルタイムデータが利用できません。
以下の点を含めて親切に応答してください：
- データが一時的に利用できないことを説明
- 代替の情報源（取引所の公式サイトなど）を提案
- 一般的な市場動向についてのアドバイス
`,
  
  ui_control: (query, context) => `
${context || ''}
User request: "${query}"

あなたはチャートUI操作のアシスタントです。
一時的に直接的なUI操作ができません。
以下の点を含めて親切に応答してください：
- 要求された操作の説明
- 手動での操作方法
- 代替手段の提案
`,
  
  trading_analysis: (query, context) => `
${context || ''}
User request: "${query}"

あなたは暗号通貨取引分析の専門家です。
詳細なデータ分析は一時的に利用できませんが、一般的なアドバイスを提供してください：
- 基本的な分析の考え方
- リスク管理の重要性
- 一般的な市場分析のヒント
`,
  
  conversational: (query, context) => `
${context || ''}
User request: "${query}"

あなたはCryptradeプラットフォームのアシスタントです。
ユーザーの質問に対して親切で有益な応答を提供してください。
技術的な問題がある場合でも、可能な限りユーザーを支援してください。
`,
};

export class FallbackHandler {
  /**
   * 統一的なフォールバック処理
   */
  static async handle(config: FallbackConfig): Promise<FallbackResponse> {
    const { agentType, query, context, error, useStaticResponse = false } = config;
    
    logger.warn('[FallbackHandler] Handling fallback', {
      agentType,
      queryLength: query.length,
      hasContext: !!context,
      error: error ? String(error) : undefined,
      useStaticResponse,
    });

    // 静的レスポンスを使用する場合
    if (useStaticResponse) {
      return this.getStaticResponse(agentType, error);
    }

    // AIによるフォールバック生成を試行
    try {
      return await this.generateAIFallback(agentType, query, context);
    } catch (aiError) {
      logger.error('[FallbackHandler] AI fallback generation failed', {
        agentType,
        error: String(aiError),
      });
      
      // AI生成も失敗した場合は静的レスポンス
      return this.getStaticResponse(agentType, aiError);
    }
  }

  /**
   * 静的フォールバックレスポンス
   */
  private static getStaticResponse(
    agentType: string, 
    error?: Error | string | unknown
  ): FallbackResponse {
    const message = STATIC_FALLBACK_MESSAGES[agentType] || STATIC_FALLBACK_MESSAGES.default;
    
    return {
      response: message,
      metadata: {
        model: 'static-fallback',
        fallbackType: 'static',
        originalAgent: agentType,
        error: error ? String(error) : undefined,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * AI生成フォールバックレスポンス
   */
  private static async generateAIFallback(
    agentType: string,
    query: string,
    context?: FallbackContext
  ): Promise<FallbackResponse> {
    // コンテキストの準備
    const contextStr = this.prepareContext(context);
    
    // プロンプトの選択
    const promptGenerator = AI_FALLBACK_PROMPTS[agentType] || AI_FALLBACK_PROMPTS.conversational;
    const prompt = promptGenerator(query, contextStr);

    // AI生成
    const response = await generateText({
      model: openai('gpt-3.5-turbo'),
      prompt,
      maxTokens: 300,
      temperature: 0.7,
    });

    return {
      response: response.text,
      metadata: {
        model: 'gpt-3.5-turbo',
        fallbackType: 'ai',
        originalAgent: agentType,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * コンテキストの準備（文字数制限付き）
   */
  private static prepareContext(context?: FallbackContext): string {
    if (!context) return '';

    // 会話履歴の処理
    if (context.conversationHistory && Array.isArray(context.conversationHistory)) {
      const recent = context.conversationHistory.slice(-3);
      return `Recent conversation:\n${recent.map((m: ConversationMessage) => 
        `${m.role}: ${m.content}`
      ).join('\n')}\n`;
    }

    // Agent state context
    if (context.agentState) {
      return `Agent state: ${JSON.stringify(context.agentState).substring(0, 300)}...`;
    }

    // Metadata context
    if (context.metadata) {
      return `Metadata: ${JSON.stringify(context.metadata).substring(0, 300)}...`;
    }

    return '';
  }

  /**
   * エラーの分類とユーザー向けメッセージ生成
   */
  static classifyError(error: Error | string): {
    type: 'network' | 'timeout' | 'auth' | 'unknown';
    userMessage: string;
  } {
    const errorStr = String(error).toLowerCase();

    if (errorStr.includes('network') || errorStr.includes('fetch')) {
      return {
        type: 'network',
        userMessage: 'ネットワーク接続に問題があります。インターネット接続をご確認ください。',
      };
    }

    if (errorStr.includes('timeout')) {
      return {
        type: 'timeout',
        userMessage: '処理がタイムアウトしました。しばらくしてから再度お試しください。',
      };
    }

    if (errorStr.includes('auth') || errorStr.includes('unauthorized')) {
      return {
        type: 'auth',
        userMessage: '認証エラーが発生しました。ログイン状態をご確認ください。',
      };
    }

    return {
      type: 'unknown',
      userMessage: '予期しないエラーが発生しました。しばらくしてから再度お試しください。',
    };
  }
}

// シングルトンインスタンスのエクスポート
export const fallbackHandler = new FallbackHandler();