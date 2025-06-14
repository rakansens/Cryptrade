// Jest is configured globally, no imports needed
import type {
  DrawingPoint,
  DrawingStyle,
  DrawingData,
  DrawTrendlineEventDetail,
  SymbolChangeEventDetail,
  TimeframeChangeEventDetail,
  IndicatorToggleEventDetail,
  DrawingAddedEventDetail,
  CustomEventMap
} from '../ui-events.types';
import {
  isDrawingPoint,
  isDrawingData,
  createCustomEvent,
  addEventListener,
  removeEventListener,
  dispatchCustomEvent
} from '../ui-events.types';

describe('ui-events.types', () => {
  describe('isDrawingPoint', () => {
    it('should return true for valid DrawingPoint with time only', () => {
      const validPoint: DrawingPoint = {
        time: Date.now()
      };

      expect(isDrawingPoint(validPoint)).toBe(true);
    });

    it('should return true for DrawingPoint with value', () => {
      const validPoint: DrawingPoint = {
        time: Date.now(),
        value: 100.50
      };

      expect(isDrawingPoint(validPoint)).toBe(true);
    });

    it('should return true for DrawingPoint with price', () => {
      const validPoint: DrawingPoint = {
        time: Date.now(),
        price: 100.50
      };

      expect(isDrawingPoint(validPoint)).toBe(true);
    });

    it('should return true for DrawingPoint with both value and price', () => {
      const validPoint: DrawingPoint = {
        time: Date.now(),
        value: 100.50,
        price: 100.50
      };

      expect(isDrawingPoint(validPoint)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isDrawingPoint(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isDrawingPoint(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isDrawingPoint('string')).toBe(false);
      expect(isDrawingPoint(123)).toBe(false);
      expect(isDrawingPoint(true)).toBe(false);
      expect(isDrawingPoint([])).toBe(false);
    });

    it('should return false for missing time field', () => {
      expect(isDrawingPoint({})).toBe(false);
      expect(isDrawingPoint({ value: 100.50 })).toBe(false);
      expect(isDrawingPoint({ price: 100.50 })).toBe(false);
    });

    it('should return false for wrong field types', () => {
      expect(isDrawingPoint({
        time: '2024-01-01' // should be number
      })).toBe(false);

      expect(isDrawingPoint({
        time: Date.now(),
        value: '100.50' // should be number
      })).toBe(false);

      expect(isDrawingPoint({
        time: Date.now(),
        price: '100.50' // should be number
      })).toBe(false);
    });
  });

  describe('isDrawingData', () => {
    it('should return true for valid DrawingData with points only', () => {
      const validData: DrawingData = {
        points: [
          { time: Date.now(), value: 100 },
          { time: Date.now() + 1000, value: 110 }
        ]
      };

      expect(isDrawingData(validData)).toBe(true);
    });

    it('should return true for DrawingData with all fields', () => {
      const validData: DrawingData = {
        id: 'drawing-1',
        points: [
          { time: Date.now(), value: 100 },
          { time: Date.now() + 1000, value: 110 }
        ],
        style: {
          color: '#ff0000',
          lineWidth: 2,
          lineStyle: 'solid',
          showLabels: true
        },
        metadata: {
          createdBy: 'user',
          patternType: 'trendline'
        }
      };

      expect(isDrawingData(validData)).toBe(true);
    });

    it('should return true for empty points array', () => {
      const validData: DrawingData = {
        points: []
      };

      expect(isDrawingData(validData)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isDrawingData(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isDrawingData(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isDrawingData('string')).toBe(false);
      expect(isDrawingData(123)).toBe(false);
      expect(isDrawingData(true)).toBe(false);
      expect(isDrawingData([])).toBe(false);
    });

    it('should return false for missing points field', () => {
      expect(isDrawingData({})).toBe(false);
      expect(isDrawingData({ id: 'drawing-1' })).toBe(false);
    });

    it('should return false for non-array points', () => {
      expect(isDrawingData({
        points: 'not-an-array'
      })).toBe(false);

      expect(isDrawingData({
        points: {}
      })).toBe(false);
    });

    it('should return false for invalid points in array', () => {
      expect(isDrawingData({
        points: [
          { time: Date.now(), value: 100 },
          { invalid: 'point' } // missing time
        ]
      })).toBe(false);

      expect(isDrawingData({
        points: [
          { time: Date.now(), value: 100 },
          'not-an-object'
        ]
      })).toBe(false);
    });
  });

  describe('Event helper functions', () => {
    let mockListener: ReturnType<typeof jest.fn>;
    let originalWindow: Window & typeof globalThis;

    beforeEach(() => {
      mockListener = jest.fn();
      // Mock window for Node environment
      originalWindow = global.window;
      (global as any).window = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
        CustomEvent: jest.fn((type: string, options?: any) => ({
          type,
          detail: options?.detail
        }))
      };
    });

    afterEach(() => {
      // Clean up any event listeners
      jest.clearAllMocks();
      // Restore original window
      global.window = originalWindow;
    });

    describe('createCustomEvent', () => {
      it('should create symbol:change event', () => {
        const detail: SymbolChangeEventDetail = { symbol: 'BTC/USD' };
        const event = createCustomEvent('symbol:change', detail);

        expect(event).toBeInstanceOf(CustomEvent);
        expect(event.type).toBe('symbol:change');
        expect(event.detail).toEqual(detail);
      });

      it('should create timeframe:change event', () => {
        const detail: TimeframeChangeEventDetail = { timeframe: '1h' };
        const event = createCustomEvent('timeframe:change', detail);

        expect(event).toBeInstanceOf(CustomEvent);
        expect(event.type).toBe('timeframe:change');
        expect(event.detail).toEqual(detail);
      });

      it('should create indicator:toggle event', () => {
        const detail: IndicatorToggleEventDetail = { 
          indicator: 'MACD', 
          enabled: true 
        };
        const event = createCustomEvent('indicator:toggle', detail);

        expect(event).toBeInstanceOf(CustomEvent);
        expect(event.type).toBe('indicator:toggle');
        expect(event.detail).toEqual(detail);
      });

      it('should create draw:trendline event', () => {
        const detail: DrawTrendlineEventDetail = {
          points: [
            { time: Date.now(), value: 100 },
            { time: Date.now() + 1000, value: 110 }
          ]
        };
        const event = createCustomEvent('draw:trendline', detail);

        expect(event).toBeInstanceOf(CustomEvent);
        expect(event.type).toBe('draw:trendline');
        expect(event.detail).toEqual(detail);
      });

      it('should create drawing:added event', () => {
        const detail: DrawingAddedEventDetail = {
          drawing: {
            id: 'drawing-1',
            type: 'trendline',
            points: [
              { time: Date.now(), value: 100 },
              { time: Date.now() + 1000, value: 110 }
            ],
            style: {
              color: '#ff0000',
              lineWidth: 2,
              lineStyle: 'solid',
              showLabels: true
            }
          }
        };
        const event = createCustomEvent('drawing:added', detail);

        expect(event).toBeInstanceOf(CustomEvent);
        expect(event.type).toBe('drawing:added');
        expect(event.detail).toEqual(detail);
      });
    });

    describe('addEventListener and removeEventListener', () => {
      it('should add and trigger event listener', () => {
        addEventListener('symbol:change', mockListener);
        
        expect(window.addEventListener).toHaveBeenCalledWith(
          'symbol:change',
          mockListener,
          undefined
        );

        removeEventListener('symbol:change', mockListener);
        
        expect(window.removeEventListener).toHaveBeenCalledWith(
          'symbol:change',
          mockListener,
          undefined
        );
      });

      it('should remove event listener', () => {
        addEventListener('timeframe:change', mockListener);
        expect(window.addEventListener).toHaveBeenCalledWith(
          'timeframe:change',
          mockListener,
          undefined
        );

        removeEventListener('timeframe:change', mockListener);
        expect(window.removeEventListener).toHaveBeenCalledWith(
          'timeframe:change',
          mockListener,
          undefined
        );
      });

      it('should support event listener options', () => {
        const onceListener = jest.fn();
        addEventListener('indicator:toggle', onceListener, { once: true });

        expect(window.addEventListener).toHaveBeenCalledWith(
          'indicator:toggle',
          onceListener,
          { once: true }
        );
      });
    });

    describe('dispatchCustomEvent', () => {
      it('should dispatch custom events', () => {
        const detail: DrawTrendlineEventDetail = {
          multiple: true,
          drawings: [
            {
              points: [
                { time: Date.now(), value: 100 },
                { time: Date.now() + 1000, value: 110 }
              ]
            }
          ]
        };

        dispatchCustomEvent('draw:trendline', detail);

        expect(window.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'draw:trendline',
            detail
          })
        );
      });
    });
  });

  describe('Interface validation', () => {
    it('should accept valid DrawingStyle', () => {
      const style: DrawingStyle = {
        color: '#ff0000',
        lineWidth: 2,
        lineStyle: 'dashed',
        showLabels: true
      };

      expect(style).toBeDefined();
    });

    it('should accept valid DrawTrendlineEventDetail variations', () => {
      const detail1: DrawTrendlineEventDetail = {
        points: [
          { time: Date.now(), value: 100 },
          { time: Date.now() + 1000, value: 110 }
        ]
      };

      const detail2: DrawTrendlineEventDetail = {
        multiple: true,
        drawings: [
          {
            points: [
              { time: Date.now(), value: 100 },
              { time: Date.now() + 1000, value: 110 }
            ],
            style: {
              color: '#00ff00',
              lineWidth: 3,
              lineStyle: 'solid',
              showLabels: false
            }
          }
        ],
        style: {
          color: '#0000ff',
          lineWidth: 1,
          lineStyle: 'dotted',
          showLabels: true
        }
      };

      expect(detail1).toBeDefined();
      expect(detail2).toBeDefined();
    });
  });
});