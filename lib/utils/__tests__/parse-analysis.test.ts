import { parseAnalysisText, isAnalysisMessage } from '../parse-analysis';
import type { AnalysisResultData } from '@/components/chat/AnalysisResultCard';

describe('parse-analysis', () => {
  describe('parseAnalysisText', () => {
    it('should parse complete analysis text correctly', () => {
      const analysisText = `BTCUSDTの4時間チャート分析結果

現在価格: $45,000.50

### トレンド分析
トレンド方向: 上昇
トレンド強度: 75%
信頼度: 85%

### サポートとレジスタンス
サポートライン: $44,000 (強度: 80%, タッチ回数: 3)
サポートライン: $43,500 (強度: 70%, タッチ回数: 2)
レジスタンスライン: $46,000 (強度: 90%, タッチ回数: 4)
レジスタンスライン: $47,500 (強度: 75%, タッチ回数: 2)

### ボラティリティ
ATR: 1500.25
ボラティリティレベル: 高
ATRパーセント: 3.5%

### モメンタム指標
RSI: 65.5 (買われ過ぎゾーン)
MACD: 強気シグナル

### 検出されたパターン
上昇トライアングル: 強気の継続パターン
ダブルボトム: 反転パターンの可能性

### 推奨事項
- ストップロスを$44,000に設定
- 利益確定ポイントを$46,000に設定
- ポジションサイズを調整

### 次のアクション
エントリーポイントを待つ
リスク管理を徹底する
`;

      const result = parseAnalysisText(analysisText);

      expect(result).toEqual({
        symbol: 'BTCUSDT',
        timeframe: '4時間',
        price: {
          current: 45000.50
        },
        trend: {
          direction: 'up',
          strength: 75,
          confidence: 85
        },
        support: [
          { price: 44000, strength: 80, touches: 3 },
          { price: 43500, strength: 70, touches: 2 }
        ],
        resistance: [
          { price: 46000, strength: 90, touches: 4 },
          { price: 47500, strength: 75, touches: 2 }
        ],
        volatility: {
          atr: 1500.25,
          level: 'high',
          percentage: 3.5
        },
        momentum: {
          rsi: {
            value: 65.5,
            signal: 'overbought'
          },
          macd: {
            value: 0,
            signal: 0,
            histogram: 0,
            trend: 'bullish'
          }
        },
        patterns: [
          { name: '上昇トライアングル', description: '強気の継続パターン' },
          { name: 'ダブルボトム', description: '反転パターンの可能性' }
        ],
        recommendations: [
          'ストップロスを$44,000に設定',
          '利益確定ポイントを$46,000に設定',
          'ポジションサイズを調整'
        ],
        nextActions: [
          'エントリーポイントを待つ',
          'リスク管理を徹底する'
        ]
      });
    });

    it('should handle partial analysis text', () => {
      const partialText = `
ETHUSDTの1時間チャート分析結果

現在価格: $2,500

トレンド方向: 下降
トレンド強度: 60%
`;

      const result = parseAnalysisText(partialText);

      expect(result).toEqual({
        symbol: 'ETHUSDT',
        timeframe: '1時間',
        price: {
          current: 2500
        },
        trend: {
          direction: 'down',
          strength: 60,
          confidence: 0
        },
        support: [],
        resistance: [],
        volatility: {
          atr: 0,
          level: 'medium',
          percentage: 0
        },
        momentum: {
          rsi: {
            value: 0,
            signal: 'neutral'
          },
          macd: {
            value: 0,
            signal: 0,
            histogram: 0,
            trend: 'neutral'
          }
        },
        patterns: undefined,
        recommendations: undefined,
        nextActions: undefined
      });
    });

    it('should parse different timeframe formats', () => {
      const testCases = [
        { input: 'BTCUSDTの15分チャート', expected: '15分' },
        { input: 'ETHUSDTの1時間チャート', expected: '1時間' },
        { input: 'XRPUSDTの4時間チャート', expected: '4時間' },
        { input: 'BNBUSDTの1日チャート', expected: '1日' },
        { input: 'ADAUSDTの1週間チャート', expected: '1週間' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = parseAnalysisText(input);
        expect(result?.timeframe).toBe(expected);
      });
    });

    it('should parse price with different formats', () => {
      const testCases = [
        { text: '現在価格: $45,000.50', expected: 45000.50 },
        { text: '現値: $1,234.56', expected: 1234.56 },
        { text: '現在価格: 45000', expected: 45000 },
        { text: '価格: $123.45', expected: 123.45 },
      ];

      testCases.forEach(({ text, expected }) => {
        const result = parseAnalysisText(`BTCUSDTの1時間チャート\n${text}`);
        expect(result?.price.current).toBe(expected);
      });
    });

    it('should parse trend directions correctly', () => {
      const testCases = [
        { text: 'トレンド方向: 上昇', expected: 'up' },
        { text: 'トレンド方向: 下降', expected: 'down' },
        { text: 'トレンド方向: 横ばい', expected: 'neutral' },
        { text: 'トレンド方向: レンジ', expected: 'neutral' },
      ];

      testCases.forEach(({ text, expected }) => {
        const result = parseAnalysisText(`BTCUSDTの1時間チャート\n${text}`);
        expect(result?.trend.direction).toBe(expected);
      });
    });

    it('should parse RSI signals correctly', () => {
      const testCases = [
        { text: 'RSI: 75 (買われ過ぎ)', expected: 'overbought' },
        { text: 'RSI: 25 (売られ過ぎ)', expected: 'oversold' },
        { text: 'RSI: 50 (中立)', expected: 'neutral' },
        { text: 'RSI: 60', expected: 'neutral' },
      ];

      testCases.forEach(({ text, expected }) => {
        const result = parseAnalysisText(`BTCUSDTの1時間チャート\n${text}`);
        expect(result?.momentum.rsi.signal).toBe(expected);
      });
    });

    it('should parse MACD trends correctly', () => {
      const testCases = [
        { text: 'MACD: 強気シグナル', expected: 'bullish' },
        { text: 'MACD: 弱気シグナル', expected: 'bearish' },
        { text: 'MACD: 中立シグナル', expected: 'neutral' },
      ];

      testCases.forEach(({ text, expected }) => {
        const result = parseAnalysisText(`BTCUSDTの1時間チャート\n${text}`);
        expect(result?.momentum.macd.trend).toBe(expected);
      });
    });

    it('should parse volatility levels correctly', () => {
      const testCases = [
        { text: 'ボラティリティレベル: 高', expected: 'high' },
        { text: 'ボラティリティレベル: 低', expected: 'low' },
        { text: 'ボラティリティレベル: 中', expected: 'medium' },
      ];

      testCases.forEach(({ text, expected }) => {
        const result = parseAnalysisText(`BTCUSDTの1時間チャート\n${text}`);
        expect(result?.volatility.level).toBe(expected);
      });
    });

    it('should handle malformed text gracefully', () => {
      const malformedText = 'This is not an analysis text';
      const result = parseAnalysisText(malformedText);
      expect(result).toBeNull();
    });

    it('should handle empty text', () => {
      const result = parseAnalysisText('');
      expect(result).toBeNull();
    });

    it('should parse recommendations with various formats', () => {
      const analysisText = `
BTCUSDTの1時間チャート

推奨事項:
- ストップロスを設定
* 利益確定を検討
・ポジション調整
リスク管理`;

      const result = parseAnalysisText(analysisText);
      expect(result?.recommendations).toEqual([
        'ストップロスを設定',
        '利益確定を検討',
        'ポジション調整',
        'リスク管理'
      ]);
    });

    it('should handle errors during parsing', () => {
      // Mock console.error to verify it's called
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Pass an object that will cause parsing to fail
      const result = parseAnalysisText(null as any);
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse analysis text:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('isAnalysisMessage', () => {
    it('should identify analysis messages correctly', () => {
      const analysisMessages = [
        'BTCUSDTの4時間チャート分析結果',
        'ETHUSDTの1時間足チャート分析結果',
        '現在の価格: $45,000\nトレンド分析',
        'サポートとレジスタンス',
        'ボラティリティ: 高\nモメンタム指標'
      ];

      analysisMessages.forEach(message => {
        expect(isAnalysisMessage(message)).toBe(true);
      });
    });

    it('should reject non-analysis messages', () => {
      const nonAnalysisMessages = [
        'Hello, how are you?',
        'Please analyze this chart',
        'What is the current price?',
        'Show me the indicators',
        ''
      ];

      nonAnalysisMessages.forEach(message => {
        expect(isAnalysisMessage(message)).toBe(false);
      });
    });

    it('should handle partial matches', () => {
      const partialMessages = [
        'BTCUSDTの15分チャート', // Missing 分析結果
        'トレンド分析のみ', // Missing price and chart info
        'サポート: $44,000', // Missing full context
      ];

      partialMessages.forEach(message => {
        expect(isAnalysisMessage(message)).toBe(false);
      });
    });
  });
});