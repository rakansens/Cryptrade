import { analyzeIntent } from '../orchestrator.agent';
import type { IntentAnalysisResult } from '../orchestrator.agent';

describe('Orchestrator Agent - Intent Analysis', () => {
  describe('analyzeIntent function', () => {
    describe('Greeting Detection', () => {
      const greetingTests = [
        { input: 'こんにちは', expected: 'greeting' },
        { input: 'おはようございます', expected: 'greeting' },
        { input: 'こんばんは', expected: 'greeting' },
        { input: 'Hello', expected: 'greeting' },
        { input: 'Hi there!', expected: 'greeting' },
        { input: 'やあ！', expected: 'greeting' },
      ];

      test.each(greetingTests)('should detect greeting: "$input"', ({ input, expected }) => {
        const result = analyzeIntent(input);
        expect(result.intent).toBe(expected);
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
        expect(result.conversationMode).toBe('friendly');
      });
    });

    describe('Small Talk Detection', () => {
      const smallTalkTests = [
        { input: 'ありがとう', expected: 'small_talk' },
        { input: '疲れたなあ', expected: 'small_talk' },
        { input: '今日は暑いですね', expected: 'small_talk' },
        { input: 'お疲れ様でした', expected: 'small_talk' },
        { input: '元気ですか？', expected: 'small_talk' },
      ];

      test.each(smallTalkTests)('should detect small talk: "$input"', ({ input, expected }) => {
        const result = analyzeIntent(input);
        expect(result.intent).toBe(expected);
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });

    describe('Market Chat Detection', () => {
      const marketChatTests = [
        { input: '最近の市場はどう？', expected: 'market_chat' },
        { input: 'ビットコインの将来性について', expected: 'market_chat' },
        { input: '暗号通貨って面白いよね', expected: 'market_chat' },
        { input: '市場のトレンドはどうなってる？', expected: 'market_chat' },
      ];

      test.each(marketChatTests)('should detect market chat: "$input"', ({ input, expected }) => {
        const result = analyzeIntent(input);
        expect(result.intent).toBe(expected);
        expect(result.confidence).toBeGreaterThanOrEqual(0.7);
        expect(result.conversationMode).toBe('casual');
      });
    });

    describe('Price Inquiry Detection', () => {
      const priceTests = [
        { input: 'BTCの価格は？', symbol: 'BTC' },
        { input: 'ビットコインはいくら？', symbol: 'BTC' },
        { input: 'ETHの現在価格を教えて', symbol: 'ETH' },
        { input: 'イーサリアムの値段', symbol: 'ETH' },
        { input: 'リップルの価格を知りたい', symbol: 'XRP' },
      ];

      test.each(priceTests)('should detect price inquiry: "$input"', ({ input, symbol }) => {
        const result = analyzeIntent(input);
        expect(result.intent).toBe('price_inquiry');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        expect(result.extractedSymbol).toBe(symbol);
      });
    });

    describe('UI Control Detection', () => {
      const uiControlTests = [
        { input: 'BTCのチャートを表示', action: 'display_chart' },
        { input: 'ビットコインに切り替えて', action: 'switch_symbol' },
        { input: 'トレンドラインを描いて', action: 'draw_line' },
        { input: '15分足に変更', action: 'change_timeframe' },
        { input: 'インジケーターを追加', action: 'add_indicator' },
      ];

      test.each(uiControlTests)('should detect UI control: "$input"', ({ input }) => {
        const result = analyzeIntent(input);
        expect(result.intent).toBe('ui_control');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });

    describe('Trading Analysis Detection', () => {
      const analysisTests = [
        { input: 'BTCの技術分析をして', depth: 'comprehensive' },
        { input: 'サポートとレジスタンスを分析', depth: 'detailed' },
        { input: 'エントリーポイントを教えて', depth: 'detailed' },
        { input: 'RSIとMACDの状況は？', depth: 'detailed' },
      ];

      test.each(analysisTests)('should detect trading analysis: "$input"', ({ input, depth }) => {
        const result = analyzeIntent(input);
        expect(result.intent).toBe('trading_analysis');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        expect(result.analysisDepth).toBe(depth);
      });
    });

    describe('Proposal Request Detection', () => {
      const proposalTests = [
        { input: 'エントリー提案をして', proposalType: 'all' },
        { input: 'トレンドラインベースで提案', proposalType: 'trendline' },
        { input: 'サポートラインでエントリー提案', proposalType: 'support-resistance' },
        { input: 'パターン分析で提案して', proposalType: 'pattern' },
      ];

      test.each(proposalTests)('should detect proposal request: "$input"', ({ input, proposalType }) => {
        const result = analyzeIntent(input);
        expect(result.intent).toBe('proposal_request');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        expect(result.isProposalMode).toBe(true);
        expect(result.proposalType).toBe(proposalType);
      });
    });

    describe('Help Request Detection', () => {
      const helpTests = [
        { input: '使い方を教えて', expected: 'help_request' },
        { input: 'ヘルプ', expected: 'help_request' },
        { input: 'どうすればいい？', expected: 'help_request' },
        { input: '機能について教えて', expected: 'help_request' },
      ];

      test.each(helpTests)('should detect help request: "$input"', ({ input, expected }) => {
        const result = analyzeIntent(input);
        expect(result.intent).toBe(expected);
        expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      });
    });

    describe('Ambiguous Cases', () => {
      test('should handle ambiguous "BTC" input', () => {
        const result = analyzeIntent('BTC');
        // Could be price inquiry or UI control
        expect(['price_inquiry', 'ui_control']).toContain(result.intent);
        expect(result.confidence).toBeGreaterThanOrEqual(0.5);
        expect(result.extractedSymbol).toBe('BTC');
      });

      test('should default to conversational for unclear input', () => {
        const result = analyzeIntent('なんか変だな');
        expect(result.intent).toBe('conversational');
        expect(result.confidence).toBeLessThan(0.7);
      });
    });

    describe('Symbol Extraction', () => {
      const symbolTests = [
        { input: 'BTCについて', symbol: 'BTC' },
        { input: 'ビットコインの話', symbol: 'BTC' },
        { input: 'ETHとBTCの比較', symbol: 'ETH' }, // First symbol
        { input: 'イーサリアムがいい', symbol: 'ETH' },
        { input: 'リップル（XRP）', symbol: 'XRP' },
      ];

      test.each(symbolTests)('should extract symbol from: "$input"', ({ input, symbol }) => {
        const result = analyzeIntent(input);
        expect(result.extractedSymbol).toBe(symbol);
      });
    });

    describe('Confidence Levels', () => {
      test('should have high confidence for clear intents', () => {
        const clearIntents = [
          'こんにちは',
          'BTCの価格は？',
          'チャートを表示',
          'エントリー提案して',
        ];

        clearIntents.forEach(input => {
          const result = analyzeIntent(input);
          expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        });
      });

      test('should have lower confidence for ambiguous intents', () => {
        const ambiguousIntents = [
          'BTC',
          'どう思う？',
          'これは？',
        ];

        ambiguousIntents.forEach(input => {
          const result = analyzeIntent(input);
          expect(result.confidence).toBeLessThan(0.8);
        });
      });
    });

    describe('Analysis Depth', () => {
      test('should assign appropriate analysis depth', () => {
        const depthTests = [
          { input: '価格は？', depth: 'basic' },
          { input: 'RSIを見て', depth: 'detailed' },
          { input: '詳細な技術分析をして', depth: 'comprehensive' },
          { input: '完全な市場分析をお願い', depth: 'comprehensive' },
        ];

        depthTests.forEach(({ input, depth }) => {
          const result = analyzeIntent(input);
          if (result.intent === 'trading_analysis') {
            expect(result.analysisDepth).toBe(depth);
          }
        });
      });
    });

    describe('Emotional Tone Detection', () => {
      const toneTests = [
        { input: 'すごい！BTCが上がってる！', tone: 'excited' },
        { input: '心配だな...下がってる', tone: 'concerned' },
        { input: 'BTCの価格を教えて', tone: 'neutral' },
        { input: 'いいね！利益が出た！', tone: 'positive' },
      ];

      test.each(toneTests)('should detect emotional tone: "$input"', ({ input, tone }) => {
        const result = analyzeIntent(input);
        expect(result.emotionalTone).toBe(tone);
      });
    });

    describe('Edge Cases', () => {
      test('should handle empty input', () => {
        const result = analyzeIntent('');
        expect(result.intent).toBe('conversational');
        expect(result.confidence).toBeLessThan(0.5);
      });

      test('should handle very long input', () => {
        const longInput = 'これは非常に長い入力で、' + 'いろいろなことを話している'.repeat(20);
        const result = analyzeIntent(longInput);
        expect(result).toBeDefined();
        expect(result.intent).toBeDefined();
      });

      test('should handle special characters', () => {
        const specialInputs = [
          '!!!???',
          '😊😊😊',
          '@#$%^&*()',
          '...',
        ];

        specialInputs.forEach(input => {
          const result = analyzeIntent(input);
          expect(result).toBeDefined();
          expect(result.intent).toBe('conversational');
        });
      });
    });
  });
});