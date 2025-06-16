'use client';

import { useAlerts } from '@/hooks/use-alerts';

export function AlertList({ userId }: { userId: string }) {
  const { alerts } = useAlerts(userId);

  return (
    <ul className="space-y-2">
      {alerts.map(a => (
        <li key={a.id} className="border p-2 rounded-md">
          {a.symbol} - {a.conditions.priceAbove ?? '-'} (triggers: {a.metadata.triggerCount})
        </li>
      ))}
    </ul>
  );
}
