import { describe, it, expect } from '@jest/globals';
import { formatMessageForAgent } from '../message-utils';
import { AGENT_IDS } from '@/types';

describe('message utils', () => {
  it('formats price inquiry message', () => {
    const prompt = formatMessageForAgent({
      id: '1',
      type: 'request',
      source: 'orchestrator',
      target: AGENT_IDS.PRICE_INQUIRY,
      method: 'process_query',
      params: { query: 'BTCの価格は?' },
      timestamp: Date.now(),
    });

    expect(prompt).toContain('marketDataResilientTool');
    expect(prompt).toContain('BTCUSDT');
  });
});
