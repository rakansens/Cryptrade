#!/usr/bin/env node

/**
 * Vitest to Jest Conversion Script
 * 
 * 14個のVitestテストファイルを一括でJestに変換するスクリプト
 */

const fs = require('fs');
const path = require('path');

const VITEST_FILES = [
  'tests/unit/lib/mastra/agents/orchestrator.agent.test.ts',
  'tests/unit/lib/mastra/tools/proposal-generation/utils/helpers.test.ts',
  'tests/unit/lib/logging/helpers.test.ts',
  'tests/unit/lib/utils/client-env.test.ts',
  'tests/unit/lib/utils/chart-data.test.ts',
  'tests/unit/lib/utils/sse.test.ts',
  'tests/unit/lib/utils/api-cache.test.ts',
  'tests/unit/lib/utils/db-conversions.server.test.ts',
  'tests/unit/lib/utils/logger-enhanced.test.ts',
  'tests/unit/lib/utils/db-connection.test.ts',
  'tests/unit/lib/utils/drawing-queue.test.ts',
  'tests/unit/lib/utils/db-conversions.test.ts',
  'tests/unit/lib/utils/ui-event-dispatcher.test.ts'
];

function convertVitestToJest(fileContent) {
  let content = fileContent;
  
  // Remove vitest imports
  content = content.replace(
    /import\s+{[^}]*}\s+from\s+['"]vitest['"];?\n?/g,
    ''
  );
  
  // Convert vi.mock to jest.mock
  content = content.replace(/vi\.mock\(/g, 'jest.mock(');
  
  // Convert vi.fn() to jest.fn()
  content = content.replace(/vi\.fn\(\)/g, 'jest.fn()');
  
  // Convert vi.clearAllMocks() to jest.clearAllMocks()
  content = content.replace(/vi\.clearAllMocks\(\)/g, 'jest.clearAllMocks()');
  
  // Convert vi.spyOn to jest.spyOn
  content = content.replace(/vi\.spyOn\(/g, 'jest.spyOn(');
  
  // Convert vi.requireActual to jest.requireActual
  content = content.replace(/vi\.requireActual\(/g, 'jest.requireActual(');
  
  // Convert vi.mocked to jest.mocked
  content = content.replace(/vi\.mocked\(/g, 'jest.mocked(');
  
  // Convert vi.resetAllMocks to jest.resetAllMocks
  content = content.replace(/vi\.resetAllMocks\(\)/g, 'jest.resetAllMocks()');
  
  // Convert vi.restoreAllMocks to jest.restoreAllMocks
  content = content.replace(/vi\.restoreAllMocks\(\)/g, 'jest.restoreAllMocks()');
  
  // Convert vi.unstubAllEnvs to process.env cleanup (Jest doesn't have exact equivalent)
  content = content.replace(/vi\.unstubAllEnvs\(\)/g, '// No Jest equivalent for vi.unstubAllEnvs()');
  
  return content;
}

async function main() {
  console.log('🔄 Converting Vitest tests to Jest...\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const filePath of VITEST_FILES) {
    try {
      const fullPath = path.resolve(filePath);
      
      if (!fs.existsSync(fullPath)) {
        console.log(`⚠️  File not found: ${filePath}`);
        continue;
      }
      
      const content = fs.readFileSync(fullPath, 'utf8');
      const convertedContent = convertVitestToJest(content);
      
      // Backup original file
      fs.writeFileSync(`${fullPath}.bak`, content);
      
      // Write converted content
      fs.writeFileSync(fullPath, convertedContent);
      
      console.log(`✅ Converted: ${filePath}`);
      successCount++;
      
    } catch (error) {
      console.error(`❌ Error converting ${filePath}:`, error.message);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Conversion complete:`);
  console.log(`   ✅ Success: ${successCount} files`);
  console.log(`   ❌ Errors: ${errorCount} files`);
  
  if (successCount > 0) {
    console.log('\n🧪 Running test to verify conversion...');
    console.log('Run: npm test -- --passWithNoTests');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { convertVitestToJest }; 