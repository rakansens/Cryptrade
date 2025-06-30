// Mock for ioredis
export default class MockRedis {
  private data: Map<string, any> = new Map();
  private subscribers: Map<string, Function[]> = new Map();
  
  constructor(options?: any) {
    // Mock constructor
  }

  async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<'OK'> {
    this.data.set(key, value);
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const exists = this.data.has(key);
    this.data.delete(key);
    return exists ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    return this.data.has(key) ? 1 : 0;
  }

  async expire(key: string, seconds: number): Promise<number> {
    // Mock expire - in real implementation would set TTL
    return this.data.has(key) ? 1 : 0;
  }

  async ttl(key: string): Promise<number> {
    // Mock TTL - return -1 for no expiry, -2 for non-existent key
    return this.data.has(key) ? -1 : -2;
  }

  async keys(pattern: string): Promise<string[]> {
    const allKeys = Array.from(this.data.keys());
    if (pattern === '*') {
      return allKeys;
    }
    // Simple pattern matching - could be enhanced
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return allKeys.filter(key => regex.test(key));
  }

  async flushall(): Promise<'OK'> {
    this.data.clear();
    return 'OK';
  }

  async ping(): Promise<'PONG'> {
    return 'PONG';
  }

  async quit(): Promise<'OK'> {
    return 'OK';
  }

  async disconnect(): Promise<void> {
    // Mock disconnect
  }

  // Mock pub/sub methods
  async publish(channel: string, message: string): Promise<number> {
    const subs = this.subscribers.get(channel) || [];
    subs.forEach(callback => callback(message));
    return subs.length;
  }

  async subscribe(channel: string): Promise<void> {
    // Mock subscribe
  }

  on(event: string, callback: Function): this {
    if (event === 'message') {
      // Mock message event handler
    }
    return this;
  }

  // Mock pipeline
  pipeline() {
    return {
      get: (key: string) => this,
      set: (key: string, value: string) => this,
      del: (key: string) => this,
      exec: async () => [['OK', 'value']]
    };
  }
}

// Named export for compatibility
export { MockRedis as Redis };