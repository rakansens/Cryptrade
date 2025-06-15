#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const filesToFix = [
  'tests/unit/lib/ml/streaming-ml-analyzer.test.ts',
  'tests/unit/lib/ws/error-handling.test.ts',
  'tests/unit/lib/ws/message.test.ts',
  'tests/unit/lib/ws/connection.test.ts',
  'tests/unit/lib/ws/reconnect.test.ts',
  'tests/unit/api/stream/route.test.ts',
  'tests/unit/api/events/route.test.ts',
  'tests/integration/ws-binance-integration.test.ts',
  'tests/integration/ai-market-analysis-integration.test.ts',
  'tests/integration/chart-websocket-integration.test.ts',
  'tests/e2e/e2e-advanced.test.ts',
  'tests/e2e/e2e-simple-fixed.test.ts',
  'tests/e2e/e2e.test.ts'
];

const replacements = [
  // WebSocket mock imports
  {
    from: /@\/lib\/ws\/__tests__\/websocket-mock/g,
    to: '@/tests/helpers/websocket-mock'
  },
  // Market analysis mock imports
  {
    from: /@\/lib\/mastra\/tools\/__tests__\/market-analysis-mock/g,
    to: '@/tests/helpers/market-analysis-mock'
  },
  // Remove all other __tests__ imports
  {
    from: /from ['"].*\/__tests__\/.*['"]/g,
    to: (match: string) => {
      // Extract the module name from the import
      const moduleMatch = match.match(/\/__tests__\/([\w-]+)['"]/);
      if (moduleMatch) {
        return `from '@/tests/helpers/${moduleMatch[1]}'`;
      }
      return match;
    }
  }
];

console.log('🔧 Fixing test imports...\n');

filesToFix.forEach(file => {
  const filePath = join(process.cwd(), file);
  
  try {
    let content = readFileSync(filePath, 'utf-8');
    let modified = false;
    
    replacements.forEach(({ from, to }) => {
      const newContent = typeof to === 'string' 
        ? content.replace(from, to)
        : content.replace(from, to);
      
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });
    
    if (modified) {
      writeFileSync(filePath, content, 'utf-8');
      console.log(`✅ Fixed imports in ${file}`);
    } else {
      console.log(`✓ No changes needed in ${file}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error);
  }
});

console.log('\n✨ Import fixes complete!');