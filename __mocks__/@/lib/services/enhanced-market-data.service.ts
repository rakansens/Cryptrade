// Mock for Enhanced Market Data Service
const mockMultiTimeframeData = {
  timeframes: {
    '15m': {
      data: [
        { time: Date.now() - 900000, open: 49000, high: 49200, low: 48800, close: 49100, volume: 800 },
        { time: Date.now(), open: 49100, high: 49300, low: 48900, close: 49800, volume: 900 }
      ],
      weight: 0.2,
      dataPoints: 2
    },
    '1h': {
      data: [
        { time: Date.now() - 3600000, open: 49000, high: 49200, low: 48800, close: 49100, volume: 1000 },
        { time: Date.now(), open: 49100, high: 49300, low: 48900, close: 49800, volume: 1200 }
      ],
      weight: 0.3,
      dataPoints: 2
    },
    '4h': {
      data: [
        { time: Date.now() - 14400000, open: 48500, high: 48800, low: 48200, close: 48600, volume: 5000 },
        { time: Date.now(), open: 48600, high: 48900, low: 48300, close: 49800, volume: 6000 }
      ],
      weight: 0.35,
      dataPoints: 2
    },
    '1d': {
      data: [
        { time: Date.now() - 86400000, open: 48000, high: 50000, low: 47500, close: 49800, volume: 50000 }
      ],
      weight: 0.15,
      dataPoints: 1
    }
  },
  symbol: 'BTCUSDT',
  fetchedAt: Date.now()
};

const mockSupportResistanceLevels = [
  {
    price: 45000,
    strength: 0.85,
    touchCount: 5,
    timeframeSupport: ['15m', '1h', '4h', '1d'],
    confidenceScore: 0.9,
    firstSeen: Date.now() - 86400000,
    lastSeen: Date.now() - 3600000,
    type: 'support' as const
  },
  {
    price: 49500,
    strength: 0.8,
    touchCount: 6,
    timeframeSupport: ['15m', '1h', '4h', '1d'],
    confidenceScore: 0.88,
    firstSeen: Date.now() - 86400000,
    lastSeen: Date.now() - 1800000,
    type: 'support' as const
  },
  {
    price: 48000,
    strength: 0.75,
    touchCount: 4,
    timeframeSupport: ['15m', '1h', '4h'],
    confidenceScore: 0.85,
    firstSeen: Date.now() - 86400000,
    lastSeen: Date.now() - 7200000,
    type: 'resistance' as const
  }
];

const mockConfluenceZones = [
  {
    priceRange: {
      min: 44950,
      max: 45050,
      center: 45000
    },
    strength: 0.85,
    timeframeCount: 4,
    supportingTimeframes: ['15m', '1h', '4h', '1d'],
    levels: [mockSupportResistanceLevels[0]],
    type: 'support' as const
  },
  {
    priceRange: {
      min: 49450,
      max: 49550,
      center: 49500
    },
    strength: 0.8,
    timeframeCount: 4,
    supportingTimeframes: ['15m', '1h', '4h', '1d'],
    levels: [mockSupportResistanceLevels[2]],
    type: 'support' as const
  }
];

// Mock class constructor
export class EnhancedMarketDataService {
  constructor() {}

  fetchMultiTimeframeData = jest.fn().mockResolvedValue(mockMultiTimeframeData);
  
  findMultiTimeframeSupportResistance = jest.fn().mockImplementation((options = {}) => {
    const { minTimeframes = 1 } = options;
    return mockSupportResistanceLevels.filter(level =>
      level.timeframeSupport.length >= minTimeframes
    );
  });
  
  findConfluenceZones = jest.fn().mockImplementation((options = {}) => {
    const { minTimeframes = 2 } = options;
    return mockConfluenceZones.filter(zone =>
      zone.timeframeCount >= minTimeframes
    );
  });
  
  calculateCrossTimeframeValidation = jest.fn().mockReturnValue({
    validationScore: 0.75,
    supportingTimeframes: ['1h', '4h', '1d'],
    touchCounts: { '1h': 3, '4h': 2, '1d': 1 },
    avgStrength: 0.8
  });
  
  clearCache = jest.fn();
  
  getCacheStats = jest.fn().mockReturnValue({
    size: 1,
    entries: [{ key: 'BTCUSDT-test', age: 1000 }]
  });
}

// Singleton instance mock
export const enhancedMarketDataService = new EnhancedMarketDataService();

// Export types for compatibility
export interface MultiTimeframeData {
  timeframes: Record<string, {
    data: Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
    weight: number;
    dataPoints: number;
  }>;
  symbol: string;
  fetchedAt: number;
  timestamp?: number;
}

export interface SupportResistanceLevel {
  price: number;
  strength: number;
  touchCount: number;
  timeframeSupport: string[];
  confidenceScore: number;
  firstSeen: number;
  lastSeen: number;
  type: 'support' | 'resistance';
}

export interface ConfluenceZone {
  priceRange: {
    min: number;
    max: number;
    center: number;
  };
  strength: number;
  timeframeCount: number;
  supportingTimeframes: string[];
  levels: SupportResistanceLevel[];
  type: 'support' | 'resistance' | 'pivot';
}