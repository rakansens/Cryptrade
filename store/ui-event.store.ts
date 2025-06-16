import { create } from 'zustand';
import { useUIEventStream } from '@/hooks/use-ui-event-stream';
import type { PublishableEvent } from '@/types/events';

// Define initial state for consistency
const initialState = {
  isInitialized: false,
};

// Simple store for UI event publishing
export interface UIEventState {
  isInitialized: boolean;
  setInitialized: (initialized: boolean) => void;
  reset: () => void;
}

export const useUIEventStore = create<UIEventState>((set) => ({
  ...initialState,
  setInitialized: (initialized) => set({ isInitialized: initialized }),
  reset: () => set(initialState),
}));

// Custom hook for UI event publishing
export function useUIEventPublisher() {
  const { publish } = useUIEventStream();

  return {
    publish: publish as (event: PublishableEvent) => Promise<unknown>,
    isAvailable: !!publish,
  };
}