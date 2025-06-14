'use client';

import { useCallback } from 'react';
import { useRemoveApprovedDrawing, useGetDrawingType } from '@/store/proposal-approval.store';
import { useUIEventPublisher } from '@/store/ui-event.store';
import { createChartEvent } from '@/types/events/chart-events';
import { showDrawingCancellationSuccess } from '@/lib/notifications/toast';
import { logger } from '@/lib/utils/logger';

/**
 * Hook for handling drawing cancellation logic
 */
export function useCancelDrawing() {
  const removeApprovedDrawing = useRemoveApprovedDrawing();
  const getDrawingType = useGetDrawingType();
  const { publish } = useUIEventPublisher();

  const cancelDrawing = useCallback((drawingId: string) => {
    logger.info('[CancelDrawing] Cancelling drawing', { drawingId });
    
    if (!publish) {
      logger.warn('[CancelDrawing] No publish function available');
      return;
    }
    
    // Check if this is a pattern or regular drawing using stored type info
    const drawingType = getDrawingType(drawingId);
    const isPattern = drawingType === 'pattern';
    
    let deleteEvent;
    if (isPattern) {
      // Use pattern-specific deletion - create custom event since there's no createChartEvent for pattern deletion
      deleteEvent = new CustomEvent('chart:removePattern', {
        detail: { id: drawingId }
      });
    } else {
      // Use regular drawing deletion
      deleteEvent = createChartEvent('deleteDrawing', {
        id: drawingId
      });
    }
    
    // Dispatch the delete event directly to the window
    if (typeof window !== 'undefined') {
      window.dispatchEvent(deleteEvent);
      logger.info('[CancelDrawing] Drawing removed from chart', { drawingId, isPattern });
    } else {
      // If on server, publish through SSE
      publish(deleteEvent);
    }
    
    // Remove from store
    removeApprovedDrawing(drawingId);
    
    // Show success notification
    showDrawingCancellationSuccess();
  }, [publish, getDrawingType, removeApprovedDrawing]);

  return {
    cancelDrawing,
  };
}