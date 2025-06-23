// Mock for SharedDataStore
export class SharedDataStore {
  private static instance: SharedDataStore;
  private store = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  static getInstance = jest.fn(() => {
    if (!SharedDataStore.instance) {
      SharedDataStore.instance = new SharedDataStore();
    }
    return SharedDataStore.instance;
  });

  static set = jest.fn();
  static get = jest.fn();
  static has = jest.fn(() => false);
  static delete = jest.fn(() => false);
  static clearNamespace = jest.fn();
  static clearAll = jest.fn();
  static getKeys = jest.fn(() => []);
  static getAll = jest.fn(() => ({}));
  static getStats = jest.fn(() => ({ namespaces: 0, totalKeys: 0, namespaceDetails: {} }));
  static destroy = jest.fn(() => {
    if (SharedDataStore.instance) {
      if (SharedDataStore.instance.cleanupInterval) {
        clearInterval(SharedDataStore.instance.cleanupInterval);
        SharedDataStore.instance.cleanupInterval = null;
      }
      SharedDataStore.instance.store.clear();
      SharedDataStore.instance = null!;
    }
  });

  cleanup = jest.fn();
}

// Convenience export
export const sharedData = {
  set: SharedDataStore.set,
  get: SharedDataStore.get,
  has: SharedDataStore.has,
  delete: SharedDataStore.delete,
  clearNamespace: SharedDataStore.clearNamespace,
  clearAll: SharedDataStore.clearAll,
  getKeys: SharedDataStore.getKeys,
  getAll: SharedDataStore.getAll,
  getStats: SharedDataStore.getStats,
};

export interface StoredData<T = unknown> {
  value: T;
  timestamp: number;
  ttl?: number;
  metadata?: Record<string, unknown>;
}