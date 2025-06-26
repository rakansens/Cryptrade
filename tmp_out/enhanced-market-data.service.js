"use strict";
// Mock for EnhancedMarketDataService
// NOTE: This mock is designed to work with the test setup in the test file
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhancedMarketDataService = exports.EnhancedMarketDataService = void 0;
class EnhancedMarketDataService {
    constructor() {
        this.cache = new Map();
        // Mocked methods ---------------------------------------------
        this.fetchMultiTimeframeData = jest.fn().mockImplementation(async (symbol, _timeframeConfigs, _signal) => {
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
        });
        this.findMultiTimeframeSupportResistance = jest.fn().mockReturnValue([]);
        this.findConfluenceZones = jest.fn().mockReturnValue([]);
        this.calculateCrossTimeframeValidation = jest.fn().mockReturnValue({
            validationScore: 0.8,
            supportingTimeframes: [],
            touchCounts: {},
            avgStrength: 0.75
        });
        this.clearCache = jest.fn().mockImplementation(() => {
            this.cache.clear();
        });
        this.getCacheStats = jest.fn().mockImplementation(() => ({
            size: this.cache.size,
            entries: Array.from(this.cache.entries()).map(([key, data]) => ({
                key,
                age: Date.now() - ((data === null || data === void 0 ? void 0 : data.fetchedAt) || 0)
            }))
        }));
    }
}
exports.EnhancedMarketDataService = EnhancedMarketDataService;
// Convenience singleton (optional, used by some modules)
exports.enhancedMarketDataService = new EnhancedMarketDataService();
exports.default = EnhancedMarketDataService;
