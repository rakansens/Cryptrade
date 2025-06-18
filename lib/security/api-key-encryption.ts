/**
 * API Key Encryption Service
 * 
 * Provides secure encryption/decryption for API keys and sensitive data
 * Automatically selects Node.js crypto or Web Crypto API based on runtime
 */

// Detect if we're in Edge Runtime
const isEdgeRuntime = typeof globalThis !== 'undefined' && 
  (globalThis as any).EdgeRuntime !== undefined ||
  (typeof globalThis !== 'undefined' && !(globalThis as any).process?.versions?.node);

// For Edge Runtime, use the Web Crypto API version
if (isEdgeRuntime) {
  module.exports = require('./api-key-encryption.edge');
} else {
  // Node.js implementation
  const { createCipheriv, createDecipheriv, randomBytes, scryptSync } = require('crypto');
  const { env } = require('@/config/env');

  // Encryption configuration
  const ALGORITHM = 'aes-256-gcm';
  const SALT_LENGTH = 32;
  const IV_LENGTH = 16;
  const TAG_LENGTH = 16;
  const KEY_LENGTH = 32;
  const ITERATIONS = 100000;

  interface EncryptedData {
    encrypted: string;
    salt: string;
    iv: string;
    tag: string;
  }

  class ApiKeyEncryption {
    private static instance: ApiKeyEncryption;
    private masterKey: Buffer | null = null;

    private constructor() {
      // Initialize with environment-based master key
      this.initializeMasterKey();
    }

    static getInstance(): ApiKeyEncryption {
      if (!ApiKeyEncryption.instance) {
        ApiKeyEncryption.instance = new ApiKeyEncryption();
      }
      return ApiKeyEncryption.instance;
    }

    /**
     * Initialize master key from environment or generate a secure one
     */
    private initializeMasterKey(): void {
      // In production, this should come from a secure key management service
      // For now, we'll use a derived key from API_AUTH_SECRET
      const secret = env.API_AUTH_SECRET || this.generateSecureSecret();
      
      // Derive a key from the secret using PBKDF2
      const salt = Buffer.from('api-key-encryption-salt', 'utf8');
      this.masterKey = scryptSync(secret, salt, KEY_LENGTH);
    }

    /**
     * Generate a secure random secret
     */
    private generateSecureSecret(): string {
      if (typeof window !== 'undefined') {
        throw new Error('API key encryption should only be used server-side');
      }
      
      // Generate a random 256-bit key
      return randomBytes(32).toString('base64');
    }

    /**
     * Encrypt an API key or sensitive data
     */
    encrypt(apiKey: string): EncryptedData {
      if (!this.masterKey) {
        throw new Error('Master key not initialized');
      }

      // Generate random salt and IV
      const salt = randomBytes(SALT_LENGTH);
      const iv = randomBytes(IV_LENGTH);

      // Derive key from master key and salt
      const key = scryptSync(this.masterKey, salt, KEY_LENGTH);

      // Create cipher
      const cipher = createCipheriv(ALGORITHM, key, iv);

      // Encrypt the API key
      const encrypted = Buffer.concat([
        cipher.update(apiKey, 'utf8'),
        cipher.final()
      ]);

      // Get the authentication tag
      const tag = cipher.getAuthTag();

      return {
        encrypted: encrypted.toString('base64'),
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64')
      };
    }

    /**
     * Decrypt an API key or sensitive data
     */
    decrypt(encryptedData: EncryptedData): string {
      if (!this.masterKey) {
        throw new Error('Master key not initialized');
      }

      // Convert from base64
      const salt = Buffer.from(encryptedData.salt, 'base64');
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const tag = Buffer.from(encryptedData.tag, 'base64');
      const encrypted = Buffer.from(encryptedData.encrypted, 'base64');

      // Derive key from master key and salt
      const key = scryptSync(this.masterKey, salt, KEY_LENGTH);

      // Create decipher
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);

      // Decrypt the data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);

      return decrypted.toString('utf8');
    }

    /**
     * Rotate encryption keys (for security best practices)
     */
    async rotateKeys(oldData: EncryptedData): Promise<EncryptedData> {
      // Decrypt with current key
      const decrypted = this.decrypt(oldData);
      
      // Re-encrypt with new salt/IV
      return this.encrypt(decrypted);
    }

    /**
     * Validate encrypted data structure
     */
    isValidEncryptedData(data: any): data is EncryptedData {
      return (
        data &&
        typeof data === 'object' &&
        typeof data.encrypted === 'string' &&
        typeof data.salt === 'string' &&
        typeof data.iv === 'string' &&
        typeof data.tag === 'string'
      );
    }

    /**
     * Clear sensitive data from memory
     */
    clearMasterKey(): void {
      if (this.masterKey) {
        // Overwrite the buffer with random data
        randomBytes(this.masterKey.length).copy(this.masterKey);
        this.masterKey = null;
      }
    }
  }

  // Export singleton instance
  const apiKeyEncryption = ApiKeyEncryption.getInstance();

  module.exports = {
    ApiKeyEncryption,
    apiKeyEncryption,
    EncryptedData
  };
}