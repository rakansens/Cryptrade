import { extractSymbol, analyzeIntent } from '../intent';

describe('Symbol Extraction', () => {
  describe('extractSymbol', () => {
    it('should extract English symbols and add USDT suffix', () => {
      expect(extractSymbol('BTCの価格は？')).toBe('BTCUSDT');
      expect(extractSymbol('What is the ETH price?')).toBe('ETHUSDT');
      expect(extractSymbol('SOL analysis')).toBe('SOLUSDT');
      expect(extractSymbol('ada')).toBe('ADAUSDT');
    });

    it('should extract Japanese currency names', () => {
      expect(extractSymbol('ビットコインの価格')).toBe('BTCUSDT');
      expect(extractSymbol('イーサリアムを分析して')).toBe('ETHUSDT');
      expect(extractSymbol('リップルのトレンドライン')).toBe('XRPUSDT');
      expect(extractSymbol('ドージコインいくら？')).toBe('DOGEUSDT');
      expect(extractSymbol('ソラナの値段')).toBe('SOLUSDT');
      expect(extractSymbol('カルダノは？')).toBe('ADAUSDT');
      expect(extractSymbol('ポルカドットの分析')).toBe('DOTUSDT');
    });

    it('should handle symbols already with USDT suffix', () => {
      expect(extractSymbol('BTCUSDT price')).toBe('BTCUSDT');
      expect(extractSymbol('ETHUSDT')).toBe('ETHUSDT');
    });

    it('should return undefined when no symbol is found', () => {
      expect(extractSymbol('価格を教えて')).toBeUndefined();
      expect(extractSymbol('トレンドラインを引いて')).toBeUndefined();
      expect(extractSymbol('Hello')).toBeUndefined();
    });
  });

  describe('analyzeIntent with symbol extraction', () => {
    it('should extract symbols for price inquiries', () => {
      const result1 = analyzeIntent('BTCの価格は？');
      expect(result1.intent).toBe('price_inquiry');
      expect(result1.extractedSymbol).toBe('BTCUSDT');

      const result2 = analyzeIntent('ビットコインいくら？');
      expect(result2.intent).toBe('price_inquiry');
      expect(result2.extractedSymbol).toBe('BTCUSDT');
    });

    it('should extract symbols for proposal requests', () => {
      const result1 = analyzeIntent('ETHのトレンドラインを提案して');
      expect(result1.intent).toBe('proposal_request');
      expect(result1.extractedSymbol).toBe('ETHUSDT');
      expect(result1.isProposalMode).toBe(true);
      expect(result1.proposalType).toBe('trendline');

      const result2 = analyzeIntent('リップルのサポートラインを引いて');
      expect(result2.intent).toBe('proposal_request');
      expect(result2.extractedSymbol).toBe('XRPUSDT');
      expect(result2.proposalType).toBe('support-resistance');
    });

    it('should extract symbols for trading analysis', () => {
      const result = analyzeIntent('ソラナを分析して');
      expect(result.intent).toBe('trading_analysis');
      expect(result.extractedSymbol).toBe('SOLUSDT');
    });

    it('should handle queries without symbols', () => {
      const result1 = analyzeIntent('価格を教えて');
      expect(result1.intent).toBe('price_inquiry');
      expect(result1.extractedSymbol).toBeUndefined();

      const result2 = analyzeIntent('トレンドラインを提案して');
      expect(result2.intent).toBe('proposal_request');
      expect(result2.extractedSymbol).toBeUndefined();
    });
  });

  describe('Short input handling', () => {
    it('should correctly handle short analysis keywords', () => {
      const result = analyzeIntent('分析');
      expect(result.intent).toBe('trading_analysis');
      expect(result.confidence).toBe(0.85);
      expect(result.reasoning).toBe('詳細分析キーワード検出');
    });

    it('should correctly handle short price keywords', () => {
      const result1 = analyzeIntent('価格');
      expect(result1.intent).toBe('price_inquiry');
      expect(result1.confidence).toBe(0.9);

      const result2 = analyzeIntent('値段');
      expect(result2.intent).toBe('price_inquiry');
      expect(result2.confidence).toBe(0.9);
    });

    it('should treat very short inputs as conversational', () => {
      const result1 = analyzeIntent('a');
      expect(result1.intent).toBe('conversational');
      expect(result1.confidence).toBe(0.5);

      const result2 = analyzeIntent('分');
      expect(result2.intent).toBe('conversational');
      expect(result2.reasoning).toBe('短い入力のため詳細不明');
    });

    it('should handle short greeting exceptions', () => {
      const result1 = analyzeIntent('hi');
      expect(result1.intent).toBe('greeting');
      
      const result2 = analyzeIntent('はい');
      expect(result2.intent).toBe('conversational');
      expect(result2.confidence).toBe(0.6);
    });
  });
});