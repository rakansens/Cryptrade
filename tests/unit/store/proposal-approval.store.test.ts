/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { 
  useProposalApprovalStore, 
  useApprovedDrawingIds,
  useDrawingTypes,
  useAddApprovedDrawing,
  useRemoveApprovedDrawing,
  useClearApprovedDrawings,
  useGetDrawingType,
  useIsDrawingApproved,
  useGetApprovedDrawingId,
  useProposalApprovalActions,
  useProposalApprovalSelectors
} from '@/store/proposal-approval.store';

// Import JSDOM setup for this test
require('@/tests/setup/jsdom-environment');

import { resetAllStores } from '@/tests/setup/reset-stores';

describe('ProposalApprovalStore', () => {
  // Helper to get initial state
  const getInitialState = (store) => {
    const state = store.getState();
    const initialState = {};
    for (const key in state) {
      if (typeof state[key] !== 'function') {
        initialState[key] = state[key];
      }
    }
    return initialState;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetAllStores();
  });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with empty maps', () => {
      const { result } = renderHook(() => useProposalApprovalStore());
      
      expect(result.current.approvedDrawingIds.size).toBe(0);
      expect(result.current.drawingTypes.size).toBe(0);
    });
  });

  describe('Adding Approved Drawings', () => {
    it('should add an approved drawing', () => {
      const { result } = renderHook(() => useProposalApprovalStore());
      
      act(() => {
        result.current.addApprovedDrawing('msg1', 'prop1', 'draw1', 'pattern');
      });

      expect(result.current.approvedDrawingIds.get('msg1')?.get('prop1')).toBe('draw1');
      expect(result.current.drawingTypes.get('draw1')).toBe('pattern');
    });

    it('should add multiple drawings for different messages', () => {
      const { result } = renderHook(() => useProposalApprovalStore());
      
      act(() => {
        result.current.addApprovedDrawing('msg1', 'prop1', 'draw1', 'pattern');
        result.current.addApprovedDrawing('msg2', 'prop2', 'draw2', 'drawing');
      });

      expect(result.current.approvedDrawingIds.size).toBe(2);
      expect(result.current.approvedDrawingIds.get('msg1')?.get('prop1')).toBe('draw1');
      expect(result.current.approvedDrawingIds.get('msg2')?.get('prop2')).toBe('draw2');
      expect(result.current.drawingTypes.size).toBe(2);
    });

    it('should add multiple proposals for the same message', () => {
      const { result } = renderHook(() => useProposalApprovalStore());
      
      act(() => {
        result.current.addApprovedDrawing('msg1', 'prop1', 'draw1', 'pattern');
        result.current.addApprovedDrawing('msg1', 'prop2', 'draw2', 'drawing');
      });

      const messageDrawings = result.current.approvedDrawingIds.get('msg1');
      expect(messageDrawings?.size).toBe(2);
      expect(messageDrawings?.get('prop1')).toBe('draw1');
      expect(messageDrawings?.get('prop2')).toBe('draw2');
    });

    it('should override existing drawing for same message and proposal', () => {
      const { result } = renderHook(() => useProposalApprovalStore());
      
      act(() => {
        result.current.addApprovedDrawing('msg1', 'prop1', 'draw1', 'pattern');
        result.current.addApprovedDrawing('msg1', 'prop1', 'draw2', 'drawing');
      });

      expect(result.current.approvedDrawingIds.get('msg1')?.get('prop1')).toBe('draw2');
      expect(result.current.drawingTypes.get('draw2')).toBe('drawing');
      expect(result.current.drawingTypes.has('draw1')).toBe(true); // Old drawing type still exists
    });
  });

  describe('Removing Approved Drawings', () => {
    it('should remove an approved drawing', () => {
      const { result } = renderHook(() => useProposalApprovalStore());
      
      act(() => {
        result.current.addApprovedDrawing('msg1', 'prop1', 'draw1', 'pattern');
        result.current.removeApprovedDrawing('draw1');
      });

      expect(result.current.approvedDrawingIds.get('msg1')?.has('prop1')).toBe(false);
      expect(result.current.drawingTypes.has('draw1')).toBe(false);
    });

    it('should remove drawing from all messages', () => {
      const { result } = renderHook(() => useProposalApprovalStore());
      
      act(() => {
        result.current.addApprovedDrawing('msg1', 'prop1', 'draw1', 'pattern');
        result.current.addApprovedDrawing('msg2', 'prop2', 'draw1', 'pattern');
        result.current.removeApprovedDrawing('draw1');
      });

      expect(result.current.approvedDrawingIds.get('msg1')?.has('prop1')).toBe(false);
      expect(result.current.approvedDrawingIds.get('msg2')?.has('prop2')).toBe(false);
      expect(result.current.drawingTypes.has('draw1')).toBe(false);
    });

    it('should not affect other drawings when removing one', () => {
      const { result } = renderHook(() => useProposalApprovalStore());
      
      act(() => {
        result.current.addApprovedDrawing('msg1', 'prop1', 'draw1', 'pattern');
        result.current.addApprovedDrawing('msg1', 'prop2', 'draw2', 'drawing');
        result.current.removeApprovedDrawing('draw1');
      });

      expect(result.current.approvedDrawingIds.get('msg1')?.has('prop1')).toBe(false);
      expect(result.current.approvedDrawingIds.get('msg1')?.get('prop2')).toBe('draw2');
      expect(result.current.drawingTypes.get('draw2')).toBe('drawing');
    });

    it('should handle removing non-existent drawing gracefully', () => {
      const { result } = renderHook(() => useProposalApprovalStore());
      
      act(() => {
        result.current.removeApprovedDrawing('non-existent');
      });

      expect(result.current.approvedDrawingIds.size).toBe(0);
      expect(result.current.drawingTypes.size).toBe(0);
    });
  });

  describe('Clear and Reset', () => {
    it('should clear all approved drawings', () => {
      const { result } = renderHook(() => useProposalApprovalStore());
      
      act(() => {
        result.current.addApprovedDrawing('msg1', 'prop1', 'draw1', 'pattern');
        result.current.addApprovedDrawing('msg2', 'prop2', 'draw2', 'drawing');
        result.current.clearApprovedDrawings();
      });

      expect(result.current.approvedDrawingIds.size).toBe(0);
      expect(result.current.drawingTypes.size).toBe(0);
    });

    it('should reset to initial state', () => {
      const { result } = renderHook(() => useProposalApprovalStore());
      
      act(() => {
        result.current.addApprovedDrawing('msg1', 'prop1', 'draw1', 'pattern');
        result.current.reset();
      });

      expect(result.current.approvedDrawingIds.size).toBe(0);
      expect(result.current.drawingTypes.size).toBe(0);
    });
  });

  describe('Selectors', () => {
    it('should get drawing type', () => {
      const { result } = renderHook(() => useProposalApprovalStore());
      
      act(() => {
        result.current.addApprovedDrawing('msg1', 'prop1', 'draw1', 'pattern');
      });

      expect(result.current.getDrawingType('draw1')).toBe('pattern');
      expect(result.current.getDrawingType('non-existent')).toBeUndefined();
    });

    it('should check if drawing is approved', () => {
      const { result } = renderHook(() => useProposalApprovalStore());
      
      act(() => {
        result.current.addApprovedDrawing('msg1', 'prop1', 'draw1', 'pattern');
      });

      expect(result.current.isDrawingApproved('msg1', 'prop1')).toBe(true);
      expect(result.current.isDrawingApproved('msg1', 'prop2')).toBe(false);
      expect(result.current.isDrawingApproved('msg2', 'prop1')).toBe(false);
    });

    it('should get approved drawing ID', () => {
      const { result } = renderHook(() => useProposalApprovalStore());
      
      act(() => {
        result.current.addApprovedDrawing('msg1', 'prop1', 'draw1', 'pattern');
      });

      expect(result.current.getApprovedDrawingId('msg1', 'prop1')).toBe('draw1');
      expect(result.current.getApprovedDrawingId('msg1', 'prop2')).toBeUndefined();
      expect(result.current.getApprovedDrawingId('msg2', 'prop1')).toBeUndefined();
    });
  });

  describe('Individual Hooks', () => {
    it('should use approved drawing IDs hook', () => {
      const { result: storeResult } = renderHook(() => useProposalApprovalStore());
      const { result: hookResult } = renderHook(() => useApprovedDrawingIds());
      
      expect(hookResult.current.size).toBe(0);
      
      act(() => {
        storeResult.current.addApprovedDrawing('msg1', 'prop1', 'draw1', 'pattern');
      });

      expect(hookResult.current.size).toBe(1);
      expect(hookResult.current.get('msg1')?.get('prop1')).toBe('draw1');
    });

    it('should use drawing types hook', () => {
      const { result: storeResult } = renderHook(() => useProposalApprovalStore());
      const { result: hookResult } = renderHook(() => useDrawingTypes());
      
      expect(hookResult.current.size).toBe(0);
      
      act(() => {
        storeResult.current.addApprovedDrawing('msg1', 'prop1', 'draw1', 'pattern');
      });

      expect(hookResult.current.size).toBe(1);
      expect(hookResult.current.get('draw1')).toBe('pattern');
    });

    it('should use add approved drawing hook', () => {
      const { result: storeResult } = renderHook(() => useProposalApprovalStore());
      const { result: hookResult } = renderHook(() => useAddApprovedDrawing());
      
      act(() => {
        hookResult.current('msg1', 'prop1', 'draw1', 'pattern');
      });

      expect(storeResult.current.approvedDrawingIds.get('msg1')?.get('prop1')).toBe('draw1');
    });

    it('should use remove approved drawing hook', () => {
      const { result: storeResult } = renderHook(() => useProposalApprovalStore());
      const { result: hookResult } = renderHook(() => useRemoveApprovedDrawing());
      
      act(() => {
        storeResult.current.addApprovedDrawing('msg1', 'prop1', 'draw1', 'pattern');
        hookResult.current('draw1');
      });

      expect(storeResult.current.approvedDrawingIds.get('msg1')?.has('prop1')).toBe(false);
    });

    it('should use clear approved drawings hook', () => {
      const { result: storeResult } = renderHook(() => useProposalApprovalStore());
      const { result: hookResult } = renderHook(() => useClearApprovedDrawings());
      
      act(() => {
        storeResult.current.addApprovedDrawing('msg1', 'prop1', 'draw1', 'pattern');
        hookResult.current();
      });

      expect(storeResult.current.approvedDrawingIds.size).toBe(0);
    });

    it('should use selector hooks', () => {
      const { result: storeResult } = renderHook(() => useProposalApprovalStore());
      const { result: getTypeResult } = renderHook(() => useGetDrawingType());
      const { result: isApprovedResult } = renderHook(() => useIsDrawingApproved());
      const { result: getIdResult } = renderHook(() => useGetApprovedDrawingId());
      
      act(() => {
        storeResult.current.addApprovedDrawing('msg1', 'prop1', 'draw1', 'pattern');
      });

      expect(getTypeResult.current('draw1')).toBe('pattern');
      expect(isApprovedResult.current('msg1', 'prop1')).toBe(true);
      expect(getIdResult.current('msg1', 'prop1')).toBe('draw1');
    });
  });

  describe('Backward Compatibility Hooks', () => {
    it('should use proposal approval actions hook', () => {
      const { result: storeResult } = renderHook(() => useProposalApprovalStore());
      const { result: actionsResult } = renderHook(() => useProposalApprovalActions());
      
      act(() => {
        actionsResult.current.addApprovedDrawing('msg1', 'prop1', 'draw1', 'pattern');
      });

      expect(storeResult.current.approvedDrawingIds.get('msg1')?.get('prop1')).toBe('draw1');

      act(() => {
        actionsResult.current.removeApprovedDrawing('draw1');
      });

      expect(storeResult.current.approvedDrawingIds.get('msg1')?.has('prop1')).toBe(false);

      act(() => {
        actionsResult.current.addApprovedDrawing('msg2', 'prop2', 'draw2', 'drawing');
        actionsResult.current.clearApprovedDrawings();
      });

      expect(storeResult.current.approvedDrawingIds.size).toBe(0);
    });

    it('should use proposal approval selectors hook', () => {
      const { result: storeResult } = renderHook(() => useProposalApprovalStore());
      const { result: selectorsResult } = renderHook(() => useProposalApprovalSelectors());
      
      act(() => {
        storeResult.current.addApprovedDrawing('msg1', 'prop1', 'draw1', 'pattern');
      });

      expect(selectorsResult.current.getDrawingType('draw1')).toBe('pattern');
      expect(selectorsResult.current.isDrawingApproved('msg1', 'prop1')).toBe(true);
      expect(selectorsResult.current.getApprovedDrawingId('msg1', 'prop1')).toBe('draw1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message ID gracefully', () => {
      const { result } = renderHook(() => useProposalApprovalStore());
      
      act(() => {
        result.current.addApprovedDrawing('', 'prop1', 'draw1', 'pattern');
      });

      expect(result.current.approvedDrawingIds.get('')?.get('prop1')).toBe('draw1');
    });

    it('should handle empty proposal ID gracefully', () => {
      const { result } = renderHook(() => useProposalApprovalStore());
      
      act(() => {
        result.current.addApprovedDrawing('msg1', '', 'draw1', 'pattern');
      });

      expect(result.current.approvedDrawingIds.get('msg1')?.get('')).toBe('draw1');
    });

    it('should handle complex state changes', () => {
      const { result } = renderHook(() => useProposalApprovalStore());
      
      act(() => {
        // Add multiple drawings
        result.current.addApprovedDrawing('msg1', 'prop1', 'draw1', 'pattern');
        result.current.addApprovedDrawing('msg1', 'prop2', 'draw2', 'drawing');
        result.current.addApprovedDrawing('msg2', 'prop3', 'draw3', 'pattern');
        
        // Remove one
        result.current.removeApprovedDrawing('draw2');
        
        // Add another with same ID as removed
        result.current.addApprovedDrawing('msg3', 'prop4', 'draw2', 'pattern');
      });

      expect(result.current.approvedDrawingIds.get('msg1')?.size).toBe(1);
      expect(result.current.approvedDrawingIds.get('msg1')?.has('prop2')).toBe(false);
      expect(result.current.approvedDrawingIds.get('msg3')?.get('prop4')).toBe('draw2');
      expect(result.current.drawingTypes.get('draw2')).toBe('pattern');
    });
  });
});