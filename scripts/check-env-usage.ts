#!/usr/bin/env tsx
/**
 * Script to check for direct process.env usage in the codebase
 * and suggest replacements with the centralized env configuration
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const IGNORE_PATTERNS = [
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  'coverage',
  '.env',
  'env.ts',
  'env.test.ts',
  'setupEnvMock.ts',
];

const ALLOWED_DIRECT_ACCESS = [
  'process.env.NODE_ENV', // Often used in conditionals, already handled in env.ts
];

interface EnvUsage {
  file: string;
  line: number;
  text: string;
  variable: string;
}

function shouldIgnoreFile(filePath: string): boolean {
  return IGNORE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function findEnvUsages(dir: string, usages: EnvUsage[] = []): EnvUsage[] {
  const files = readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    
    if (shouldIgnoreFile(filePath)) continue;

    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      findEnvUsages(filePath, usages);
    } else if (file.match(/\.(ts|tsx|js|jsx)$/)) {
      const content = readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Match process.env.VARIABLE_NAME
        const matches = line.matchAll(/process\.env\.([A-Z_]+[A-Z0-9_]*)/g);
        
        for (const match of matches) {
          const fullMatch = match[0];
          const variable = match[1];
          
          // Skip allowed direct access
          if (ALLOWED_DIRECT_ACCESS.includes(fullMatch)) continue;
          
          usages.push({
            file: relative(process.cwd(), filePath),
            line: index + 1,
            text: line.trim(),
            variable: variable || '',
          });
        }
      });
    }
  }
  
  return usages;
}

function suggestReplacement(variable: string): string {
  // Common transformations
  const suggestions: Record<string, string> = {
    'DATABASE_URL': 'env.DATABASE_URL',
    'OPENAI_API_KEY': 'env.OPENAI_API_KEY',
    'ANTHROPIC_API_KEY': 'env.ANTHROPIC_API_KEY',
    'PORT': 'env.PORT',
    'CI': 'env.CI',
    'TEST_PORT': 'env.TEST_PORT',
    'DEMO_MODE': 'env.DEMO_MODE',
    'TZ': 'env.TZ',
  };
  
  return suggestions[variable] || `env.${variable} (add to env.ts schema if missing)`;
}

function main() {
  console.log('🔍 Checking for direct process.env usage...\n');
  
  const usages = findEnvUsages(process.cwd());
  
  if (usages.length === 0) {
    console.log('✅ No direct process.env usage found!');
    return;
  }
  
  console.log(`Found ${usages.length} direct process.env usages:\n`);
  
  // Group by file
  const byFile = usages.reduce((acc, usage) => {
    const file = usage.file;
    if (!acc[file]) acc[file] = [];
    acc[file]!.push(usage);
    return acc;
  }, {} as Record<string, EnvUsage[]>);
  
  for (const [file, fileUsages] of Object.entries(byFile)) {
    console.log(`📄 ${file}:`);
    
    for (const usage of fileUsages) {
      console.log(`  Line ${usage.line}: process.env.${usage.variable}`);
      console.log(`    → Suggest: ${suggestReplacement(usage.variable)}`);
      console.log(`    Code: ${usage.text}`);
      console.log();
    }
  }
  
  console.log('\n📋 Summary:');
  console.log('1. Add missing variables to /config/env.ts schema');
  console.log('2. Import { env } from "@/config/env" in affected files');
  console.log('3. Replace process.env.VARIABLE with env.VARIABLE');
  console.log('4. Run tests to ensure everything works correctly');
}

main();