/**
 * API Key Encryption Service (Edge Runtime Compatible)
 * 
 * Provides secure encryption/decryption for API keys and sensitive data
 * using Web Crypto API for Edge Runtime compatibility
 */

import { env } from '@/config/env';

// Encryption configuration
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // GCM recommended IV length
const SALT_LENGTH = 32;

const ITERATIONS = 100000;

export interface EncryptedData {
  encrypted: string;
  salt: string;
  iv: string;
  tag?: string; // Tag is included in encrypted data for Web Crypto API
}

export class ApiKeyEncryption {
  private static instance: ApiKeyEncryption;
  private masterKey: CryptoKey | null = null;

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
  private async initializeMasterKey(): Promise<void> {
    // In production, this should come from a secure key management service
    const secret = env.API_AUTH_SECRET || this.generateSecureSecret();
    
    // Derive a key from the secret using Web Crypto API
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const salt = encoder.encode('api-key-encryption-salt');
    
    this.masterKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Generate a secure random secret
   */
  private generateSecureSecret(): string {
    if (typeof window !== 'undefined') {
      throw new Error('API key encryption should only be used server-side');
    }
    
    // Generate a random 256-bit key
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  }

  /**
   * Ensure master key is initialized
   */
  private async ensureMasterKey(): Promise<CryptoKey> {
    if (!this.masterKey) {
      await this.initializeMasterKey();
    }
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }
    return this.masterKey;
  }

  /**
   * Encrypt an API key or sensitive data
   */
  async encrypt(apiKey: string): Promise<EncryptedData> {
    const masterKey = await this.ensureMasterKey();

    // Generate random salt and IV
    const salt = new Uint8Array(SALT_LENGTH);
    const iv = new Uint8Array(IV_LENGTH);
    crypto.getRandomValues(salt);
    crypto.getRandomValues(iv);

    // Encode the API key
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);

    // Encrypt the data
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: iv
      },
      masterKey,
      data
    );

    // Convert to base64
    const encryptedArray = new Uint8Array(encryptedBuffer);
    
    return {
      encrypted: btoa(String.fromCharCode(...encryptedArray)),
      salt: btoa(String.fromCharCode(...salt)),
      iv: btoa(String.fromCharCode(...iv))
    };
  }

  /**
   * Decrypt an API key or sensitive data
   */
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    const masterKey = await this.ensureMasterKey();

    // Convert from base64
    const encrypted = Uint8Array.from(atob(encryptedData.encrypted), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0));

    // Decrypt the data
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv
      },
      masterKey,
      encrypted
    );

    // Decode the result
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }

  /**
   * Rotate encryption keys (for security best practices)
   */
  async rotateKeys(oldData: EncryptedData): Promise<EncryptedData> {
    // Decrypt with current key
    const decrypted = await this.decrypt(oldData);
    
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
      typeof data.iv === 'string'
    );
  }

  /**
   * Clear sensitive data from memory
   */
  clearMasterKey(): void {
    this.masterKey = null;
  }
}

// Export singleton instance
export const apiKeyEncryption = ApiKeyEncryption.getInstance();