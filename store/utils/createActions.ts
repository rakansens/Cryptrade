/**
 * Store Action Creation Utilities
 * 
 * Utilities for creating consistent action hooks from Zustand stores
 * to reduce duplication across store files
 */

/**
 * Action Configuration for creating action hooks
 */
export interface ActionConfig<T> {
  /** Name of the action hook */
  hookName: string;
  /** Action names to extract from the store */
  actionNames: (keyof T)[];
}

/**
 * Store Hook Type Definition
 */
export type StoreHook<T> = (selector: (state: T) => any) => any;

/**
 * Create multiple action hooks from a store
 * 
 * @param storeHook - The base store hook (e.g., useMarketStoreBase)
 * @param configs - Array of action configurations
 * @returns Object containing all action hooks
 */
export function createStoreActions<T>(
  storeHook: StoreHook<T>,
  configs: ActionConfig<T>[]
): Record<string, () => Record<string, any>> {
  const actionHooks: Record<string, () => Record<string, any>> = {};

  configs.forEach(({ hookName, actionNames }) => {
    actionHooks[hookName] = () => {
      const actions: Record<string, any> = {};
      
      actionNames.forEach((actionName) => {
        actions[actionName as string] = storeHook(state => (state as any)[actionName]);
      });
      
      return actions;
    };
  });

  return actionHooks;
}

/**
 * Create a single action hook from a store
 * 
 * @param storeHook - The base store hook
 * @param actionNames - Array of action names to extract
 * @returns Action hook function
 */
export function createActionHook<T>(
  storeHook: StoreHook<T>,
  actionNames: (keyof T)[]
): () => Record<string, any> {
  return () => {
    const actions: Record<string, any> = {};
    
    actionNames.forEach((actionName) => {
      actions[actionName as string] = storeHook(state => (state as any)[actionName]);
    });
    
    return actions;
  };
}

/**
 * Create typed action hook with specific return type
 * 
 * @param storeHook - The base store hook
 * @param selector - Function to select actions from store
 * @returns Typed action hook
 */
export function createTypedActionHook<T, R>(
  storeHook: StoreHook<T>,
  selector: (state: T) => R
): () => R {
  return () => storeHook(selector);
}

/**
 * Helper to create action configurations
 */
export function createActionConfig<T>(
  hookName: string,
  actionNames: (keyof T)[]
): ActionConfig<T> {
  return {
    hookName,
    actionNames,
  };
}

/**
 * Helper to create multiple action configurations at once
 */
export function createActionConfigs<T>(
  configs: Array<{
    hookName: string;
    actionNames: (keyof T)[];
  }>
): ActionConfig<T>[] {
  return configs.map(config => createActionConfig(config.hookName, config.actionNames));
}

/**
 * Performance-optimized action creator for frequently used actions
 * Creates memoized action hooks to prevent unnecessary re-renders
 */
export function createMemoizedActionHook<T>(
  storeHook: StoreHook<T>,
  actionNames: (keyof T)[]
): () => Record<string, any> {
  // Note: In a real implementation, you might want to use useMemo
  // This is a simplified version for demonstration
  return createActionHook(storeHook, actionNames);
}

/**
 * Validate action names exist in store state
 */
export function validateActionNames<T>(
  storeState: T,
  actionNames: (keyof T)[]
): boolean {
  return actionNames.every(name => 
    typeof (storeState as any)[name] === 'function'
  );
}

/**
 * Create action hook with runtime validation
 */
export function createValidatedActionHook<T>(
  storeHook: StoreHook<T>,
  actionNames: (keyof T)[],
  storeName?: string
): () => Record<string, any> {
  return () => {
    const state = storeHook(state => state);
    
    // Validate actions exist
    const invalidActions = actionNames.filter(name => 
      typeof (state as any)[name] !== 'function'
    );
    
    if (invalidActions.length > 0) {
      console.warn(
        `[Store Actions] Invalid action names in ${storeName || 'store'}:`,
        invalidActions
      );
    }
    
    const actions: Record<string, any> = {};
    actionNames.forEach((actionName) => {
      const action = (state as any)[actionName];
      if (typeof action === 'function') {
        actions[actionName as string] = action;
      }
    });
    
    return actions;
  };
}

/**
 * Legacy compatibility - create action hook in the old pattern
 */
export function createLegacyActionHook<T>(
  storeHook: StoreHook<T>,
  actionMap: Record<string, keyof T>
): () => Record<string, any> {
  return () => {
    const actions: Record<string, any> = {};
    
    Object.entries(actionMap).forEach(([key, actionName]) => {
      actions[key] = storeHook(state => (state as any)[actionName]);
    });
    
    return actions;
  };
}

// Type utilities for better TypeScript support
export type ExtractActions<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : never;
};

export type ActionNames<T> = keyof ExtractActions<T>;

export type ActionHookResult<T, K extends keyof T> = {
  [P in K]: T[P];
};