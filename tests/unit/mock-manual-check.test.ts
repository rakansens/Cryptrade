import { describe, it, expect } from '@jest/globals';
import { EnhancedMarketDataService } from '@/lib/services/enhanced-market-data.service';

describe('Manual mock sanity check', () => {
  it('should provide jest.fn methods', () => {
    const service = new EnhancedMarketDataService();
    expect(service.fetchMultiTimeframeData).toBeDefined();
    expect((service.fetchMultiTimeframeData as any).mockResolvedValueOnce).toBeDefined();
  });
}); 