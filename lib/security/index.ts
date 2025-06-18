/**
 * Security Module
 * 
 * Central export for all security-related utilities and services
 */

import { env } from '@/config/env';

export { apiKeyEncryption, type EncryptedData } from './api-key-encryption';
export { secureApiStorage, type ApiKeyProvider, type StoredApiKey } from './secure-api-storage';
export { apiKeyManager, type ApiKeyConfig } from './api-key-manager';

// Re-export secure service implementations
export { secureEmbeddingService } from '@/lib/services/semantic-embedding.service.secure';

/**
 * Security utility functions
 */

// Helper function for optional env vars not in schema
function getOptionalEnvVar(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

/**
 * Check if the application is using secure API key storage
 */
export function isUsingSecureStorage(): boolean {
  return env.NODE_ENV === 'production' || 
         getOptionalEnvVar('USE_SECURE_API_STORAGE') === 'true';
}

/**
 * Get security recommendations based on current configuration
 */
export function getSecurityRecommendations(): string[] {
  const recommendations: string[] = [];

  // Check for API keys in environment
  if (env.OPENAI_API_KEY) {
    recommendations.push('API keys detected in environment variables. Consider migrating to secure storage.');
  }

  // Check master key strength
  const masterSecret = env.API_AUTH_SECRET;
  if (!masterSecret || masterSecret.length < 32) {
    recommendations.push('API_AUTH_SECRET should be at least 32 characters for adequate security.');
  }

  // Check if in production without secure storage
  if (env.NODE_ENV === 'production' && !env.NEXT_PUBLIC_SUPABASE_URL) {
    recommendations.push('Production environment should use secure storage (Supabase) for API keys.');
  }

  return recommendations;
}

/**
 * Initialize security features
 */
export async function initializeSecurity(): Promise<void> {
  const { apiKeyManager } = await import('./api-key-manager');
  await apiKeyManager.initialize();
  
  // Log security recommendations in development
  if (env.NODE_ENV === 'development') {
    const recommendations = getSecurityRecommendations();
    if (recommendations.length > 0) {
      console.log('🔐 Security Recommendations:');
      recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }
  }
}