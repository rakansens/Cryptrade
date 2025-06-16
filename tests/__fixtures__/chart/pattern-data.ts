/**
 * チャートパターンデータのフィクスチャ
 */

import { Pattern, PatternKeyPoint } from '@/types/pattern';

export const mockTrianglePattern: Pattern = {
  id: 'pattern-triangle-1',
  type: 'triangle',
  name: 'Ascending Triangle',
  startTime: 1638360000,
  endTime: 1638446400,
  timeframe: '1h',
  confidence: 0.85,
  keyPoints: [
    {
      time: 1638360000,
      price: 48000,
      type: 'low',
      label: 'Support Start'
    },
    {
      time: 1638381600,
      price: 48500,
      type: 'high',
      label: 'Resistance Level'
    },
    {
      time: 1638403200,
      price: 48100,
      type: 'low',
      label: 'Support Touch'
    },
    {
      time: 1638424800,
      price: 48500,
      type: 'high',
      label: 'Resistance Retest'
    },
    {
      time: 1638446400,
      price: 48200,
      type: 'low',
      label: 'Triangle Apex'
    }
  ],
  trendlines: [
    {
      start: { time: 1638360000, price: 48000 },
      end: { time: 1638446400, price: 48200 },
      type: 'support'
    },
    {
      start: { time: 1638381600, price: 48500 },
      end: { time: 1638424800, price: 48500 },
      type: 'resistance'
    }
  ],
  metrics: {
    priceChange: 200,
    percentageChange: 0.42,
    volume: 15000,
    volatility: 0.02
  }
};

export const mockHeadAndShouldersPattern: Pattern = {
  id: 'pattern-hs-1',
  type: 'head-and-shoulders',
  name: 'Head and Shoulders',
  startTime: 1638360000,
  endTime: 1638532800,
  timeframe: '4h',
  confidence: 0.92,
  keyPoints: [
    {
      time: 1638360000,
      price: 48000,
      type: 'low',
      label: 'Left Shoulder Base'
    },
    {
      time: 1638388800,
      price: 49000,
      type: 'high',
      label: 'Left Shoulder Peak'
    },
    {
      time: 1638417600,
      price: 48200,
      type: 'low',
      label: 'Neckline Left'
    },
    {
      time: 1638446400,
      price: 50000,
      type: 'high',
      label: 'Head Peak'
    },
    {
      time: 1638475200,
      price: 48200,
      type: 'low',
      label: 'Neckline Right'
    },
    {
      time: 1638504000,
      price: 49000,
      type: 'high',
      label: 'Right Shoulder Peak'
    },
    {
      time: 1638532800,
      price: 48000,
      type: 'low',
      label: 'Pattern Completion'
    }
  ],
  trendlines: [
    {
      start: { time: 1638417600, price: 48200 },
      end: { time: 1638475200, price: 48200 },
      type: 'neckline'
    }
  ],
  metrics: {
    priceChange: -2000,
    percentageChange: -4.0,
    volume: 25000,
    volatility: 0.04
  }
};

export const mockWedgePattern: Pattern = {
  id: 'pattern-wedge-1',
  type: 'wedge',
  name: 'Rising Wedge',
  startTime: 1638360000,
  endTime: 1638489600,
  timeframe: '2h',
  confidence: 0.78,
  keyPoints: [
    {
      time: 1638360000,
      price: 47500,
      type: 'low',
      label: 'Wedge Start'
    },
    {
      time: 1638378000,
      price: 48000,
      type: 'high',
      label: 'First High'
    },
    {
      time: 1638396000,
      price: 47700,
      type: 'low',
      label: 'Higher Low'
    },
    {
      time: 1638414000,
      price: 48300,
      type: 'high',
      label: 'Higher High'
    },
    {
      time: 1638432000,
      price: 47900,
      type: 'low',
      label: 'Converging Low'
    },
    {
      time: 1638450000,
      price: 48500,
      type: 'high',
      label: 'Wedge Top'
    },
    {
      time: 1638489600,
      price: 48100,
      type: 'low',
      label: 'Wedge End'
    }
  ],
  trendlines: [
    {
      start: { time: 1638360000, price: 47500 },
      end: { time: 1638489600, price: 48100 },
      type: 'support'
    },
    {
      start: { time: 1638378000, price: 48000 },
      end: { time: 1638450000, price: 48500 },
      type: 'resistance'
    }
  ],
  metrics: {
    priceChange: 600,
    percentageChange: 1.26,
    volume: 18000,
    volatility: 0.025
  }
};

export const mockFlagPattern: Pattern = {
  id: 'pattern-flag-1',
  type: 'flag',
  name: 'Bull Flag',
  startTime: 1638360000,
  endTime: 1638403200,
  timeframe: '30m',
  confidence: 0.88,
  keyPoints: [
    {
      time: 1638360000,
      price: 47000,
      type: 'low',
      label: 'Pole Start'
    },
    {
      time: 1638367200,
      price: 49000,
      type: 'high',
      label: 'Pole Top'
    },
    {
      time: 1638374400,
      price: 48500,
      type: 'low',
      label: 'Flag Start'
    },
    {
      time: 1638381600,
      price: 48800,
      type: 'high',
      label: 'Flag Channel Top'
    },
    {
      time: 1638388800,
      price: 48400,
      type: 'low',
      label: 'Flag Channel Bottom'
    },
    {
      time: 1638396000,
      price: 48700,
      type: 'high',
      label: 'Flag End'
    },
    {
      time: 1638403200,
      price: 49500,
      type: 'high',
      label: 'Breakout Target'
    }
  ],
  trendlines: [
    {
      start: { time: 1638374400, price: 48500 },
      end: { time: 1638388800, price: 48400 },
      type: 'support'
    },
    {
      start: { time: 1638381600, price: 48800 },
      end: { time: 1638396000, price: 48700 },
      type: 'resistance'
    }
  ],
  metrics: {
    priceChange: 2500,
    percentageChange: 5.32,
    volume: 22000,
    volatility: 0.03
  }
};

export const mockChannelPattern: Pattern = {
  id: 'pattern-channel-1',
  type: 'channel',
  name: 'Ascending Channel',
  startTime: 1638360000,
  endTime: 1638619200,
  timeframe: '6h',
  confidence: 0.82,
  keyPoints: [
    {
      time: 1638360000,
      price: 47500,
      type: 'low',
      label: 'Channel Start Low'
    },
    {
      time: 1638381600,
      price: 48500,
      type: 'high',
      label: 'Channel Start High'
    },
    {
      time: 1638424800,
      price: 48000,
      type: 'low',
      label: 'Channel Low 2'
    },
    {
      time: 1638468000,
      price: 49000,
      type: 'high',
      label: 'Channel High 2'
    },
    {
      time: 1638511200,
      price: 48500,
      type: 'low',
      label: 'Channel Low 3'
    },
    {
      time: 1638554400,
      price: 49500,
      type: 'high',
      label: 'Channel High 3'
    },
    {
      time: 1638619200,
      price: 49000,
      type: 'low',
      label: 'Channel End'
    }
  ],
  trendlines: [
    {
      start: { time: 1638360000, price: 47500 },
      end: { time: 1638619200, price: 49000 },
      type: 'support'
    },
    {
      start: { time: 1638381600, price: 48500 },
      end: { time: 1638554400, price: 49500 },
      type: 'resistance'
    }
  ],
  metrics: {
    priceChange: 1500,
    percentageChange: 3.16,
    volume: 30000,
    volatility: 0.028
  }
};

export const mockPatternCollection = [
  mockTrianglePattern,
  mockHeadAndShouldersPattern,
  mockWedgePattern,
  mockFlagPattern,
  mockChannelPattern
];

export const generateRandomPattern = (type: string = 'triangle'): Pattern => {
  const startTime = Date.now() / 1000 - 86400 * 7; // 7 days ago
  const endTime = Date.now() / 1000;
  const basePrice = 48000 + Math.random() * 2000 - 1000;
  
  return {
    id: `pattern-${type}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} Pattern`,
    startTime,
    endTime,
    timeframe: '1h',
    confidence: 0.7 + Math.random() * 0.3,
    keyPoints: [],
    trendlines: [],
    metrics: {
      priceChange: (Math.random() - 0.5) * 2000,
      percentageChange: (Math.random() - 0.5) * 10,
      volume: Math.random() * 50000 + 10000,
      volatility: Math.random() * 0.05 + 0.01
    }
  };
};