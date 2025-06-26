import { describe, it, expect, jest } from '@jest/globals';

jest.mock('@/lib/services/enhanced-market-data.service');

describe('manual mock with jest.mock', () => {
  it('should still get jest.fn methods', () => {
    const { EnhancedMarketDataService } = require('@/lib/services/enhanced-market-data.service');
    const service = new EnhancedMarketDataService();
    expect(service.fetchMultiTimeframeData).toBeDefined();
    expect(service.fetchMultiTimeframeData.mockResolvedValueOnce).toBeDefined();
  });
}); 