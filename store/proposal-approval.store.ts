import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { ApprovedDrawingIds, DrawingType } from '@/types/proposal';

// Define initial state for consistency
const initialState = {
  approvedDrawingIds: new Map() as ApprovedDrawingIds,
  drawingTypes: new Map<string, DrawingType>(),
};

interface ProposalApprovalState {
  // State
  approvedDrawingIds: ApprovedDrawingIds;
  drawingTypes: Map<string, DrawingType>;
  
  // Actions
  addApprovedDrawing: (messageId: string, proposalId: string, drawingId: string, type: DrawingType) => void;
  removeApprovedDrawing: (drawingId: string) => void;
  clearApprovedDrawings: () => void;
  reset: () => void;
  
  // Selectors
  getDrawingType: (drawingId: string) => DrawingType | undefined;
  isDrawingApproved: (messageId: string, proposalId: string) => boolean;
  getApprovedDrawingId: (messageId: string, proposalId: string) => string | undefined;
}

export const useProposalApprovalStore = create<ProposalApprovalState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    ...initialState,
    
    // Actions
    addApprovedDrawing: (messageId, proposalId, drawingId, type) => {
      set((state) => {
        const newApprovedDrawingIds = new Map(state.approvedDrawingIds);
        const messageDrawings = newApprovedDrawingIds.get(messageId) || new Map();
        messageDrawings.set(proposalId, drawingId);
        newApprovedDrawingIds.set(messageId, messageDrawings);
        
        const newDrawingTypes = new Map(state.drawingTypes);
        newDrawingTypes.set(drawingId, type);
        
        return {
          approvedDrawingIds: newApprovedDrawingIds,
          drawingTypes: newDrawingTypes,
        };
      });
    },
    
    removeApprovedDrawing: (drawingId) => {
      set((state) => {
        const newApprovedDrawingIds = new Map(state.approvedDrawingIds);
        
        // Find and remove the drawing from all messages
        newApprovedDrawingIds.forEach((messageDrawings) => {
          messageDrawings.forEach((storedDrawingId, proposalId) => {
            if (storedDrawingId === drawingId) {
              messageDrawings.delete(proposalId);
            }
          });
        });
        
        const newDrawingTypes = new Map(state.drawingTypes);
        newDrawingTypes.delete(drawingId);
        
        return {
          approvedDrawingIds: newApprovedDrawingIds,
          drawingTypes: newDrawingTypes,
        };
      });
    },
    
    clearApprovedDrawings: () => {
      set({
        approvedDrawingIds: new Map(),
        drawingTypes: new Map(),
      });
    },
    
    reset: () => {
      set(initialState);
    },
    
    // Selectors
    getDrawingType: (drawingId) => {
      return get().drawingTypes.get(drawingId);
    },
    
    isDrawingApproved: (messageId, proposalId) => {
      const messageDrawings = get().approvedDrawingIds.get(messageId);
      return messageDrawings?.has(proposalId) ?? false;
    },
    
    getApprovedDrawingId: (messageId, proposalId) => {
      const messageDrawings = get().approvedDrawingIds.get(messageId);
      return messageDrawings?.get(proposalId);
    },
  }))
);

// Selector hooks for component usage with proper memoization
export const useApprovedDrawingIds = () => useProposalApprovalStore(
  (state) => state.approvedDrawingIds
);

export const useDrawingTypes = () => useProposalApprovalStore(
  (state) => state.drawingTypes
);

// Individual action hooks to prevent infinite loops
export const useAddApprovedDrawing = () => useProposalApprovalStore(
  (state) => state.addApprovedDrawing
);

export const useRemoveApprovedDrawing = () => useProposalApprovalStore(
  (state) => state.removeApprovedDrawing
);

export const useClearApprovedDrawings = () => useProposalApprovalStore(
  (state) => state.clearApprovedDrawings
);

// Individual selector hooks
export const useGetDrawingType = () => useProposalApprovalStore(
  (state) => state.getDrawingType
);

export const useIsDrawingApproved = () => useProposalApprovalStore(
  (state) => state.isDrawingApproved
);

export const useGetApprovedDrawingId = () => useProposalApprovalStore(
  (state) => state.getApprovedDrawingId
);

// Backward compatibility - deprecated grouped hooks
export const useProposalApprovalActions = () => ({
  addApprovedDrawing: useAddApprovedDrawing(),
  removeApprovedDrawing: useRemoveApprovedDrawing(),
  clearApprovedDrawings: useClearApprovedDrawings(),
});

export const useProposalApprovalSelectors = () => ({
  getDrawingType: useGetDrawingType(),
  isDrawingApproved: useIsDrawingApproved(),
  getApprovedDrawingId: useGetApprovedDrawingId(),
});