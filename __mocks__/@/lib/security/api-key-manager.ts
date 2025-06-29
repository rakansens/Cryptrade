/**
 * Mock implementation for API Key Manager
 * Used in test environments to avoid server-side restrictions
 */

export interface ApiKeyConfig {
  provider: string;
  required: boolean;
  fallbackToEnv: boolean;
  cacheTTL?: number;
}

export class ApiKeyManager {
  private static instance: ApiKeyManager;
  private initialized = true; // Always initialized in tests
  private keyConfigs: Map<string, ApiKeyConfig> = new Map();

  private constructor() {
    this.setupDefaultConfigs();
  }

  static getInstance(): ApiKeyManager {
    if (!ApiKeyManager.instance) {
      ApiKeyManager.instance = new ApiKeyManager();
    }
    return ApiKeyManager.instance;
  }

  private setupDefaultConfigs(): void {
    this.keyConfigs.set('openai', {
      provider: 'openai',
      required: true,
      fallbackToEnv: true,
    });

    this.keyConfigs.set('anthropic', {
      provider: 'anthropic',
      required: false,
      fallbackToEnv: true,
    });
  }

  async initialize(): Promise<void> {
    // Mock - already initialized
    this.initialized = true;
  }

  async getApiKey(provider: string): Promise<string | null> {
    // Return mock API keys for testing
    switch (provider) {
      case 'openai':
        return 'sk-test-mock-openai-key-123456789';
      case 'anthropic':
        return 'test-mock-anthropic-key-123456789';
      default:
        return 'test-mock-generic-key-123456789';
    }
  }

  async storeApiKey(
    provider: string,
    apiKey: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    return `mock-id-${provider}-${Date.now()}`;
  }

  async rotateApiKey(
    provider: string,
    oldId: string,
    newApiKey: string
  ): Promise<string> {
    return `mock-rotated-id-${provider}-${Date.now()}`;
  }

  async deleteApiKey(provider: string, id: string): Promise<void> {
    // Mock - do nothing
  }

  validateApiKeyFormat(provider: string, apiKey: string): boolean {
    return apiKey.length > 10; // Simple mock validation
  }

  clearCache(): void {
    // Mock - do nothing
  }
}

// Export mock singleton instance
export const apiKeyManager = ApiKeyManager.getInstance();