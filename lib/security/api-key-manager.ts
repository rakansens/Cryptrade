/**
 * API Key Manager
 * 
 * Central service for managing API keys across the application
 * Provides a unified interface for secure key retrieval
 */

import { secureApiStorage, type ApiKeyProvider } from './secure-api-storage';
import { logger } from '@/lib/utils/logger';
import { env } from '@/config/env';

export interface ApiKeyConfig {
  provider: ApiKeyProvider;
  required: boolean;
  fallbackToEnv: boolean;
  cacheTTL?: number;
}

export class ApiKeyManager {
  private static instance: ApiKeyManager;
  private initialized = false;
  private keyConfigs: Map<ApiKeyProvider, ApiKeyConfig> = new Map();

  private constructor() {
    this.setupDefaultConfigs();
  }

  static getInstance(): ApiKeyManager {
    if (!ApiKeyManager.instance) {
      ApiKeyManager.instance = new ApiKeyManager();
    }
    return ApiKeyManager.instance;
  }

  /**
   * Setup default configurations for known providers
   */
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

    this.keyConfigs.set('supabase', {
      provider: 'supabase',
      required: false,
      fallbackToEnv: true,
    });

    this.keyConfigs.set('telemetry', {
      provider: 'telemetry',
      required: false,
      fallbackToEnv: true,
    });
  }

  /**
   * Initialize the API key manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // In development, auto-migrate existing env keys to secure storage
      if (env.NODE_ENV === 'development') {
        await this.migrateEnvKeys();
      }

      this.initialized = true;
      logger.info('[ApiKeyManager] Initialized successfully');
    } catch (error) {
      logger.error('[ApiKeyManager] Initialization failed', {
        error: String(error),
      });
    }
  }

  /**
   * Get API key for a specific provider
   */
  async getApiKey(provider: ApiKeyProvider): Promise<string | null> {
    try {
      // Ensure initialization
      if (!this.initialized) {
        await this.initialize();
      }

      const config = this.keyConfigs.get(provider);
      if (!config) {
        logger.warn('[ApiKeyManager] Unknown provider', { provider });
        return null;
      }

      // Try to get from secure storage first
      let apiKey = await secureApiStorage.retrieveApiKey(provider);

      // Fall back to environment if configured and no key found
      if (!apiKey && config.fallbackToEnv) {
        apiKey = this.getEnvKey(provider);
      }

      // Check if required key is missing
      if (!apiKey && config.required) {
        logger.error('[ApiKeyManager] Required API key missing', { provider });
        if (env.NODE_ENV === 'production') {
          throw new Error(`Required API key for ${provider} is not configured`);
        }
      }

      return apiKey;
    } catch (error) {
      logger.error('[ApiKeyManager] Failed to get API key', {
        provider,
        error: String(error),
      });
      
      // In production, throw error for required keys
      if (this.keyConfigs.get(provider)?.required && env.NODE_ENV === 'production') {
        throw error;
      }
      
      return null;
    }
  }

  /**
   * Get API key from environment
   */
  private getEnvKey(provider: ApiKeyProvider): string | null {
    switch (provider) {
      case 'openai':
        return env.OPENAI_API_KEY || null;
      case 'anthropic':
        return env.ANTHROPIC_API_KEY || null;
      case 'supabase':
        return env.SUPABASE_SERVICE_ROLE_KEY || null;
      case 'telemetry':
        return env.TELEMETRY_API_KEY || null;
      default:
        return null;
    }
  }

  /**
   * Migrate existing environment keys to secure storage
   */
  private async migrateEnvKeys(): Promise<void> {
    const providers: ApiKeyProvider[] = ['openai', 'anthropic', 'supabase', 'telemetry'];
    
    for (const provider of providers) {
      const envKey = this.getEnvKey(provider);
      if (envKey && envKey !== 'browser-env-not-available') {
        try {
          // Check if already migrated
          const existing = await secureApiStorage.retrieveApiKey(provider);
          if (!existing) {
            await secureApiStorage.storeApiKey(provider, envKey, {
              source: 'env-migration',
              migratedAt: new Date().toISOString(),
            });
            logger.info('[ApiKeyManager] Migrated env key to secure storage', { provider });
          }
        } catch (error) {
          logger.error('[ApiKeyManager] Failed to migrate env key', {
            provider,
            error: String(error),
          });
        }
      }
    }
  }

  /**
   * Store a new API key
   */
  async storeApiKey(
    provider: ApiKeyProvider,
    apiKey: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    return secureApiStorage.storeApiKey(provider, apiKey, metadata);
  }

  /**
   * Rotate an API key
   */
  async rotateApiKey(
    provider: ApiKeyProvider,
    oldId: string,
    newApiKey: string
  ): Promise<string> {
    return secureApiStorage.rotateApiKey(provider, oldId, newApiKey);
  }

  /**
   * Delete an API key
   */
  async deleteApiKey(provider: ApiKeyProvider, id: string): Promise<void> {
    return secureApiStorage.deleteApiKey(provider, id);
  }

  /**
   * Validate API key format (basic validation)
   */
  validateApiKeyFormat(provider: ApiKeyProvider, apiKey: string): boolean {
    switch (provider) {
      case 'openai':
        // OpenAI keys start with 'sk-'
        return apiKey.startsWith('sk-') && apiKey.length > 20;
      case 'anthropic':
        // Anthropic keys have specific format
        return apiKey.length > 20;
      case 'supabase':
        // Supabase service role keys are JWTs
        return apiKey.split('.').length === 3;
      default:
        // Basic length check for unknown providers
        return apiKey.length >= 16;
    }
  }

  /**
   * Clear all cached keys
   */
  clearCache(): void {
    secureApiStorage.clearCache();
  }
}

// Export singleton instance
export const apiKeyManager = ApiKeyManager.getInstance();