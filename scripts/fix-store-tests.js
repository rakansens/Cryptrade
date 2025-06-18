#!/usr/bin/env node

/**
 * Script to fix common issues in store tests
 * - Fixes reset() method calls
 * - Updates store initialization patterns
 * - Fixes hook usage in tests
 */

const fs = require('fs');
const path = require('path');

const STORE_TEST_DIR = path.join(__dirname, '../tests/unit/store');

// Patterns to detect and fix
const FIXES = [
  {
    name: 'Fix reset() calls for stores without reset method',
    pattern: /(\w+Store)\.getState\(\)\.reset\(\)/g,
    replacement: (match, storeName) => {
      // List of stores that have reset method
      const storesWithReset = ['useChartBaseStore', 'useChartRangeStore', 'useChatUIStore'];
      
      if (storesWithReset.includes(storeName)) {
        return match; // Keep as is
      }
      
      // For stores without reset, return setState with initial state
      return `${storeName}.setState(${storeName}.getInitialState())`;
    }
  },
  {
    name: 'Fix store initialization in beforeEach',
    pattern: /act\(\(\) => \{\s*\/\/ Reset stores before each test\s*([\s\S]*?)\s*\}\);/g,
    replacement: (match, content) => {
      // Check if it contains reset calls
      if (content.includes('.reset()')) {
        const updatedContent = content.replace(
          /(\w+Store)\.getState\(\)\.reset\(\)/g,
          (m, store) => {
            const storesWithReset = ['useChartBaseStore', 'useChartRangeStore', 'useChatUIStore'];
            if (storesWithReset.includes(store)) {
              return m;
            }
            return `// Reset ${store}\n      const initial${store}State = ${store}.getInitialState();\n      ${store}.setState(initial${store}State)`;
          }
        );
        return `act(() => {\n      // Reset stores before each test\n      ${updatedContent}\n    })`;
      }
      return match;
    }
  },
  {
    name: 'Add getInitialState helper for stores',
    pattern: /describe\(['"](.+?)['"],\s*\(\)\s*=>\s*\{/g,
    replacement: (match, testName) => {
      if (testName.includes('Store')) {
        return `${match}\n  // Helper to get initial state\n  const getInitialState = (store) => {\n    const state = store.getState();\n    const initialState = {};\n    for (const key in state) {\n      if (typeof state[key] !== 'function') {\n        initialState[key] = state[key];\n      }\n    }\n    return initialState;\n  };\n`;
      }
      return match;
    }
  },
  {
    name: 'Fix direct store.reset() calls',
    pattern: /(\w+)\.reset\(\)/g,
    replacement: (match, storeName) => {
      // Check if it's likely a store variable
      if (storeName.includes('store') || storeName.includes('Store')) {
        return `${storeName}.setState(${storeName}.getInitialState ? ${storeName}.getInitialState() : {})`;
      }
      return match;
    }
  },
  {
    name: 'Fix setState calls with functions',
    pattern: /setState\(state => \{([^}]+)\}\)/g,
    replacement: (match, content) => {
      // Check if it returns a new state
      if (!content.includes('return')) {
        return `setState((state) => ({\n      ...state,${content}\n    }))`;
      }
      return match;
    }
  }
];

function fixStoreTest(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const fixes = [];

  FIXES.forEach(fix => {
    const originalContent = content;
    content = content.replace(fix.pattern, fix.replacement);
    
    if (content !== originalContent) {
      modified = true;
      fixes.push(fix.name);
    }
  });

  // Additional specific fixes for common patterns
  
  // Fix missing imports
  if (content.includes('act(') && !content.includes('import { act')) {
    content = content.replace(
      /import\s*{([^}]+)}\s*from\s*['"]@testing-library\/react['"]/,
      (match, imports) => {
        if (!imports.includes('act')) {
          return match.replace('{', '{ act, ');
        }
        return match;
      }
    );
    modified = true;
    fixes.push('Added missing act import');
  }

  // Fix store cleanup in afterEach
  if (content.includes('afterEach(') && !content.includes('jest.clearAllMocks()')) {
    content = content.replace(
      /afterEach\(\(\)\s*=>\s*\{/g,
      'afterEach(() => {\n    jest.clearAllMocks();'
    );
    modified = true;
    fixes.push('Added jest.clearAllMocks to afterEach');
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed ${path.basename(filePath)}:`);
    fixes.forEach(fix => console.log(`   - ${fix}`));
  } else {
    console.log(`⏭️  No changes needed for ${path.basename(filePath)}`);
  }

  return modified;
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  let totalFixed = 0;

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      totalFixed += processDirectory(filePath);
    } else if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) {
      if (fixStoreTest(filePath)) {
        totalFixed++;
      }
    }
  });

  return totalFixed;
}

console.log('🔧 Fixing store tests...\n');

const totalFixed = processDirectory(STORE_TEST_DIR);

console.log(`\n✨ Fixed ${totalFixed} test files!`);

if (totalFixed > 0) {
  console.log('\n📝 Next steps:');
  console.log('1. Review the changes');
  console.log('2. Run: npm test -- tests/unit/store');
  console.log('3. Fix any remaining type errors manually');
}