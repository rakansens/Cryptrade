'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AlertConditions } from '@/types/database.types';
import { useAlerts } from '@/hooks/use-alerts';
import { z } from 'zod';

// Validation schema for alert form
const AlertFormSchema = z.object({
  symbol: z.string()
    .min(3, 'Symbol must be at least 3 characters')
    .max(10, 'Symbol must be at most 10 characters')
    .regex(/^[A-Z]{3,10}(USDT?|BTC|ETH)?$/i, 'Symbol must be valid cryptocurrency format (e.g., BTCUSDT)')
    .transform(val => val.toUpperCase()),
  price: z.string()
    .min(1, 'Price is required')
    .transform(val => {
      const parsed = parseFloat(val);
      if (isNaN(parsed) || !isFinite(parsed)) {
        throw new Error('Price must be a valid number');
      }
      if (parsed <= 0) {
        throw new Error('Price must be greater than 0');
      }
      if (parsed > 1000000) {
        throw new Error('Price must be less than 1,000,000');
      }
      return parsed;
    })
});

export function AlertForm({ userId }: { userId: string }) {
  const { createAlert } = useAlerts(userId);
  const [symbol, setSymbol] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (isSubmitting) return;
    
    setError(null);
    setIsSubmitting(true);
    
    try {
      // Validate input
      const validated = AlertFormSchema.parse({ symbol, price });
      
      // Create alert with validated data
      const conditions: AlertConditions = { priceAbove: validated.price };
      await createAlert(validated.symbol, conditions);
      
      // Clear form on success
      setSymbol('');
      setPrice('');
    } catch (error) {
      if (error instanceof z.ZodError) {
        setError(error.errors[0]?.message || 'Validation error');
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to create alert');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input 
          placeholder="Symbol (e.g., BTCUSDT)" 
          value={symbol} 
          onChange={e => setSymbol(e.target.value)}
          className={error && error.includes('Symbol') ? 'border-red-500' : ''}
        />
        <Input 
          type="number"
          placeholder="Price above" 
          value={price} 
          onChange={e => setPrice(e.target.value)}
          className={error && error.includes('Price') ? 'border-red-500' : ''}
        />
        <Button 
          onClick={handleCreate} 
          disabled={isSubmitting || !symbol || !price}
        >
          {isSubmitting ? 'Creating...' : 'Create Alert'}
        </Button>
      </div>
      {error && (
        <div className="text-red-500 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
