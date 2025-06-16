/**
 * チャートパターンデータのフィクスチャ
 */

import { PatternAnalysis, PatternVisualization } from '@/types/pattern';

export const mockTrianglePattern: PatternAnalysis = {
  type: 'ascendingTriangle',
  startTime: 1638360000,
  endTime: 1638446400,
  confidence: 0.85,
  visualization: {
    keyPoints: [
      {
        time: 1638360000,
        value: 48000,
        type: 'trough',
        label: 'Support Start'
      },
      {
        time: 1638381600,
        value: 48500,
        type: 'peak',
        label: 'Resistance Level'
      },
      {
        time: 1638403200,
        value: 48100,
        type: 'trough',
        label: 'Support Touch'
      },
      {
        time: 1638424800,
        value: 48500,
        type: 'peak',
        label: 'Resistance Retest'
      },
      {
        time: 1638446400,
        value: 48200,
        type: 'trough',
        label: 'Triangle Apex'
      }
    ],
    lines: [
      {
        from: 0,
        to: 4,
        type: 'support'
      },
      {
        from: 1,
        to: 3,
        type: 'resistance'
      }
    ]
  },
  metrics: {
    formation_period: 20,
    symmetry: 0.85,
    volume_pattern: 'neutral',
    breakout_level: 48600,
    target_level: 49000,
    stop_loss: 47900
  },
  description: 'Ascending triangle pattern with strong resistance at 48500',
  trading_implication: 'bullish'
};

export const mockHeadAndShouldersPattern: PatternAnalysis = {
  type: 'headAndShoulders',
  startTime: 1638360000,
  endTime: 1638532800,
  confidence: 0.92,
  visualization: {
    keyPoints: [
      {
        time: 1638360000,
        value: 48000,
        type: 'trough',
        label: 'Left Shoulder Base'
      },
      {
        time: 1638388800,
        value: 49000,
        type: 'peak',
        label: 'Left Shoulder Peak'
      },
      {
        time: 1638417600,
        value: 48200,
        type: 'neckline',
        label: 'Neckline Left'
      },
      {
        time: 1638446400,
        value: 50000,
        type: 'peak',
        label: 'Head Peak'
      },
      {
        time: 1638475200,
        value: 48200,
        type: 'neckline',
        label: 'Neckline Right'
      },
      {
        time: 1638504000,
        value: 49000,
        type: 'peak',
        label: 'Right Shoulder Peak'
      },
      {
        time: 1638532800,
        value: 48000,
        type: 'target',
        label: 'Pattern Completion'
      }
    ],
    lines: [
      {
        from: 2,
        to: 4,
        type: 'neckline'
      }
    ]
  },
  metrics: {
    formation_period: 48,
    symmetry: 0.88,
    volume_pattern: 'decreasing',
    breakout_level: 48000,
    target_level: 46200,
    stop_loss: 48500
  },
  description: 'Classic head and shoulders pattern indicating potential reversal',
  trading_implication: 'bearish'
};

export const mockWedgePattern: PatternAnalysis = {
  type: 'wedge',
  startTime: 1638360000,
  endTime: 1638489600,
  confidence: 0.78,
  visualization: {
    keyPoints: [
      {
        time: 1638360000,
        value: 47500,
        type: 'trough',
        label: 'Wedge Start'
      },
      {
        time: 1638378000,
        value: 48000,
        type: 'peak',
        label: 'First High'
      },
      {
        time: 1638396000,
        value: 47700,
        type: 'trough',
        label: 'Higher Low'
      },
      {
        time: 1638414000,
        value: 48300,
        type: 'peak',
        label: 'Higher High'
      },
      {
        time: 1638432000,
        value: 47900,
        type: 'trough',
        label: 'Converging Low'
      },
      {
        time: 1638450000,
        value: 48500,
        type: 'peak',
        label: 'Wedge Top'
      },
      {
        time: 1638489600,
        value: 48100,
        type: 'breakout',
        label: 'Wedge End'
      }
    ],
    lines: [
      {
        from: 0,
        to: 6,
        type: 'support'
      },
      {
        from: 1,
        to: 5,
        type: 'resistance'
      }
    ]
  },
  metrics: {
    formation_period: 36,
    symmetry: 0.75,
    volume_pattern: 'decreasing',
    breakout_level: 47400,
    target_level: 46800,
    stop_loss: 48600
  },
  description: 'Rising wedge pattern suggesting potential downward breakout',
  trading_implication: 'bearish'
};

export const mockFlagPattern: PatternAnalysis = {
  type: 'flag',
  startTime: 1638360000,
  endTime: 1638403200,
  confidence: 0.88,
  visualization: {
    keyPoints: [
      {
        time: 1638360000,
        value: 47000,
        type: 'trough',
        label: 'Pole Start'
      },
      {
        time: 1638367200,
        value: 49000,
        type: 'peak',
        label: 'Pole Top'
      },
      {
        time: 1638374400,
        value: 48500,
        type: 'trough',
        label: 'Flag Start'
      },
      {
        time: 1638381600,
        value: 48800,
        type: 'peak',
        label: 'Flag Channel Top'
      },
      {
        time: 1638388800,
        value: 48400,
        type: 'trough',
        label: 'Flag Channel Bottom'
      },
      {
        time: 1638396000,
        value: 48700,
        type: 'peak',
        label: 'Flag End'
      },
      {
        time: 1638403200,
        value: 49500,
        type: 'target',
        label: 'Breakout Target'
      }
    ],
    lines: [
      {
        from: 2,
        to: 4,
        type: 'support'
      },
      {
        from: 3,
        to: 5,
        type: 'resistance'
      }
    ]
  },
  metrics: {
    formation_period: 12,
    symmetry: 0.90,
    volume_pattern: 'decreasing',
    breakout_level: 48900,
    target_level: 50900,
    stop_loss: 48300
  },
  description: 'Bull flag pattern indicating continuation of uptrend',
  trading_implication: 'bullish'
};

export const mockPatternCollection = [
  mockTrianglePattern,
  mockHeadAndShouldersPattern,
  mockWedgePattern,
  mockFlagPattern
];

export const generateRandomPattern = (type: 'ascendingTriangle' | 'headAndShoulders' | 'wedge' | 'flag' = 'ascendingTriangle'): PatternAnalysis => {
  const startTime = Date.now() / 1000 - 86400 * 7; // 7 days ago
  const endTime = Date.now() / 1000;
  
  return {
    type,
    startTime,
    endTime,
    confidence: 0.7 + Math.random() * 0.3,
    visualization: {
      keyPoints: []
    },
    metrics: {
      formation_period: Math.floor(Math.random() * 50 + 10),
      symmetry: 0.5 + Math.random() * 0.5,
      volume_pattern: ['increasing', 'decreasing', 'neutral'][Math.floor(Math.random() * 3)] as 'increasing' | 'decreasing' | 'neutral',
      breakout_level: 48000 + (Math.random() - 0.5) * 2000,
      target_level: 48000 + (Math.random() - 0.5) * 4000,
      stop_loss: 48000 + (Math.random() - 0.5) * 1000
    },
    description: `${type} pattern detected`,
    trading_implication: Math.random() > 0.5 ? 'bullish' : 'bearish'
  };
};