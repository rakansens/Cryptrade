#!/usr/bin/env node

/**
 * Comprehensive script to fix all store test issues
 * - Fixes reset() method calls
 * - Updates imports
 * - Adds proper store reset logic
 */

const fs = require('fs');
const path = require('path');

const STORE_TEST_DIR = path.join(__dirname, '../tests/unit/store');

// Fix patterns
const FIXES = [
  {
    name: 'Fix duplicate getInitialState helpers',
    pattern: /\/\/ Helper to get initial state\s*\n\s*const getInitialState[^}]+\};\s*\n\s*};\s*\n/g,
    replacement: ''
  },
  {
    name: 'Fix store imports in tests',
    pattern: /from\s+['"]\.\/([\w-]+)\.store['"]/g,
    replacement: "from '@/store/$1.store'"
  },
  {
    name: 'Add reset-stores import',
    beforePattern: /describe\(['"][\w\s:]+Store/,
    addBefore: "import { resetAllStores } from '@/tests/setup/reset-stores';\n\n",
    skipIfExists: /import.*resetAllStores/
  },
  {
    name: 'Replace manual store reset with resetAllStores',
    pattern: /beforeEach\(\(\)\s*=>\s*\{[\s\S]*?(?:reset\(\)|setState\(\{[\s\S]*?\}\))[\s\S]*?\}\);/g,
    replacement: `beforeEach(() => {
    jest.clearAllMocks();
    resetAllStores();
  });`
  },
  {
    name: 'Fix getInitialState references',
    pattern: /(\w+Store)\.getInitialState\(\)/g,
    replacement: (match, storeName) => {
      // Return proper initial state based on store name
      const stateMap = {
        'useUIEventStore': '{ subscribers: new Map(), eventQueue: [] }',
        'useProposalApprovalStore': '{ approvedProposals: new Map(), pendingProposals: new Map(), approvedDrawingIds: new Set(), rejectedProposals: new Map() }',
        'useMarketStoreBase': '{ currentPrices: {}, priceChanges: {}, tickers: {}, candlestickData: {}, orderbook: {}, trades: [], stats24hr: {}, isConnected: false, error: null, lastUpdate: 0, subscriptions: new Set(), candleUpdates: new Map(), wsInstance: null }',
        'useChatStoreBase': '{ messages: [], currentSessionId: null, isTyping: false, error: null, typingIndicator: false, scrollPosition: 0, inputValue: "", isInitialized: false }'
      };
      return stateMap[storeName] || '{}';
    }
  }
];

function fixTestFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const fixes = [];

  // Apply fixes
  FIXES.forEach(fix => {
    if (fix.beforePattern && fix.addBefore) {
      // Check if we should skip
      if (fix.skipIfExists && fix.skipIfExists.test(content)) {
        return;
      }
      
      // Add before pattern
      if (fix.beforePattern.test(content) && !content.includes(fix.addBefore.trim())) {
        content = content.replace(fix.beforePattern, fix.addBefore + '$&');
        modified = true;
        fixes.push(fix.name);
      }
    } else if (fix.pattern) {
      const originalContent = content;
      content = content.replace(fix.pattern, fix.replacement);
      
      if (content !== originalContent) {
        modified = true;
        fixes.push(fix.name);
      }
    }
  });

  // Special handling for specific files
  const fileName = path.basename(filePath);
  
  // Fix store-specific issues
  if (fileName === 'store-integration.test.ts') {
    // Fix the specific setState calls
    content = content.replace(
      /useUIEventStore\.setState\(useUIEventStore\.getInitialState\(\)\)/g,
      'useUIEventStore.setState({ subscribers: new Map(), eventQueue: [] })'
    );
    content = content.replace(
      /useProposalApprovalStore\.setState\(useProposalApprovalStore\.getInitialState\(\)\)/g,
      'useProposalApprovalStore.setState({ approvedProposals: new Map(), pendingProposals: new Map(), approvedDrawingIds: new Set(), rejectedProposals: new Map() })'
    );
    modified = true;
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
      if (fixTestFile(filePath)) {
        totalFixed++;
      }
    }
  });

  return totalFixed;
}

console.log('🔧 Fixing all store tests...\n');

const totalFixed = processDirectory(STORE_TEST_DIR);

console.log(`\n✨ Fixed ${totalFixed} test files!`);

if (totalFixed > 0) {
  console.log('\n📝 Next steps:');
  console.log('1. Review the changes');
  console.log('2. Run: npm test -- tests/unit/store');
  console.log('3. Fix any remaining issues manually');
}