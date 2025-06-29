/**
 * Mock implementation for Secure API Storage
 * Used in test environments to avoid server-side restrictions
 */

export type ApiKeyProvider = 'openai' | 'anthropic' | 'supabase' | 'telemetry' | 'custom';

export interface EncryptedData {
  encrypted: string;
  salt: string;
  iv: string;
  tag: string;
}

export interface StoredApiKey {
  id: string;
  provider: ApiKeyProvider;
  encryptedData: EncryptedData;
  createdAt: Date;
  lastUsed?: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export class SecureApiStorage {
  private static instance: SecureApiStorage;
  private memoryCache: Map<string, { key: string; expiry: number }> = new Map();

  private constructor() {}

  static getInstance(): SecureApiStorage {
    if (!SecureApiStorage.instance) {
      SecureApiStorage.instance = new SecureApiStorage();
    }
    return SecureApiStorage.instance;
  }

  async storeApiKey(
    provider: ApiKeyProvider,
    apiKey: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const id = `mock-${provider}-${Date.now()}`;
    // Mock storage - just return the ID
    return id;
  }

  async retrieveApiKey(
    provider: ApiKeyProvider,
    id?: string
  ): Promise<string | null> {
    // Return mock API keys for testing
    switch (provider) {
      case 'openai':
        return 'sk-test-mock-openai-key-123456789';
      case 'anthropic':
        return 'test-mock-anthropic-key-123456789';
      case 'supabase':
        return 'test-mock-supabase-key-123456789';
      case 'telemetry':
        return 'test-mock-telemetry-key-123456789';
      default:
        return 'test-mock-generic-key-123456789';
    }
  }

  async rotateApiKey(
    provider: ApiKeyProvider,
    oldId: string,
    newApiKey: string
  ): Promise<string> {
    return `mock-rotated-${provider}-${Date.now()}`;
  }

  async deleteApiKey(provider: ApiKeyProvider, id: string): Promise<void> {
    // Mock - do nothing
  }

  clearCache(): void {
    this.memoryCache.clear();
  }
}

// Export mock singleton instance
export const secureApiStorage = SecureApiStorage.getInstance();