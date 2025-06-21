#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// テストファイルを検索
const testFiles = glob.sync('tests/**/*.{test,spec}.{ts,tsx,js,jsx}', {
  ignore: ['**/node_modules/**']
});

console.log(`Found ${testFiles.length} test files to process...`);

let totalReplacements = 0;
let filesModified = 0;

testFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let fileReplacements = 0;
  
  // Pattern 1: jest.mocked(someModule).mockMethod -> (someModule as jest.Mock).mockMethod
  const pattern1 = /jest\.mocked\(([^)]+)\)\.mock/g;
  const matches1 = content.match(pattern1);
  if (matches1) {
    content = content.replace(pattern1, '($1 as jest.Mock).mock');
    modified = true;
    fileReplacements += matches1.length;
  }
  
  // Pattern 2: expect(jest.mocked(someModule)) -> expect(someModule as jest.Mock)
  const pattern2 = /expect\(jest\.mocked\(([^)]+)\)\)/g;
  const matches2 = content.match(pattern2);
  if (matches2) {
    content = content.replace(pattern2, 'expect($1 as jest.Mock)');
    modified = true;
    fileReplacements += matches2.length;
  }
  
  // Pattern 3: const something = jest.mocked(someModule) -> const something = someModule as jest.Mock
  const pattern3 = /=\s*jest\.mocked\(([^)]+)\)/g;
  const matches3 = content.match(pattern3);
  if (matches3) {
    content = content.replace(pattern3, '= $1 as jest.Mock');
    modified = true;
    fileReplacements += matches3.length;
  }
  
  // Pattern 4: jest.mocked(someModule.someMethod) -> (someModule.someMethod as jest.Mock)
  const pattern4 = /jest\.mocked\(([^)]+)\)/g;
  const remainingMatches = content.match(pattern4);
  if (remainingMatches) {
    content = content.replace(pattern4, '($1 as jest.Mock)');
    modified = true;
    fileReplacements += remainingMatches.length;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    filesModified++;
    totalReplacements += fileReplacements;
    console.log(`✓ ${path.relative(process.cwd(), filePath)} - ${fileReplacements} replacements`);
  }
});

console.log(`\n✅ Complete!`);
console.log(`- Files modified: ${filesModified}`);
console.log(`- Total replacements: ${totalReplacements}`);