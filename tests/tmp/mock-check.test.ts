import { EnhancedMarketDataService } from '@/lib/services/enhanced-market-data.service';

const service = new EnhancedMarketDataService();

test('manual mock check', () => {
  expect(service.fetchMultiTimeframeData).toBeDefined();
  expect((service.fetchMultiTimeframeData as any).mockResolvedValueOnce).toBeDefined();
}); 