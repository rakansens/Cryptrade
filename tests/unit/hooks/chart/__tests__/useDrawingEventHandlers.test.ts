/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useDrawingEventHandlers } from '@/hooks/chart/useDrawingEventHandlers';
import { useDrawingStore } from '@/store/chart';
import type { ChartDrawing, Time } from '@/types/chart.types';

describe('useDrawingEventHandlers - undo/redo last drawing', () => {
  const createDrawing = (id: string): ChartDrawing => ({
    id,
    type: 'horizontal',
    points: [{ time: 1 as Time, value: 1 }],
    style: { color: '#fff', lineWidth: 1, lineStyle: 'solid', showLabels: false },
    visible: true,
    interactive: true,
  });

  beforeEach(() => {
    // Clear the store by setting to initial state
    useDrawingStore.setState({
      drawings: [],
      selectedDrawingId: null,
      drawingMode: null,
      isDrawing: false,
      undoStack: [],
      redoStack: []
    });
  });

  it('handles undo and redo of the last drawing using stacks', () => {
    const store = useDrawingStore.getState();

    act(() => {
      store.addDrawing(createDrawing('d1'));
      store.addDrawing(createDrawing('d2'));
    });

    expect(useDrawingStore.getState().drawings).toHaveLength(2);

    renderHook(() => useDrawingEventHandlers({} as any));

    act(() => {
      window.dispatchEvent(new CustomEvent('chart:undoLastDrawing', { detail: {} }));
    });

    const afterUndo = useDrawingStore.getState();
    expect(afterUndo.drawings).toHaveLength(1);
    expect(afterUndo.undoStack).toHaveLength(3);
    expect(afterUndo.redoStack).toHaveLength(0);

    act(() => {
      window.dispatchEvent(new CustomEvent('chart:redoLastDrawing', { detail: {} }));
    });

    const afterRedo = useDrawingStore.getState();
    expect(afterRedo.drawings).toHaveLength(2);
    expect(afterRedo.undoStack).toHaveLength(2);
    expect(afterRedo.redoStack).toHaveLength(0);
  });
});
