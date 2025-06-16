'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSSEStream } from '@/hooks/base/use-sse-stream';
import type { Alert, AlertConditions } from '@/types/database.types';
import { logger } from '@/lib/utils/logger';

export function useAlerts(userId?: string) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const fetchAlerts = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch('/api/alerts', { headers: { 'x-user-id': userId } });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts);
      }
    } catch (error) {
      logger.error('[useAlerts] Failed to fetch alerts', { error });
    }
  }, [userId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const createAlert = useCallback(
    async (symbol: string, conditions: AlertConditions) => {
      if (!userId) return;
      try {
        const res = await fetch('/api/alerts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({ symbol, conditions }),
        });
        if (res.ok) {
          const data = await res.json();
          setAlerts(prev => [...prev, data.alert]);
        }
      } catch (error) {
        logger.error('[useAlerts] Failed to create alert', { error });
      }
    },
    [userId]
  );

  useSSEStream({
    url: '/api/events',
    eventTypes: ['alertTriggered'],
    onEvent: (_type, ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (!userId || payload.userId !== userId) return;
        logger.info('[useAlerts] Alert triggered', payload);
      } catch (e) {
        logger.warn('[useAlerts] Failed to parse event', { data: ev.data });
      }
    },
  });

  return { alerts, fetchAlerts, createAlert };
}
