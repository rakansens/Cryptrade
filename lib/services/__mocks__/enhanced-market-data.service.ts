// Mock for EnhancedMarketDataService placed adjacent to real module.

export class EnhancedMarketDataService {
  private cache = new Map<string, any>();

  fetchMultiTimeframeData = jest.fn().mockResolvedValue({
    symbol: 'MOCK',
    timeframes: {},
    fetchedAt: Date.now(),
  });

  findMultiTimeframeSupportResistance = jest.fn().mockReturnValue([]);
  findConfluenceZones = jest.fn().mockReturnValue([]);
  calculateCrossTimeframeValidation = jest.fn().mockReturnValue({
    validationScore: 1,
    supportingTimeframes: [],
    touchCounts: {},
    avgStrength: 1,
  });
  clearCache = jest.fn(() => this.cache.clear());
  getCacheStats = jest.fn(() => ({ size: 0, entries: [] }));
}

export const enhancedMarketDataService = new EnhancedMarketDataService();
export default EnhancedMarketDataService; 