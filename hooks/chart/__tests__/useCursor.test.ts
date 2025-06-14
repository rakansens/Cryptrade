import { renderHook, act } from '@testing-library/react';
import { useCursor } from '../useCursor';

describe('useCursor', () => {
  // Save original body style
  let originalBodyStyle: CSSStyleDeclaration;

  beforeEach(() => {
    // Mock document.body.style
    originalBodyStyle = document.body.style;
    Object.defineProperty(document.body, 'style', {
      value: { cursor: '' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original
    Object.defineProperty(document.body, 'style', {
      value: originalBodyStyle,
      writable: true,
      configurable: true,
    });
  });

  describe('setCursor', () => {
    it('should set cursor type on document body', () => {
      const { result } = renderHook(() => useCursor());

      act(() => {
        result.current.setCursor('crosshair');
      });

      expect(document.body.style.cursor).toBe('crosshair');
    });

    it('should handle all cursor types', () => {
      const { result } = renderHook(() => useCursor());
      const cursorTypes = ['default', 'crosshair', 'pointer', 'grab', 'grabbing', 'move', 'not-allowed'] as const;

      cursorTypes.forEach(cursorType => {
        act(() => {
          result.current.setCursor(cursorType);
        });
        expect(document.body.style.cursor).toBe(cursorType);
      });
    });

    it('should not throw in SSR environment', () => {
      // Temporarily remove window
      const originalWindow = global.window;
      delete (global as typeof globalThis & { window?: Window }).window;

      const { result } = renderHook(() => useCursor());

      // Should not throw
      expect(() => {
        act(() => {
          result.current.setCursor('pointer');
        });
      }).not.toThrow();

      // Restore window
      (global as typeof globalThis & { window?: Window }).window = originalWindow;
    });
  });

  describe('resetCursor', () => {
    it('should reset cursor to default', () => {
      const { result } = renderHook(() => useCursor());

      // Set to something else first
      act(() => {
        result.current.setCursor('pointer');
      });
      expect(document.body.style.cursor).toBe('pointer');

      // Reset
      act(() => {
        result.current.resetCursor();
      });
      expect(document.body.style.cursor).toBe('default');
    });
  });

  describe('setDrawingCursor', () => {
    it('should set cursor to crosshair', () => {
      const { result } = renderHook(() => useCursor());

      act(() => {
        result.current.setDrawingCursor();
      });

      expect(document.body.style.cursor).toBe('crosshair');
    });
  });

  describe('setPointerCursor', () => {
    it('should set cursor to pointer', () => {
      const { result } = renderHook(() => useCursor());

      act(() => {
        result.current.setPointerCursor();
      });

      expect(document.body.style.cursor).toBe('pointer');
    });
  });

  describe('memoization', () => {
    it('should memoize cursor functions', () => {
      const { result, rerender } = renderHook(() => useCursor());

      const firstSetCursor = result.current.setCursor;
      const firstResetCursor = result.current.resetCursor;
      const firstSetDrawingCursor = result.current.setDrawingCursor;
      const firstSetPointerCursor = result.current.setPointerCursor;

      rerender();

      expect(result.current.setCursor).toBe(firstSetCursor);
      expect(result.current.resetCursor).toBe(firstResetCursor);
      expect(result.current.setDrawingCursor).toBe(firstSetDrawingCursor);
      expect(result.current.setPointerCursor).toBe(firstSetPointerCursor);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined document gracefully', () => {
      const originalDocument = global.document;
      delete (global as typeof globalThis & { document?: Document }).document;

      const { result } = renderHook(() => useCursor());

      // Should not throw
      expect(() => {
        act(() => {
          result.current.setCursor('pointer');
        });
      }).not.toThrow();

      // Restore document
      (global as typeof globalThis & { document?: Document }).document = originalDocument;
    });

    it('should handle missing body element', () => {
      const originalBody = document.body;
      Object.defineProperty(document, 'body', {
        value: null,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useCursor());

      // Should not throw
      expect(() => {
        act(() => {
          result.current.setCursor('pointer');
        });
      }).not.toThrow();

      // Restore body
      Object.defineProperty(document, 'body', {
        value: originalBody,
        writable: true,
        configurable: true,
      });
    });
  });
});