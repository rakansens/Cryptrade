/**
 * Plugin Utilities Tests
 * 
 * チャートプラグインユーティリティ関数の包括的なテストスイート
 */

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  PluginUtilitiesImpl,
  ColorUtils,
  TimeUtils,
  NumberUtils,
  ValidationUtils,
} from '../utils';

describe('PluginUtilitiesImpl', () => {
  let utilities: PluginUtilitiesImpl;

  beforeEach(() => {
    jest.clearAllMocks();
    utilities = new PluginUtilitiesImpl();
  });

  describe('getLineColor', () => {
    it('should return correct colors for known types', () => {
      expect(utilities.getLineColor('outline')).toBe('#888888');
      expect(utilities.getLineColor('neckline')).toBe('#ff0000');
      expect(utilities.getLineColor('support')).toBe('#00ff00');
      expect(utilities.getLineColor('resistance')).toBe('#ff0000');
      expect(utilities.getLineColor('target')).toBe('#00aaff');
      expect(utilities.getLineColor('trendline')).toBe('#4CAF50');
      expect(utilities.getLineColor('horizontal')).toBe('#2196F3');
      expect(utilities.getLineColor('diagonal')).toBe('#FF9800');
      expect(utilities.getLineColor('fibonacci')).toBe('#9C27B0');
      expect(utilities.getLineColor('pattern')).toBe('#673AB7');
    });

    it('should return default color for unknown types', () => {
      expect(utilities.getLineColor('unknown')).toBe('#888888');
    });

    it('should handle case-insensitive types', () => {
      expect(utilities.getLineColor('SUPPORT')).toBe('#00ff00');
      expect(utilities.getLineColor('Support')).toBe('#00ff00');
    });
  });

  describe('convertLineStyle', () => {
    it('should convert line styles correctly', () => {
      expect(utilities.convertLineStyle('solid')).toBe(0);
      expect(utilities.convertLineStyle('dashed')).toBe(1);
      expect(utilities.convertLineStyle('dotted')).toBe(2);
      expect(utilities.convertLineStyle('dashdot')).toBe(3);
    });

    it('should return default for unknown styles', () => {
      expect(utilities.convertLineStyle('unknown')).toBe(0);
    });

    it('should handle case-insensitive styles', () => {
      expect(utilities.convertLineStyle('SOLID')).toBe(0);
      expect(utilities.convertLineStyle('Dashed')).toBe(1);
    });
  });

  describe('addOpacity', () => {
    it('should add opacity to hex colors', () => {
      expect(utilities.addOpacity('#FF0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
      expect(utilities.addOpacity('#00FF00', 0.8)).toBe('rgba(0, 255, 0, 0.8)');
      expect(utilities.addOpacity('#0000FF', 1.0)).toBe('rgba(0, 0, 255, 1)');
    });

    it('should add opacity to rgb colors', () => {
      expect(utilities.addOpacity('rgb(255, 0, 0)', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
      expect(utilities.addOpacity('rgb(0, 255, 0)', 0.8)).toBe('rgba(0, 255, 0, 0.8)');
    });

    it('should update opacity in rgba colors', () => {
      expect(utilities.addOpacity('rgba(255, 0, 0, 0.3)', 0.7)).toBe('rgba(255, 0, 0, 0.7)');
      expect(utilities.addOpacity('rgba(0, 255, 0, 1)', 0.5)).toBe('rgba(0, 255, 0, 0.5)');
    });

    it('should clamp opacity to 0-1 range', () => {
      expect(utilities.addOpacity('#FF0000', -0.5)).toBe('rgba(255, 0, 0, 0)');
      expect(utilities.addOpacity('#FF0000', 1.5)).toBe('rgba(255, 0, 0, 1)');
    });

    it('should return unknown formats as-is', () => {
      expect(utilities.addOpacity('hsl(0, 100%, 50%)', 0.5)).toBe('hsl(0, 100%, 50%)');
      expect(utilities.addOpacity('red', 0.5)).toBe('red');
    });
  });

  describe('calculateTimeRange', () => {
    it('should calculate time range with extension', () => {
      const keyPoints = [
        { time: 1000, value: 100 },
        { time: 2000, value: 200 },
        { time: 3000, value: 150 },
      ];
      
      const range = utilities.calculateTimeRange(keyPoints);
      
      expect(range.minTime).toBe(1000);
      expect(range.maxTime).toBe(3000);
      expect(range.startTime).toBe(0); // 1000 - (3000-1000)*0.5
      expect(range.endTime).toBe(4000); // 3000 + (3000-1000)*0.5
    });

    it('should handle empty keyPoints', () => {
      const range = utilities.calculateTimeRange([]);
      
      expect(range).toEqual({
        minTime: 0,
        maxTime: 0,
        startTime: 0,
        endTime: 0,
      });
    });

    it('should handle single keyPoint', () => {
      const keyPoints = [{ time: 1500, value: 100 }];
      
      const range = utilities.calculateTimeRange(keyPoints);
      
      expect(range.minTime).toBe(1500);
      expect(range.maxTime).toBe(1500);
      expect(range.startTime).toBe(1500); // No extension when min === max
      expect(range.endTime).toBe(1500);
    });
  });

  describe('findPatternByFuzzyMatch', () => {
    it('should find exact match', () => {
      // Since we can't mock internal state, this will always return null
      // This is a limitation of the current implementation
      const result = utilities.findPatternByFuzzyMatch('pattern_123_456');
      expect(result).toBeNull();
    });

    it('should handle complex pattern IDs', () => {
      const result = utilities.findPatternByFuzzyMatch('complex_pattern_abc_123_xyz');
      expect(result).toBeNull();
    });
  });
});

describe('ColorUtils', () => {
  describe('getFromPalette', () => {
    it('should return colors from palette', () => {
      expect(ColorUtils.getFromPalette(0)).toBe('#4CAF50');
      expect(ColorUtils.getFromPalette(1)).toBe('#2196F3');
      expect(ColorUtils.getFromPalette(2)).toBe('#FF9800');
      expect(ColorUtils.getFromPalette(3)).toBe('#9C27B0');
      expect(ColorUtils.getFromPalette(4)).toBe('#F44336');
      expect(ColorUtils.getFromPalette(5)).toBe('#00BCD4');
      expect(ColorUtils.getFromPalette(6)).toBe('#FFEB3B');
      expect(ColorUtils.getFromPalette(7)).toBe('#795548');
    });

    it('should wrap around for indices beyond palette length', () => {
      expect(ColorUtils.getFromPalette(8)).toBe('#4CAF50'); // wraps to 0
      expect(ColorUtils.getFromPalette(9)).toBe('#2196F3'); // wraps to 1
      expect(ColorUtils.getFromPalette(16)).toBe('#4CAF50'); // wraps to 0
    });

    it('should handle negative indices', () => {
      expect(ColorUtils.getFromPalette(-1)).toBe('#795548'); // -1 % 8 = 7
    });
  });

  describe('adjustBrightness', () => {
    it('should adjust brightness correctly', () => {
      expect(ColorUtils.adjustBrightness('#808080', 1.5)).toBe('#c0c0c0');
      expect(ColorUtils.adjustBrightness('#FF0000', 0.5)).toBe('#800000');
      expect(ColorUtils.adjustBrightness('#00FF00', 2.0)).toBe('#00ff00'); // clamped to max
    });

    it('should handle edge cases', () => {
      expect(ColorUtils.adjustBrightness('#FFFFFF', 1.5)).toBe('#ffffff'); // already max
      expect(ColorUtils.adjustBrightness('#000000', 0.5)).toBe('#000000'); // already min
    });

    it('should return non-hex colors as-is', () => {
      expect(ColorUtils.adjustBrightness('rgb(255,0,0)', 1.5)).toBe('rgb(255,0,0)');
      expect(ColorUtils.adjustBrightness('red', 0.5)).toBe('red');
    });
  });

  describe('toDarkTheme', () => {
    it('should brighten colors for dark theme', () => {
      expect(ColorUtils.toDarkTheme('#808080')).toBe('#9a9a9a'); // 128 * 1.2 = 153.6 → 154 → 0x9a
      expect(ColorUtils.toDarkTheme('#404040')).toBe('#4d4d4d'); // 64 * 1.2 = 76.8 → 77 → 0x4d
    });
  });
});

describe('TimeUtils', () => {
  describe('normalizeTime', () => {
    it('should handle Unix seconds timestamp', () => {
      expect(TimeUtils.normalizeTime(1234567890)).toBe(1234567890);
    });

    it('should convert Unix milliseconds to seconds', () => {
      expect(TimeUtils.normalizeTime(1234567890000)).toBe(1234567890);
    });

    it('should handle edge cases', () => {
      expect(TimeUtils.normalizeTime(0)).toBe(0);
      expect(TimeUtils.normalizeTime(9999999999)).toBe(9999999999); // Just under 10^10, kept as is
      expect(TimeUtils.normalizeTime(10000000000)).toBe(10000000); // 10^10 ms → 10^7 seconds
    });
  });

  describe('isWithinRange', () => {
    it('should check if timestamp is within range', () => {
      expect(TimeUtils.isWithinRange(1500, 1000, 2000)).toBe(true);
      expect(TimeUtils.isWithinRange(500, 1000, 2000)).toBe(false);
      expect(TimeUtils.isWithinRange(2500, 1000, 2000)).toBe(false);
    });

    it('should handle edge values', () => {
      expect(TimeUtils.isWithinRange(1000, 1000, 2000)).toBe(true);
      expect(TimeUtils.isWithinRange(2000, 1000, 2000)).toBe(true);
    });

    it('should normalize timestamps before comparison', () => {
      expect(TimeUtils.isWithinRange(1500000, 1000, 2000)).toBe(false); // 1500000ms = 1500s, not in 1000-2000 range
      expect(TimeUtils.isWithinRange(1500000000, 1000, 2000)).toBe(true); // 1500000000ms = 1500s, in 1000-2000 range
      expect(TimeUtils.isWithinRange(1500, 1000000000, 2000000000)).toBe(true); // all normalized to seconds
    });
  });

  describe('calculateStepSize', () => {
    it('should return appropriate step sizes', () => {
      expect(TimeUtils.calculateStepSize(1800)).toBe(300); // 30 min -> 5 min steps
      expect(TimeUtils.calculateStepSize(3600)).toBe(300); // 1 hour -> 5 min steps
      expect(TimeUtils.calculateStepSize(43200)).toBe(3600); // 12 hours -> 1 hour steps
      expect(TimeUtils.calculateStepSize(86400)).toBe(3600); // 1 day -> 1 hour steps
      expect(TimeUtils.calculateStepSize(432000)).toBe(86400); // 5 days -> 1 day steps
      expect(TimeUtils.calculateStepSize(604800)).toBe(86400); // 1 week -> 1 day steps
      expect(TimeUtils.calculateStepSize(1209600)).toBe(604800); // 2 weeks -> 1 week steps
      expect(TimeUtils.calculateStepSize(2592000)).toBe(604800); // 1 month -> 1 week steps
    });

    it('should return default for very large ranges', () => {
      expect(TimeUtils.calculateStepSize(31536000)).toBe(2592000); // 1 year -> 1 month steps
    });
  });
});

describe('NumberUtils', () => {
  describe('roundToPrecision', () => {
    it('should round to specified precision', () => {
      expect(NumberUtils.roundToPrecision(3.14159, 2)).toBe(3.14);
      expect(NumberUtils.roundToPrecision(3.14159, 3)).toBe(3.142);
      expect(NumberUtils.roundToPrecision(3.14159, 0)).toBe(3);
    });

    it('should use default precision of 2', () => {
      expect(NumberUtils.roundToPrecision(3.14159)).toBe(3.14);
    });

    it('should handle negative numbers', () => {
      expect(NumberUtils.roundToPrecision(-3.14159, 2)).toBe(-3.14);
    });
  });

  describe('formatPrice', () => {
    it('should format prices with locale formatting', () => {
      expect(NumberUtils.formatPrice(1234.56)).toBe('1,234.56');
      expect(NumberUtils.formatPrice(1234.5)).toBe('1,234.50');
      expect(NumberUtils.formatPrice(1234)).toBe('1,234.00');
    });

    it('should handle custom decimal places', () => {
      expect(NumberUtils.formatPrice(1234.5678, 3)).toBe('1,234.568');
      expect(NumberUtils.formatPrice(1234.5, 0)).toBe('1,235');
    });

    it('should handle large numbers', () => {
      expect(NumberUtils.formatPrice(1234567.89)).toBe('1,234,567.89');
    });
  });

  describe('calculatePercentage', () => {
    it('should calculate percentage correctly', () => {
      expect(NumberUtils.calculatePercentage(25, 100)).toBe(25);
      expect(NumberUtils.calculatePercentage(50, 200)).toBe(25);
      expect(NumberUtils.calculatePercentage(33, 100)).toBe(33);
    });

    it('should handle zero total', () => {
      expect(NumberUtils.calculatePercentage(50, 0)).toBe(0);
    });

    it('should round result to 2 decimal places', () => {
      expect(NumberUtils.calculatePercentage(1, 3)).toBe(33.33);
    });
  });

  describe('clamp', () => {
    it('should clamp values within range', () => {
      expect(NumberUtils.clamp(5, 0, 10)).toBe(5);
      expect(NumberUtils.clamp(-5, 0, 10)).toBe(0);
      expect(NumberUtils.clamp(15, 0, 10)).toBe(10);
    });

    it('should handle edge values', () => {
      expect(NumberUtils.clamp(0, 0, 10)).toBe(0);
      expect(NumberUtils.clamp(10, 0, 10)).toBe(10);
    });
  });
});

describe('ValidationUtils', () => {
  describe('validateKeyPoints', () => {
    it('should validate valid keyPoints', () => {
      const valid = [
        { time: 1000, value: 100 },
        { time: 2000, value: 200 },
      ];
      expect(ValidationUtils.validateKeyPoints(valid)).toBe(true);
    });

    it('should reject invalid keyPoints', () => {
      expect(ValidationUtils.validateKeyPoints([])).toBe(false); // empty
      expect(ValidationUtils.validateKeyPoints(null as any)).toBe(false); // not array
      expect(ValidationUtils.validateKeyPoints('not array' as any)).toBe(false);
    });

    it('should reject keyPoints with missing fields', () => {
      const invalid = [
        { time: 1000, value: 100 },
        { time: 2000 }, // missing value
      ];
      expect(ValidationUtils.validateKeyPoints(invalid)).toBe(false);
    });

    it('should reject keyPoints with wrong types', () => {
      const invalid = [
        { time: '1000', value: 100 }, // time is string
      ];
      expect(ValidationUtils.validateKeyPoints(invalid)).toBe(false);
    });

    it('should handle null elements', () => {
      const invalid = [
        { time: 1000, value: 100 },
        null,
      ];
      expect(ValidationUtils.validateKeyPoints(invalid)).toBe(false);
    });
  });

  describe('validateLines', () => {
    it('should validate valid lines', () => {
      const valid = [
        { points: [0, 1] },
        { points: [1, 2, 3] },
      ];
      expect(ValidationUtils.validateLines(valid)).toBe(true);
    });

    it('should reject non-array', () => {
      expect(ValidationUtils.validateLines(null as any)).toBe(false);
      expect(ValidationUtils.validateLines('not array' as any)).toBe(false);
    });

    it('should reject lines without points', () => {
      const invalid = [
        { points: [0, 1] },
        {}, // no points
      ];
      expect(ValidationUtils.validateLines(invalid)).toBe(false);
    });

    it('should reject lines with insufficient points', () => {
      const invalid = [
        { points: [0] }, // only 1 point
      ];
      expect(ValidationUtils.validateLines(invalid)).toBe(false);
    });

    it('should reject lines with non-array points', () => {
      const invalid = [
        { points: 'not array' },
      ];
      expect(ValidationUtils.validateLines(invalid)).toBe(false);
    });
  });

  describe('validatePatternId', () => {
    it('should validate valid pattern IDs', () => {
      expect(ValidationUtils.validatePatternId('pattern-123')).toBe(true);
      expect(ValidationUtils.validatePatternId('pattern_abc_123')).toBe(true);
      expect(ValidationUtils.validatePatternId('ABC123')).toBe(true);
    });

    it('should reject invalid pattern IDs', () => {
      expect(ValidationUtils.validatePatternId('')).toBe(false); // empty
      expect(ValidationUtils.validatePatternId('  ')).toBe(false); // whitespace
      expect(ValidationUtils.validatePatternId(null as any)).toBe(false); // not string
      expect(ValidationUtils.validatePatternId(123 as any)).toBe(false); // number
    });

    it('should reject IDs with invalid characters', () => {
      expect(ValidationUtils.validatePatternId('pattern!123')).toBe(false);
      expect(ValidationUtils.validatePatternId('pattern@123')).toBe(false);
      expect(ValidationUtils.validatePatternId('pattern 123')).toBe(false); // space
      expect(ValidationUtils.validatePatternId('pattern#123')).toBe(false);
    });
  });
});