import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { createStoreDebugger } from '@/lib/utils/zustand-helpers';
import { logger } from '@/lib/utils/logger';

export interface BaseState {
  error: string | null;
  isLoading: boolean;
  lastUpdateTime: number;
}

export interface BaseActions {
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export interface StoreConfig<T> {
  name: string;
  initialState: T;
  defaultState: T;
}

export type Store<State extends BaseState, Actions extends BaseActions> = State & Actions;

export function createBaseStore<State extends BaseState, Actions extends BaseActions>(
  config: StoreConfig<State>,
  actionsFactory: (set: any, get: any, debug: (action: string) => void) => Omit<Actions, keyof BaseActions>
) {
  const debug = createStoreDebugger(config.name);
  
  type StoreType = State & Actions;
  
  return create<StoreType>()(
    subscribeWithSelector<StoreType>((set, get) => {
      const baseActions: BaseActions = {
        setError: (error) => {
          debug('setError');
          set({ error, lastUpdateTime: Date.now() } as Partial<StoreType>);
          if (error) {
            logger.error(`[${config.name}] Error set`, { error });
          }
        },
        
        setLoading: (loading) => {
          debug('setLoading');
          set({ isLoading: loading } as Partial<StoreType>);
        },
        
        reset: () => {
          debug('reset');
          set({ 
            ...config.defaultState, 
            lastUpdateTime: Date.now() 
          } as StoreType);
          logger.info(`[${config.name}] Store reset`);
        },
      };
      
      const customActions = actionsFactory(set, get, debug);
      
      return {
        ...config.initialState,
        ...baseActions,
        ...customActions,
      } as StoreType;
    })
  );
}

export function createStoreHooks<T>(storeHook: (selector: (state: T) => any) => any) {
  return {
    useError: () => storeHook((state: any) => state.error),
    useLoading: () => storeHook((state: any) => state.isLoading),
    useLastUpdateTime: () => storeHook((state: any) => state.lastUpdateTime),
  };
}