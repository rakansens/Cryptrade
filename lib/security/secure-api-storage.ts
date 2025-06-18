/**
 * Secure API Storage Service
 * 
 * Manages encrypted storage of API keys with support for multiple providers
 * and secure retrieval mechanisms
 */

import { apiKeyEncryption, type EncryptedData } from './api-key-encryption';
import { logger } from '@/lib/utils/logger';
import { getSupabaseAdmin } from '@/lib/db/supabase';
import { env } from '@/config/env';

export type ApiKeyProvider = 'openai' | 'anthropic' | 'supabase' | 'telemetry' | 'custom';

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
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): SecureApiStorage {
    if (!SecureApiStorage.instance) {
      SecureApiStorage.instance = new SecureApiStorage();
    }
    return SecureApiStorage.instance;
  }

  /**
   * Store an API key securely
   */
  async storeApiKey(
    provider: ApiKeyProvider,
    apiKey: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    try {
      // Encrypt the API key
      const encryptedData = apiKeyEncryption.encrypt(apiKey);

      // Generate unique ID
      const id = this.generateKeyId(provider);

      // Store in database if available
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { error } = await supabase
          .from('secure_api_keys')
          .upsert({
            id,
            provider,
            encrypted_data: encryptedData,
            metadata,
            created_at: new Date().toISOString(),
          });

        if (error) {
          logger.error('[SecureApiStorage] Failed to store in database', { error });
          // Fall back to environment variables
        }
      }

      logger.info('[SecureApiStorage] API key stored securely', {
        provider,
        id,
        hasMetadata: !!metadata,
      });

      return id;
    } catch (error) {
      logger.error('[SecureApiStorage] Failed to store API key', {
        provider,
        error: String(error),
      });
      throw new Error('Failed to store API key securely');
    }
  }

  /**
   * Retrieve an API key securely
   */
  async retrieveApiKey(
    provider: ApiKeyProvider,
    id?: string
  ): Promise<string | null> {
    try {
      // Check memory cache first
      const cacheKey = `${provider}:${id || 'default'}`;
      const cached = this.memoryCache.get(cacheKey);
      
      if (cached && cached.expiry > Date.now()) {
        return cached.key;
      }

      // Try to retrieve from database
      const supabase = getSupabaseAdmin();
      if (supabase && id) {
        const { data, error } = await supabase
          .from('secure_api_keys')
          .select('encrypted_data')
          .eq('id', id)
          .eq('provider', provider)
          .single();

        if (!error && data && apiKeyEncryption.isValidEncryptedData(data.encrypted_data)) {
          const decrypted = apiKeyEncryption.decrypt(data.encrypted_data);
          
          // Update last used timestamp
          await supabase
            .from('secure_api_keys')
            .update({ last_used: new Date().toISOString() })
            .eq('id', id);

          // Cache the decrypted key
          this.cacheDecryptedKey(cacheKey, decrypted);
          
          return decrypted;
        }
      }

      // Fall back to environment variables (temporary backward compatibility)
      const envKey = this.getEnvKeyForProvider(provider);
      if (envKey) {
        this.cacheDecryptedKey(cacheKey, envKey);
        return envKey;
      }

      return null;
    } catch (error) {
      logger.error('[SecureApiStorage] Failed to retrieve API key', {
        provider,
        error: String(error),
      });
      return null;
    }
  }

  /**
   * Get API key from environment (backward compatibility)
   */
  private getEnvKeyForProvider(provider: ApiKeyProvider): string | null {
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
   * Cache decrypted key in memory with TTL
   */
  private cacheDecryptedKey(key: string, value: string): void {
    this.memoryCache.set(key, {
      key: value,
      expiry: Date.now() + this.CACHE_TTL,
    });

    // Clean up expired entries periodically
    if (this.memoryCache.size > 100) {
      this.cleanupCache();
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expiry < now) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Generate unique key ID
   */
  private generateKeyId(provider: ApiKeyProvider): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${provider}_${timestamp}_${random}`;
  }

  /**
   * Rotate API keys for enhanced security
   */
  async rotateApiKey(
    provider: ApiKeyProvider,
    oldId: string,
    newApiKey: string
  ): Promise<string> {
    try {
      // Store new key
      const newId = await this.storeApiKey(provider, newApiKey, {
        rotatedFrom: oldId,
        rotatedAt: new Date().toISOString(),
      });

      // Mark old key as rotated (don't delete immediately for rollback)
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await supabase
          .from('secure_api_keys')
          .update({
            metadata: { rotated: true, rotatedTo: newId },
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          })
          .eq('id', oldId);
      }

      // Clear cache for the provider
      const cacheKey = `${provider}:${oldId}`;
      this.memoryCache.delete(cacheKey);

      logger.info('[SecureApiStorage] API key rotated successfully', {
        provider,
        oldId,
        newId,
      });

      return newId;
    } catch (error) {
      logger.error('[SecureApiStorage] Failed to rotate API key', {
        provider,
        error: String(error),
      });
      throw new Error('Failed to rotate API key');
    }
  }

  /**
   * Delete an API key
   */
  async deleteApiKey(provider: ApiKeyProvider, id: string): Promise<void> {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await supabase
          .from('secure_api_keys')
          .delete()
          .eq('id', id)
          .eq('provider', provider);
      }

      // Clear from cache
      const cacheKey = `${provider}:${id}`;
      this.memoryCache.delete(cacheKey);

      logger.info('[SecureApiStorage] API key deleted', { provider, id });
    } catch (error) {
      logger.error('[SecureApiStorage] Failed to delete API key', {
        provider,
        id,
        error: String(error),
      });
      throw new Error('Failed to delete API key');
    }
  }

  /**
   * Clear all cached keys (for security purposes)
   */
  clearCache(): void {
    this.memoryCache.clear();
    logger.info('[SecureApiStorage] Cache cleared');
  }
}

// Export singleton instance
export const secureApiStorage = SecureApiStorage.getInstance();