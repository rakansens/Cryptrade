import {
  detectShortInput,
  detectEntryProposal,
  detectUIControl,
  detectPriceInquiry,
  detectProposalRequest,
  detectDrawingProposal,
  detectTradingAnalysis,
  detectGreeting,
  detectHelpRequest,
  detectMarketChat,
  detectSmallTalk
} from '../intent';

describe('Intent helper functions', () => {
  test('detectShortInput returns conversational for short text', () => {
    const res = detectShortInput('a', 'a');
    expect(res).not.toBeNull();
    expect(res!.intent).toBe('conversational');
  });

  test('detectShortInput ignores exceptions', () => {
    expect(detectShortInput('hi', 'hi')).toBeNull();
  });

  test('detectEntryProposal detects entry proposals', () => {
    const res = detectEntryProposal('エントリー提案して', 'エントリー提案して');
    expect(res).not.toBeNull();
    expect(res!.proposalType).toBe('entry');
  });

  test('detectUIControl detects chart switch', () => {
    const query = 'BTCのチャートに切り替えて';
    const res = detectUIControl(query, query.toLowerCase());
    expect(res?.intent).toBe('ui_control');
  });

  test('detectPriceInquiry detects price questions', () => {
    const query = 'BTCの価格は？';
    const res = detectPriceInquiry(query, query.toLowerCase());
    expect(res?.intent).toBe('price_inquiry');
  });

  test('detectProposalRequest detects general proposal', () => {
    const query = 'トレンドラインの提案';
    const res = detectProposalRequest(query, query.toLowerCase());
    expect(res?.proposalType).toBe('trendline');
  });

  test('detectDrawingProposal detects drawing commands', () => {
    const query = 'トレンドラインを引いて';
    const res = detectDrawingProposal(query, query.toLowerCase());
    expect(res?.proposalType).toBe('trendline');
  });

  test('detectTradingAnalysis detects analysis request', () => {
    const query = 'BTCを分析して';
    const res = detectTradingAnalysis(query, query.toLowerCase());
    expect(res?.intent).toBe('trading_analysis');
  });

  test('detectGreeting detects greetings', () => {
    const query = 'こんにちは';
    const res = detectGreeting(query, query.toLowerCase());
    expect(res?.intent).toBe('greeting');
  });

  test('detectHelpRequest detects help', () => {
    const query = 'help';
    const res = detectHelpRequest(query, query.toLowerCase());
    expect(res?.intent).toBe('help_request');
  });

  test('detectMarketChat detects casual market chat', () => {
    const query = '最近の市場はどう？';
    const res = detectMarketChat(query, query.toLowerCase());
    expect(res?.intent).toBe('market_chat');
  });

  test('detectSmallTalk detects small talk', () => {
    const query = 'ありがとう';
    const res = detectSmallTalk(query, query.toLowerCase());
    expect(res?.intent).toBe('small_talk');
  });
});
