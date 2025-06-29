'use client';

import { useEffect, useCallback } from 'react';
import { useAsyncState } from '@/hooks/base/use-async-state';
import { useSSEStream } from '@/hooks/base/use-sse-stream';
import type { Alert, AlertConditions } from '@/types/database.types';
import { logger } from '@/lib/utils/logger';

/**
 * Hook for managing user alerts with real-time updates
 * Refactored to use useAsyncState for consistent async operations
 */
export function useAlerts(userId?: string) {
  // Use useAsyncState for fetching alerts
  const {
    data: alerts,
    loading: loadingAlerts,
    error: alertsError,
    execute: fetchAlerts,
    reset: resetAlerts,
  } = useAsyncState(
    useCallback(async () => {
      if (!userId) return [];
      
      const res = await fetch('/api/alerts', {
        headers: { 'x-user-id': userId }
      });
      
      if (!res.ok) {
        throw new Error(`Failed to fetch alerts: ${res.statusText}`);
      }
      
      const data = await res.json();
      return data.alerts as Alert[];
    }, [userId])
  );

  // Use useAsyncState for creating alerts
  const {
    execute: executeCreateAlert,
    loading: creatingAlert,
    error: createError,
  } = useAsyncState(
    useCallback(async (symbol: string, conditions: AlertConditions) => {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ symbol, conditions }),
      });
      
      if (!res.ok) {
        throw new Error(`Failed to create alert: ${res.statusText}`);
      }
      
      const data = await res.json();
      return data.alert as Alert;
    }, [userId])
  );

  // Wrapper for createAlert that updates the alerts list
  const createAlert = useCallback(
    async (symbol: string, conditions: AlertConditions) => {
      const newAlert = await executeCreateAlert(symbol, conditions);
      
      if (newAlert) {
        // Update alerts list by refetching
        // This ensures we have the latest data from the server
        await fetchAlerts();
      }
      
      return newAlert;
    },
    [executeCreateAlert, fetchAlerts]
  );

  // Auto-fetch alerts when userId changes
  useEffect(() => {
    if (userId) {
      fetchAlerts();
    } else {
      resetAlerts();
    }
  }, [userId, fetchAlerts, resetAlerts]);

  // SSE stream for real-time updates
  useSSEStream({
    url: '/api/events',
    eventTypes: ['alertTriggered'],
    onEvent: (_, ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (!userId || payload.userId !== userId) return;
        
        logger.info('[useAlerts] Alert triggered', payload);
        
        // Refetch alerts to get updated data
        fetchAlerts();
      } catch (_e) {
        logger.warn('[useAlerts] Failed to parse event', { data: ev.data });
      }
    },
  });

  return {
    // Data
    alerts: alerts || [],
    
    // Loading states
    loadingAlerts,
    creatingAlert,
    
    // Errors
    alertsError,
    createError,
    
    // Actions
    fetchAlerts,
    createAlert,
  };
}