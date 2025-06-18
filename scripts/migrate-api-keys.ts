#!/usr/bin/env tsx

/**
 * API Key Migration Script
 * 
 * Migrates plaintext API keys from environment variables to secure encrypted storage
 */

import { apiKeyManager, type ApiKeyProvider } from '@/lib/security/api-key-manager';
import { logger } from '@/lib/utils/logger';
import { env } from '@/config/env';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
};

interface MigrationResult {
  provider: ApiKeyProvider;
  status: 'success' | 'failed' | 'skipped';
  message: string;
  keyId?: string;
}

async function migrateApiKeys() {
  console.log('🔐 API Key Migration Tool');
  console.log('========================\n');
  console.log('This tool will help you migrate your API keys from plaintext environment variables');
  console.log('to secure encrypted storage.\n');

  const results: MigrationResult[] = [];

  // Check for existing API keys in environment
  const providers: Array<{ provider: ApiKeyProvider; envVar: string; currentValue: string | undefined }> = [
    { provider: 'openai', envVar: 'OPENAI_API_KEY', currentValue: env.OPENAI_API_KEY },
    { provider: 'anthropic', envVar: 'ANTHROPIC_API_KEY', currentValue: env.ANTHROPIC_API_KEY },
    { provider: 'supabase', envVar: 'SUPABASE_SERVICE_ROLE_KEY', currentValue: env.SUPABASE_SERVICE_ROLE_KEY },
    { provider: 'telemetry', envVar: 'TELEMETRY_API_KEY', currentValue: env.TELEMETRY_API_KEY },
  ];

  console.log('Found the following API keys in your environment:\n');
  
  for (const { provider, envVar, currentValue } of providers) {
    if (currentValue && currentValue !== 'browser-env-not-available') {
      console.log(`✓ ${envVar}: ${currentValue.substring(0, 8)}...${currentValue.substring(currentValue.length - 4)}`);
    } else {
      console.log(`✗ ${envVar}: Not found`);
    }
  }

  console.log('\n');
  const proceed = await question('Do you want to migrate these keys to secure storage? (yes/no): ');

  if (proceed.toLowerCase() !== 'yes') {
    console.log('\nMigration cancelled.');
    rl.close();
    return;
  }

  console.log('\nStarting migration...\n');

  // Initialize API key manager
  await apiKeyManager.initialize();

  for (const { provider, envVar, currentValue } of providers) {
    if (!currentValue || currentValue === 'browser-env-not-available') {
      results.push({
        provider,
        status: 'skipped',
        message: 'No key found in environment',
      });
      continue;
    }

    try {
      // Check if key is valid format
      if (!apiKeyManager.validateApiKeyFormat(provider, currentValue)) {
        console.log(`⚠️  Warning: ${envVar} appears to have an invalid format`);
        const confirmMigrate = await question(`Do you still want to migrate this key? (yes/no): `);
        if (confirmMigrate.toLowerCase() !== 'yes') {
          results.push({
            provider,
            status: 'skipped',
            message: 'Invalid format - skipped by user',
          });
          continue;
        }
      }

      // Store the key securely
      console.log(`🔄 Migrating ${provider} API key...`);
      const keyId = await apiKeyManager.storeApiKey(provider, currentValue, {
        source: 'migration-script',
        migratedAt: new Date().toISOString(),
        originalEnvVar: envVar,
      });

      results.push({
        provider,
        status: 'success',
        message: 'Successfully migrated to secure storage',
        keyId,
      });

      console.log(`✅ ${provider} API key migrated successfully (ID: ${keyId})`);
    } catch (error) {
      results.push({
        provider,
        status: 'failed',
        message: String(error),
      });
      console.error(`❌ Failed to migrate ${provider} API key: ${error}`);
    }
  }

  // Display migration summary
  console.log('\n📊 Migration Summary');
  console.log('===================\n');

  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);

  if (successful > 0) {
    console.log('\n📝 Next Steps:');
    console.log('1. Update your .env file to remove the migrated API keys');
    console.log('2. Update your application code to use the secure API key manager');
    console.log('3. Test your application to ensure everything works correctly');
    console.log('\nExample code update:');
    console.log('```typescript');
    console.log('// Before:');
    console.log('const apiKey = env.OPENAI_API_KEY;');
    console.log('');
    console.log('// After:');
    console.log('import { apiKeyManager } from "@/lib/security/api-key-manager";');
    console.log('const apiKey = await apiKeyManager.getApiKey("openai");');
    console.log('```');
  }

  // Create migration report
  const report = {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      successful,
      failed,
      skipped,
      total: results.length,
    },
  };

  // Save report
  const fs = await import('fs/promises');
  const reportPath = `migration-report-${Date.now()}.json`;
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Migration report saved to: ${reportPath}`);

  rl.close();
  process.exit(0);
}

// Run migration
migrateApiKeys().catch((error) => {
  console.error('Migration failed:', error);
  rl.close();
  process.exit(1);
});