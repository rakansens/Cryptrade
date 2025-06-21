// Mock for SharedDataStore
export class SharedDataStore {
  private static instance: SharedDataStore;
  private store = new Map();

  static getInstance = jest.fn(() => {
    if (!SharedDataStore.instance) {
      SharedDataStore.instance = new SharedDataStore();
    }
    return SharedDataStore.instance;
  });

  static set = jest.fn();
  static get = jest.fn();
  static has = jest.fn(() => false);
  static delete = jest.fn();
  static clear = jest.fn();
  static keys = jest.fn(() => []);
  static values = jest.fn(() => []);
  static size = jest.fn(() => 0);

  set = jest.fn();
  get = jest.fn();
  has = jest.fn(() => false);
  delete = jest.fn();
  clear = jest.fn();
  cleanup = jest.fn();
  destroy = jest.fn();
}