import { renderHook, act } from '@testing-library/react';
import { 
  useProposalApprovalStore, 
  useApprovedDrawingIds,
  useDrawingTypes,
  useProposalApprovalActions,
  useProposalApprovalSelectors
} from '@/store/proposal-approval.store';

describe('ProposalApprovalStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useProposalApprovalStore());
    act(() => {
      result.current.clearApprovedDrawings();
    });
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useProposalApprovalStore());
    
    expect(result.current.approvedDrawingIds.size).toBe(0);
    expect(result.current.drawingTypes.size).toBe(0);
  });

  it('should add approved drawing correctly', () => {
    const { result } = renderHook(() => useProposalApprovalStore());
    
    act(() => {
      result.current.addApprovedDrawing('message-1', 'proposal-1', 'drawing-1', 'pattern');
    });

    expect(result.current.isDrawingApproved('message-1', 'proposal-1')).toBe(true);
    expect(result.current.getApprovedDrawingId('message-1', 'proposal-1')).toBe('drawing-1');
    expect(result.current.getDrawingType('drawing-1')).toBe('pattern');
  });

  it('should handle multiple drawings for same message', () => {
    const { result } = renderHook(() => useProposalApprovalStore());
    
    act(() => {
      result.current.addApprovedDrawing('message-1', 'proposal-1', 'drawing-1', 'pattern');
      result.current.addApprovedDrawing('message-1', 'proposal-2', 'drawing-2', 'drawing');
    });

    expect(result.current.isDrawingApproved('message-1', 'proposal-1')).toBe(true);
    expect(result.current.isDrawingApproved('message-1', 'proposal-2')).toBe(true);
    expect(result.current.getDrawingType('drawing-1')).toBe('pattern');
    expect(result.current.getDrawingType('drawing-2')).toBe('drawing');
  });

  it('should handle multiple messages with drawings', () => {
    const { result } = renderHook(() => useProposalApprovalStore());
    
    act(() => {
      result.current.addApprovedDrawing('message-1', 'proposal-1', 'drawing-1', 'pattern');
      result.current.addApprovedDrawing('message-2', 'proposal-1', 'drawing-2', 'drawing');
    });

    expect(result.current.isDrawingApproved('message-1', 'proposal-1')).toBe(true);
    expect(result.current.isDrawingApproved('message-2', 'proposal-1')).toBe(true);
    expect(result.current.isDrawingApproved('message-1', 'proposal-2')).toBe(false);
  });

  it('should remove approved drawing correctly', () => {
    const { result } = renderHook(() => useProposalApprovalStore());
    
    act(() => {
      result.current.addApprovedDrawing('message-1', 'proposal-1', 'drawing-1', 'pattern');
      result.current.addApprovedDrawing('message-1', 'proposal-2', 'drawing-2', 'drawing');
    });

    act(() => {
      result.current.removeApprovedDrawing('drawing-1');
    });

    expect(result.current.isDrawingApproved('message-1', 'proposal-1')).toBe(false);
    expect(result.current.isDrawingApproved('message-1', 'proposal-2')).toBe(true);
    expect(result.current.getDrawingType('drawing-1')).toBeUndefined();
    expect(result.current.getDrawingType('drawing-2')).toBe('drawing');
  });

  it('should clear all approved drawings', () => {
    const { result } = renderHook(() => useProposalApprovalStore());
    
    act(() => {
      result.current.addApprovedDrawing('message-1', 'proposal-1', 'drawing-1', 'pattern');
      result.current.addApprovedDrawing('message-2', 'proposal-2', 'drawing-2', 'drawing');
    });

    act(() => {
      result.current.clearApprovedDrawings();
    });

    expect(result.current.approvedDrawingIds.size).toBe(0);
    expect(result.current.drawingTypes.size).toBe(0);
    expect(result.current.isDrawingApproved('message-1', 'proposal-1')).toBe(false);
    expect(result.current.getDrawingType('drawing-1')).toBeUndefined();
  });

  describe('Selector hooks', () => {
    it('should provide approved drawing IDs through selector', () => {
      const storeHook = renderHook(() => useProposalApprovalStore());
      const selectorHook = renderHook(() => useApprovedDrawingIds());
      
      act(() => {
        storeHook.result.current.addApprovedDrawing('message-1', 'proposal-1', 'drawing-1', 'pattern');
      });

      expect(selectorHook.result.current.get('message-1')?.get('proposal-1')).toBe('drawing-1');
    });

    it('should provide drawing types through selector', () => {
      const storeHook = renderHook(() => useProposalApprovalStore());
      const selectorHook = renderHook(() => useDrawingTypes());
      
      act(() => {
        storeHook.result.current.addApprovedDrawing('message-1', 'proposal-1', 'drawing-1', 'pattern');
      });

      expect(selectorHook.result.current.get('drawing-1')).toBe('pattern');
    });

    it('should provide actions through selector', () => {
      const actionsHook = renderHook(() => useProposalApprovalActions());
      
      expect(actionsHook.result.current).toEqual({
        addApprovedDrawing: expect.any(Function),
        removeApprovedDrawing: expect.any(Function),
        clearApprovedDrawings: expect.any(Function),
      });
    });

    it('should provide selectors through selector hook', () => {
      const selectorsHook = renderHook(() => useProposalApprovalSelectors());
      
      expect(selectorsHook.result.current).toEqual({
        getDrawingType: expect.any(Function),
        isDrawingApproved: expect.any(Function),
        getApprovedDrawingId: expect.any(Function),
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle non-existent message queries', () => {
      const { result } = renderHook(() => useProposalApprovalStore());
      
      expect(result.current.isDrawingApproved('non-existent', 'proposal-1')).toBe(false);
      expect(result.current.getApprovedDrawingId('non-existent', 'proposal-1')).toBeUndefined();
    });

    it('should handle non-existent proposal queries', () => {
      const { result } = renderHook(() => useProposalApprovalStore());
      
      act(() => {
        result.current.addApprovedDrawing('message-1', 'proposal-1', 'drawing-1', 'pattern');
      });

      expect(result.current.isDrawingApproved('message-1', 'non-existent')).toBe(false);
      expect(result.current.getApprovedDrawingId('message-1', 'non-existent')).toBeUndefined();
    });

    it('should handle removing non-existent drawing', () => {
      const { result } = renderHook(() => useProposalApprovalStore());
      
      act(() => {
        result.current.addApprovedDrawing('message-1', 'proposal-1', 'drawing-1', 'pattern');
      });

      act(() => {
        result.current.removeApprovedDrawing('non-existent');
      });

      expect(result.current.isDrawingApproved('message-1', 'proposal-1')).toBe(true);
      expect(result.current.getDrawingType('drawing-1')).toBe('pattern');
    });
  });
});