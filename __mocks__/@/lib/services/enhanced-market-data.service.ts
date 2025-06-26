// Mock for EnhancedMarketDataService
import type { 
  MultiTimeframeData, 
  SupportResistanceLevel, 
  ConfluenceZone,
  TimeframeConfig
} from '@/lib/services/enhanced-market-data.service';
import type { ProcessedKline } from '@/types/market';

const mockMultiTimeframeData: MultiTimeframeData = {
  symbol: 'BTCUSDT',
  timeframes: {
    '15m': {
      data: [],
      weight: 0.2,
      dataPoints: 200
    },
    '1h': {
      data: [],
      weight: 0.3,
      dataPoints: 500
    },
    '4h': {
      data: [],
      weight: 0.35,
      dataPoints: 400
    },
    '1d': {
      data: [],
      weight: 0.15,
      dataPoints: 200
    }
  },
  fetchedAt: Date.now()
};

const mockSupportResistanceLevels: SupportResistanceLevel[] = [
  {
    price: 50000,
    strength: 0.8,
    touchCount: 5,
    timeframeSupport: ['1h', '4h'],
    confidenceScore: 0.9,
    firstSeen: Date.now() - 86400000,
    lastSeen: Date.now(),
    type: 'resistance'
  },
  {
    price: 49000,
    strength: 0.7,
    touchCount: 4,
    timeframeSupport: ['15m', '1h', '4h'],
    confidenceScore: 0.85,
    firstSeen: Date.now() - 172800000,
    lastSeen: Date.now(),
    type: 'support'
  }
];

const mockConfluenceZones: ConfluenceZone[] = [
  {
    priceRange: {
      min: 49800,
      max: 50200,
      center: 50000
    },
    strength: 0.8,
    timeframeCount: 3,
    supportingTimeframes: ['15m', '1h', '4h'],
    levels: mockSupportResistanceLevels,
    type: 'resistance'
  }
];

// Create a cache for the mock service
const mockCache = new Map<string, MultiTimeframeData>();

export const enhancedMarketDataService = {
  fetchMultiTimeframeData: jest.fn().mockImplementation(
    async (symbol: string): Promise<MultiTimeframeData> => {
      // Check cache first
      const cacheKey = symbol;
      const cached = mockCache.get(cacheKey);
      
      if (cached && Date.now() - cached.fetchedAt < 60000) {
        // Return cached data if it's less than 60 seconds old
        return cached;
      }

      // Generate mock klines for each timeframe
      const timeframes: Record<string, any> = {};
      const intervals = ['15m', '1h', '4h', '1d'];
      const weights = [0.2, 0.3, 0.35, 0.15];
      const dataPoints = [200, 500, 400, 200];

      intervals.forEach((interval, index) => {
        const klines: ProcessedKline[] = [];
        const limit = dataPoints[index];
        let currentPrice = 50000;

        for (let i = 0; i < limit; i++) {
          const time = Date.now() - (limit - i) * 3600000;
          const trend = Math.sin(i * 0.02) * 0.001;
          const noise = (Math.random() - 0.5) * 0.01;
          const priceChange = trend + noise;
          currentPrice *= (1 + priceChange);

          const volatility = currentPrice * 0.005;
          const open = currentPrice;
          const close = currentPrice * (1 + priceChange);
          const high = Math.max(open, close) + Math.random() * volatility;
          const low = Math.min(open, close) - Math.random() * volatility;
          const volume = 100 + Math.random() * 1000;

          klines.push({ time, open, high, low, close, volume });
          currentPrice = close;
        }

        timeframes[interval] = {
          data: klines,
          weight: weights[index],
          dataPoints: dataPoints[index]
        };
      });

      const result = {
        symbol,
        timeframes,
        fetchedAt: Date.now()
      };

      // Store in cache
      mockCache.set(cacheKey, result);

      return result;
    }
  ),

  findMultiTimeframeSupportResistance: jest.fn().mockImplementation(
    (data: MultiTimeframeData, options?: any): SupportResistanceLevel[] => {
      const minTimeframes = options?.minTimeframes || 1;
      return mockSupportResistanceLevels.filter(
        level => level.timeframeSupport.length >= minTimeframes
      );
    }
  ),

  findConfluenceZones: jest.fn().mockImplementation(
    (data: MultiTimeframeData, options?: any): ConfluenceZone[] => {
      const minTimeframes = options?.minTimeframes || 2;
      return mockConfluenceZones.filter(
        zone => zone.timeframeCount >= minTimeframes
      );
    }
  ),

  calculateCrossTimeframeValidation: jest.fn().mockImplementation(
    (price: number, data: MultiTimeframeData) => {
      return {
        validationScore: 0.8,
        supportingTimeframes: ['15m', '1h', '4h'],
        touchCounts: { '15m': 3, '1h': 5, '4h': 2 },
        avgStrength: 0.75
      };
    }
  ),

  clearCache: jest.fn().mockImplementation(() => {
    mockCache.clear();
  }),

  getCacheStats: jest.fn().mockReturnValue({
    size: 1,
    entries: [{ key: 'BTCUSDT', age: 1000 }]
  })
};