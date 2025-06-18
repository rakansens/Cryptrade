#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('📸 UI Snapshot Test Analysis');
console.log('===========================\n');

// Find all snapshot files
const snapshotDir = path.join(__dirname, '..', 'tests', 'regression', '__snapshots__');
const snapshotFiles = [];

try {
  const files = fs.readdirSync(snapshotDir);
  files.forEach(file => {
    if (file.endsWith('.snap')) {
      snapshotFiles.push(path.join(snapshotDir, file));
    }
  });
} catch (error) {
  console.error('Error reading snapshot directory:', error.message);
}

console.log(`Found ${snapshotFiles.length} snapshot files:\n`);

// Analyze each snapshot file
const componentSnapshots = {};

snapshotFiles.forEach(file => {
  console.log(`📄 ${path.basename(file)}`);
  
  try {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.match(/exports\[`(.+?)`\]/g);
    
    if (matches) {
      matches.forEach(match => {
        const testName = match.match(/exports\[`(.+?)`\]/)[1];
        const componentMatch = testName.match(/should match (\w+) snapshot/);
        
        if (componentMatch) {
          const component = componentMatch[1];
          if (!componentSnapshots[component]) {
            componentSnapshots[component] = {
              file: path.basename(file),
              tests: []
            };
          }
          componentSnapshots[component].tests.push(testName);
        }
      });
    }
  } catch (error) {
    console.error(`  Error reading file: ${error.message}`);
  }
});

// Check for test files
const testFiles = [
  'tests/regression/components/orphaned-components.regression.test.tsx',
  'tests/regression/api/types.regression.test.ts',
  'tests/regression/api/routes.regression.test.ts',
  'tests/regression/lib/mastra-tools.regression.test.ts'
];

console.log('\n📋 Test Files Status:');
testFiles.forEach(testFile => {
  const fullPath = path.join(__dirname, '..', testFile);
  const exists = fs.existsSync(fullPath);
  console.log(`${exists ? '✅' : '❌'} ${testFile}`);
});

// Summary
console.log('\n📊 Component Snapshot Summary:');
console.log('=============================');

const components = Object.keys(componentSnapshots);
if (components.length > 0) {
  components.forEach(component => {
    const info = componentSnapshots[component];
    console.log(`\n🧩 ${component}`);
    console.log(`   File: ${info.file}`);
    console.log(`   Tests: ${info.tests.length}`);
  });
} else {
  console.log('No component snapshots found in analysis');
}

// Check snapshot age
console.log('\n⏰ Snapshot Age:');
snapshotFiles.forEach(file => {
  try {
    const stats = fs.statSync(file);
    const age = Date.now() - stats.mtimeMs;
    const days = Math.floor(age / (1000 * 60 * 60 * 24));
    const hours = Math.floor((age % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    console.log(`${path.basename(file)}: ${days} days, ${hours} hours old`);
  } catch (error) {
    console.error(`Error checking file age: ${error.message}`);
  }
});

// Create summary report
const summary = {
  timestamp: new Date().toISOString(),
  snapshotFiles: snapshotFiles.length,
  components: Object.keys(componentSnapshots),
  testFiles: testFiles.filter(f => fs.existsSync(path.join(__dirname, '..', f))).length,
  recommendation: 'スナップショットテストの実行には環境セットアップが必要です'
};

fs.writeFileSync(
  path.join(__dirname, '..', 'snapshot-analysis.json'),
  JSON.stringify(summary, null, 2)
);

// Japanese summary
console.log('\n📝 日本語サマリー (100-200文字)');
console.log('================================');
const componentsText = components.length > 0 ? components.join('、') : 'なし';
console.log(`UIコンポーネント（${componentsText}）のスナップショットテストを確認。${snapshotFiles.length}個のスナップショットファイルが存在。視覚的変更の検出には実行環境の修正が必要。`);