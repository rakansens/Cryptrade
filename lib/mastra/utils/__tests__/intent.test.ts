import { analyzeIntent } from '../intent';
import type { IntentAnalysisResult, UserIntent } from '../intent';

describe('Intent Analysis Utility', () => {
  describe('Basic Intent Detection', () => {
    describe('Greetings', () => {
      const greetingTests = [
        'こんにちは',
        'おはようございます',
        'こんばんは',
        'Hello',
        'Hi',
        'やあ',
        'どうも',
      ];

      test.each(greetingTests)('should detect greeting: "%s"', (input) => {
        const result = analyzeIntent(input);
        expect(result.intent).toBe('greeting');
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
        expect(result.conversationMode).toBe('friendly');
      });
    });

    describe('Small Talk', () => {
      const smallTalkTests = [
        'ありがとう',
        'お疲れ様',
        '今日は暑いね',
        '元気？',
        'すごいね',
        'なるほど',
      ];

      test.each(smallTalkTests)('should detect small talk: "%s"', (input) => {
        const result = analyzeIntent(input);
        expect(result.intent).toBe('small_talk');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });

    describe('Market Chat', () => {
      const marketChatTests = [
        '最近の市場はどう？',
        'ビットコインの将来性',
        '暗号通貨について',
        '市場のトレンド',
        'クリプトの話',
      ];

      test.each(marketChatTests)('should detect market chat: "%s"', (input) => {
        const result = analyzeIntent(input);
        expect(result.intent).toBe('market_chat');
        expect(result.confidence).toBeGreaterThanOrEqual(0.7);
        expect(result.conversationMode).toBe('casual');
      });
    });
  });

  describe('Technical Intent Detection', () => {
    describe('Price Inquiries', () => {
      const priceTests = [
        { input: 'BTCの価格', symbol: 'BTC' },
        { input: 'ビットコインはいくら？', symbol: 'BTC' },
        { input: 'ETHの値段を教えて', symbol: 'ETH' },
        { input: 'イーサリアムの現在価格', symbol: 'ETH' },
        { input: 'XRPの価格は？', symbol: 'XRP' },
      ];

      test.each(priceTests)('should detect price inquiry: "$input"', ({ input, symbol }) => {
        const result = analyzeIntent(input);
        expect(result.intent).toBe('price_inquiry');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        expect(result.extractedSymbol).toBe(symbol);
        expect(result.requiresWorkflow).toBe(true);
      });
    });

    describe('UI Control', () => {
      const uiTests = [
        'チャートを表示',
        'BTCに切り替えて',
        'トレンドラインを描いて',
        '15分足に変更',
        'インジケーターを追加',
        'ズームイン',
        'チャートをリセット',
      ];

      test.each(uiTests)('should detect UI control: "%s"', (input) => {
        const result = analyzeIntent(input);
        expect(result.intent).toBe('ui_control');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        expect(result.requiresWorkflow).toBe(true);
      });
    });

    describe('Trading Analysis', () => {
      const analysisTests = [
        { input: '技術分析をして', depth: 'comprehensive' },
        { input: 'RSIを見て', depth: 'detailed' },
        { input: 'サポートとレジスタンス', depth: 'detailed' },
        { input: 'トレンド分析', depth: 'detailed' },
        { input: '詳細な分析をお願い', depth: 'comprehensive' },
      ];

      test.each(analysisTests)('should detect trading analysis: "$input"', ({ input, depth }) => {
        const result = analyzeIntent(input);
        expect(result.intent).toBe('trading_analysis');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        expect(result.analysisDepth).toBe(depth);
        expect(result.requiresWorkflow).toBe(true);
      });
    });
  });

  describe('Proposal Detection', () => {
    const proposalTests = [
      { input: 'エントリー提案して', type: 'entry', isEntry: true },
      { input: 'トレンドラインで提案', type: 'trendline', isEntry: false },
      { input: 'サポートベースで提案', type: 'support-resistance', isEntry: false },
      { input: 'パターン分析で提案', type: 'pattern', isEntry: false },
      { input: 'エントリーポイントを教えて', type: 'entry', isEntry: true },
    ];

    test.each(proposalTests)('should detect proposal: "$input"', ({ input, type, isEntry }) => {
      const result = analyzeIntent(input);
      expect(result.intent).toBe('proposal_request');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.isProposalMode).toBe(true);
      expect(result.proposalType).toBe(type);
      expect(result.isEntryProposal).toBe(isEntry);
      expect(result.requiresWorkflow).toBe(true);
    });
  });

  describe('Symbol Extraction', () => {
    const symbolTests = [
      { input: 'BTCについて', symbol: 'BTC' },
      { input: 'ビットコインの話', symbol: 'BTC' },
      { input: 'bitcoin価格', symbol: 'BTC' },
      { input: 'ETHとBTCの比較', symbol: 'ETH' }, // First symbol
      { input: 'イーサリアムが気になる', symbol: 'ETH' },
      { input: 'ethereum分析', symbol: 'ETH' },
      { input: 'リップル（XRP）', symbol: 'XRP' },
      { input: 'BNBチャート', symbol: 'BNB' },
      { input: 'SOLの動き', symbol: 'SOL' },
    ];

    test.each(symbolTests)('should extract symbol from: "$input"', ({ input, symbol }) => {
      const result = analyzeIntent(input);
      expect(result.extractedSymbol).toBe(symbol);
    });
  });

  describe('Confidence Calculation', () => {
    test('should have high confidence for exact keyword matches', () => {
      const highConfidenceInputs = [
        'こんにちは',
        '価格を教えて',
        'チャートを表示',
        'エントリー提案',
      ];

      highConfidenceInputs.forEach(input => {
        const result = analyzeIntent(input);
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });

    test('should have medium confidence for partial matches', () => {
      const mediumConfidenceInputs = [
        'BTCどう？',
        'なんか分析して',
        'ちょっと見せて',
      ];

      mediumConfidenceInputs.forEach(input => {
        const result = analyzeIntent(input);
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.confidence).toBeLessThan(0.8);
      });
    });

    test('should have low confidence for ambiguous inputs', () => {
      const lowConfidenceInputs = [
        'えーと',
        'これは',
        'どうかな',
      ];

      lowConfidenceInputs.forEach(input => {
        const result = analyzeIntent(input);
        expect(result.confidence).toBeLessThanOrEqual(0.5);
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty input', () => {
      const result = analyzeIntent('');
      expect(result.intent).toBe('conversational');
      expect(result.confidence).toBe(0.3);
      expect(result.suggestedResponse).toContain('何かお手伝い');
    });

    test('should handle very short input', () => {
      const shortInputs = ['a', 'あ', '1', '?'];
      
      shortInputs.forEach(input => {
        const result = analyzeIntent(input);
        expect(result.intent).toBe('conversational');
        expect(result.confidence).toBe(0.5);
        expect(result.suggestedResponse).toContain('詳しく');
      });
    });

    test('should handle short input exceptions', () => {
      const exceptions = [
        { input: 'hi', intent: 'greeting' },
        { input: 'ok', intent: 'small_talk' },
        { input: 'はい', intent: 'small_talk' },
        { input: 'no', intent: 'small_talk' },
      ];

      exceptions.forEach(({ input, intent }) => {
        const result = analyzeIntent(input);
        expect(result.intent).toBe(intent);
      });
    });

    test('should handle very long input', () => {
      const longInput = 'これは非常に長い入力で' + 'いろいろなことを話している'.repeat(50);
      const result = analyzeIntent(longInput);
      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
      expect(result.confidence).toBeDefined();
    });

    test('should handle mixed language input', () => {
      const mixedInputs = [
        'BTCの価格をcheck',
        'tradingの分析をお願い',
        'chartをズームin',
      ];

      mixedInputs.forEach(input => {
        const result = analyzeIntent(input);
        expect(result).toBeDefined();
        expect(result.intent).toBeDefined();
      });
    });

    test('should handle special characters', () => {
      const specialInputs = [
        'BTC!!!',
        '価格？？？',
        'チャート>>>',
        '@#$%',
      ];

      specialInputs.forEach(input => {
        const result = analyzeIntent(input);
        expect(result).toBeDefined();
        // Should still detect intent despite special characters
        if (input.includes('BTC')) {
          expect(result.extractedSymbol).toBe('BTC');
        }
      });
    });
  });

  describe('Emotional Tone Detection', () => {
    const toneTests = [
      { input: 'すごい！上がってる！', tone: 'excited' },
      { input: 'やばい...下がってる', tone: 'concerned' },
      { input: '心配だな', tone: 'concerned' },
      { input: 'いいね！', tone: 'positive' },
      { input: '価格を教えて', tone: 'neutral' },
    ];

    test.each(toneTests)('should detect tone: "$input" as $tone', ({ input, tone }) => {
      const result = analyzeIntent(input);
      expect(result.emotionalTone).toBe(tone);
    });
  });

  describe('Workflow Requirements', () => {
    test('should require workflow for technical intents', () => {
      const workflowRequired = [
        'price_inquiry',
        'ui_control',
        'trading_analysis',
        'proposal_request',
      ];

      workflowRequired.forEach(intent => {
        const inputs = {
          price_inquiry: 'BTCの価格',
          ui_control: 'チャートを表示',
          trading_analysis: '分析して',
          proposal_request: '提案して',
        };

        const result = analyzeIntent(inputs[intent as keyof typeof inputs]);
        expect(result.requiresWorkflow).toBe(true);
      });
    });

    test('should not require workflow for conversational intents', () => {
      const noWorkflowRequired = [
        'greeting',
        'small_talk',
        'market_chat',
      ];

      noWorkflowRequired.forEach(intent => {
        const inputs = {
          greeting: 'こんにちは',
          small_talk: 'ありがとう',
          market_chat: '市場について',
        };

        const result = analyzeIntent(inputs[intent as keyof typeof inputs]);
        expect(result.requiresWorkflow).toBe(false);
      });
    });
  });

  describe('Suggested Responses', () => {
    test('should provide suggested responses for certain intents', () => {
      const testCases = [
        { input: '', hasResponse: true },
        { input: '？', hasResponse: true },
        { input: 'help', hasResponse: true },
        { input: 'BTCの価格', hasResponse: false },
      ];

      testCases.forEach(({ input, hasResponse }) => {
        const result = analyzeIntent(input);
        if (hasResponse) {
          expect(result.suggestedResponse).toBeDefined();
          expect(result.suggestedResponse).not.toBe('');
        }
      });
    });
  });
});