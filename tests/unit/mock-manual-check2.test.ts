import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EnhancedMarketDataService } from '@/lib/services/enhanced-market-data.service';

let service: any;
let mockFetch: jest.Mock;

describe('Manual mock with clearAllMocks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service = new EnhancedMarketDataService();
    mockFetch = service.fetchMultiTimeframeData;
  });

  it('should still have jest.fn after clearAllMocks', () => {
    expect(mockFetch).toBeDefined();
    expect(mockFetch.mockResolvedValueOnce).toBeDefined();
  });
}); 