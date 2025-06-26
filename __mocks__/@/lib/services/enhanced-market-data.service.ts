// Mock for EnhancedMarketDataService
// NOTE: This mock is designed to work with the test setup in the test file

export class EnhancedMarketDataService {
  private cache = new Map<string, any>();

  // Mocked methods ---------------------------------------------
  fetchMultiTimeframeData = jest.fn().mockImplementation(
    async (
      symbol: string,
      _timeframeConfigs?: any,
      _signal?: AbortSignal
    ) => {
      // Return simple deterministic mock data
      return {
        symbol,
        timeframes: {
          '15m': { data: [], weight: 0.2, dataPoints: 200 },
          '1h': { data: [], weight: 0.3, dataPoints: 500 },
          '4h': { data: [], weight: 0.35, dataPoints: 400 },
          '1d': { data: [], weight: 0.15, dataPoints: 200 }
        },
        fetchedAt: Date.now()
      };
    }
  );

  findMultiTimeframeSupportResistance = jest.fn().mockReturnValue([]);

  findConfluenceZones = jest.fn().mockReturnValue([]);

  calculateCrossTimeframeValidation = jest.fn().mockReturnValue({
    validationScore: 0.8,
    supportingTimeframes: [],
    touchCounts: {},
    avgStrength: 0.75
  });

  clearCache = jest.fn().mockImplementation(() => {
    this.cache.clear();
  });

  getCacheStats = jest.fn().mockImplementation(() => ({
    size: this.cache.size,
    entries: Array.from(this.cache.entries()).map(([key, data]) => ({
      key,
      age: Date.now() - (data?.fetchedAt || 0)
    }))
  }));
}

// Convenience singleton (optional, used by some modules)
export const enhancedMarketDataService = new EnhancedMarketDataService();

export default EnhancedMarketDataService;