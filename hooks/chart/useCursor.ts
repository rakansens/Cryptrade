import { useCallback } from 'react';

/**
 * Cursor Management Hook
 * 
 * DOM直接操作のカーソル変更をフック化
 */

export type CursorType = 'default' | 'crosshair' | 'pointer' | 'grab' | 'grabbing' | 'move' | 'not-allowed';

export function useCursor() {
  const setCursor = useCallback((cursorType: CursorType) => {
    if (typeof window !== 'undefined') {
      document.body.style.cursor = cursorType;
    }
  }, []);

  const resetCursor = useCallback(() => {
    setCursor('default');
  }, [setCursor]);

  const setDrawingCursor = useCallback(() => {
    setCursor('crosshair');
  }, [setCursor]);

  const setPointerCursor = useCallback(() => {
    setCursor('pointer');
  }, [setCursor]);

  return {
    setCursor,
    resetCursor,
    setDrawingCursor,
    setPointerCursor,
  };
}