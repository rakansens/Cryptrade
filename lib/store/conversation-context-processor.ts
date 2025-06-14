import { ConversationMessage } from './enhanced-conversation-memory.store.db';
import { logger } from '@/lib/utils/logger';

/**
 * Conversation Context Processor
 * 
 * 会話の文脈を分析して、より自然な応答を生成するためのプロセッサー
 */

export interface ConversationContext {
  recentTopics: string[];
  userMood: 'positive' | 'neutral' | 'concerned' | 'excited';
  conversationDepth: number;
  lastInteractionTime?: Date;
  preferredStyle: 'formal' | 'casual' | 'friendly';
  symbols: string[];
  relationshipLevel: 'new' | 'familiar' | 'regular';
}

export class ConversationContextProcessor {
  private readonly TOPIC_WINDOW = 5; // 直近5メッセージから話題を抽出
  
  /**
   * メッセージ履歴から会話コンテキストを抽出
   */
  extractContext(messages: ConversationMessage[]): ConversationContext {
    const recentMessages = messages.slice(-this.TOPIC_WINDOW);
    
    return {
      recentTopics: this.extractRecentTopics(recentMessages),
      userMood: this.analyzeUserMood(recentMessages),
      conversationDepth: messages.length,
      lastInteractionTime: messages[messages.length - 1]?.timestamp,
      preferredStyle: this.detectPreferredStyle(messages),
      symbols: this.extractMentionedSymbols(recentMessages),
      relationshipLevel: this.determineRelationshipLevel(messages),
    };
  }
  
  /**
   * 最近の話題を抽出
   */
  private extractRecentTopics(messages: ConversationMessage[]): string[] {
    const topics = new Set<string>();
    
    messages.forEach(msg => {
      const content = msg.content.toLowerCase();
      
      // 価格関連
      if (content.includes('価格') || content.includes('price')) {
        topics.add('price');
      }
      
      // 分析関連
      if (content.includes('分析') || content.includes('analysis')) {
        topics.add('analysis');
      }
      
      // 取引関連
      if (content.includes('取引') || content.includes('買') || content.includes('売')) {
        topics.add('trading');
      }
      
      // チャート関連
      if (content.includes('チャート') || content.includes('chart')) {
        topics.add('chart');
      }
      
      // 市場全般
      if (content.includes('市場') || content.includes('相場')) {
        topics.add('market');
      }
      
      // メタデータから追加
      if (msg.metadata?.topics) {
        msg.metadata.topics.forEach(topic => topics.add(topic));
      }
    });
    
    return Array.from(topics);
  }
  
  /**
   * ユーザーの感情を分析
   */
  private analyzeUserMood(messages: ConversationMessage[]): ConversationContext['userMood'] {
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) return 'neutral';
    
    let positiveCount = 0;
    let concernedCount = 0;
    let excitedCount = 0;
    
    userMessages.forEach(msg => {
      const content = msg.content.toLowerCase();
      
      // ポジティブな表現
      if (content.includes('いいね') || content.includes('すごい') || 
          content.includes('ありがとう') || content.includes('嬉しい')) {
        positiveCount++;
      }
      
      // 懸念を示す表現
      if (content.includes('心配') || content.includes('不安') || 
          content.includes('大丈夫') || content.includes('怖い')) {
        concernedCount++;
      }
      
      // 興奮を示す表現
      if (content.includes('！！') || content.includes('すごい！') || 
          content.includes('やった') || content.includes('最高')) {
        excitedCount++;
      }
    });
    
    // 最も多い感情を返す
    if (excitedCount > positiveCount && excitedCount > concernedCount) {
      return 'excited';
    }
    if (concernedCount > positiveCount) {
      return 'concerned';
    }
    if (positiveCount > 0) {
      return 'positive';
    }
    
    return 'neutral';
  }
  
  /**
   * 好みの会話スタイルを検出
   */
  private detectPreferredStyle(messages: ConversationMessage[]): ConversationContext['preferredStyle'] {
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length < 3) return 'casual'; // デフォルトはカジュアル
    
    let formalIndicators = 0;
    let casualIndicators = 0;
    
    userMessages.forEach(msg => {
      const content = msg.content;
      
      // フォーマルな指標
      if (content.includes('ですか') || content.includes('ますか') || 
          content.includes('お願いします')) {
        formalIndicators++;
      }
      
      // カジュアルな指標
      if (content.includes('！') || content.includes('〜') || 
          content.includes('ね') || content.includes('よ')) {
        casualIndicators++;
      }
    });
    
    if (formalIndicators > casualIndicators * 1.5) {
      return 'formal';
    }
    if (casualIndicators > formalIndicators) {
      return 'friendly';
    }
    
    return 'casual';
  }
  
  /**
   * 言及された暗号通貨シンボルを抽出
   */
  private extractMentionedSymbols(messages: ConversationMessage[]): string[] {
    const symbols = new Set<string>();
    const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI'];
    
    messages.forEach(msg => {
      const contentUpper = msg.content.toUpperCase();
      cryptoSymbols.forEach(symbol => {
        if (contentUpper.includes(symbol)) {
          symbols.add(symbol);
        }
      });
      
      // メタデータからも抽出
      if (msg.metadata?.symbols) {
        msg.metadata.symbols.forEach(s => symbols.add(s));
      }
    });
    
    return Array.from(symbols);
  }
  
  /**
   * ユーザーとの関係性レベルを判定
   */
  private determineRelationshipLevel(messages: ConversationMessage[]): ConversationContext['relationshipLevel'] {
    const messageCount = messages.length;
    
    if (messageCount < 5) {
      return 'new';
    }
    if (messageCount < 20) {
      return 'familiar';
    }
    
    return 'regular';
  }
  
  /**
   * コンテキストに基づいて応答スタイルを調整
   */
  adjustResponseStyle(baseResponse: string, context: ConversationContext): string {
    let adjustedResponse = baseResponse;
    
    // 関係性レベルに応じた調整
    switch (context.relationshipLevel) {
      case 'new':
        // 新規ユーザーには丁寧に
        if (!adjustedResponse.includes('さん')) {
          adjustedResponse = adjustedResponse.replace('。', 'ですね。');
        }
        break;
        
      case 'regular':
        // 常連ユーザーにはよりカジュアルに
        adjustedResponse = adjustedResponse.replace('ございます', 'ます');
        adjustedResponse = adjustedResponse.replace('いたします', 'します');
        break;
    }
    
    // 感情に応じた調整
    if (context.userMood === 'excited' && !adjustedResponse.includes('！')) {
      adjustedResponse = adjustedResponse.replace('。', '！');
    }
    
    if (context.userMood === 'concerned') {
      // 心配している場合は落ち着いたトーンに
      adjustedResponse = adjustedResponse.replace('！', '。');
    }
    
    logger.debug('[ConversationContextProcessor] Response adjusted', {
      relationshipLevel: context.relationshipLevel,
      userMood: context.userMood,
      originalLength: baseResponse.length,
      adjustedLength: adjustedResponse.length,
    });
    
    return adjustedResponse;
  }
}