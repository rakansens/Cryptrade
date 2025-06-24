'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AlertConditions } from '@/types/database.types';
import { useAlerts } from '@/hooks/use-alerts';

export function AlertForm({ userId }: { userId: string }) {
  const { createAlert } = useAlerts(userId);
  const [symbol, setSymbol] = useState('');
  const [price, setPrice] = useState('');

  const handleCreate = async () => {
    try {
      const conditions: AlertConditions = { priceAbove: parseFloat(price) };
      await createAlert(symbol, conditions);
      setSymbol('');
      setPrice('');
    } catch (error) {
      // Don't clear form on error
    }
  };

  return (
    <div className="flex gap-2">
      <Input placeholder="Symbol" value={symbol} onChange={e => setSymbol(e.target.value)} />
      <Input placeholder="Price above" value={price} onChange={e => setPrice(e.target.value)} />
      <Button onClick={handleCreate}>Create Alert</Button>
    </div>
  );
}
