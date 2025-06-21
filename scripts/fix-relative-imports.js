#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// パターンとその置換
const replacements = [
  // hooks imports
  { from: /from ['"]\.\.\/\.\.\/\.\.\/hooks\//g, to: "from '@/hooks/" },
  { from: /from ['"]\.\.\/\.\.\/hooks\//g, to: "from '@/hooks/" },
  { from: /from ['"]\.\.\/hooks\//g, to: "from '@/hooks/" },
  
  // components imports
  { from: /from ['"]\.\.\/\.\.\/\.\.\/components\//g, to: "from '@/components/" },
  { from: /from ['"]\.\.\/\.\.\/components\//g, to: "from '@/components/" },
  { from: /from ['"]\.\.\/components\//g, to: "from '@/components/" },
  
  // lib imports
  { from: /from ['"]\.\.\/\.\.\/\.\.\/lib\//g, to: "from '@/lib/" },
  { from: /from ['"]\.\.\/\.\.\/lib\//g, to: "from '@/lib/" },
  { from: /from ['"]\.\.\/lib\//g, to: "from '@/lib/" },
  
  // store imports
  { from: /from ['"]\.\.\/\.\.\/\.\.\/store\//g, to: "from '@/store/" },
  { from: /from ['"]\.\.\/\.\.\/store\//g, to: "from '@/store/" },
  { from: /from ['"]\.\.\/store\//g, to: "from '@/store/" },
  
  // types imports
  { from: /from ['"]\.\.\/\.\.\/\.\.\/types\//g, to: "from '@/types/" },
  { from: /from ['"]\.\.\/\.\.\/types\//g, to: "from '@/types/" },
  { from: /from ['"]\.\.\/types\//g, to: "from '@/types/" },
  
  // app imports
  { from: /from ['"]\.\.\/\.\.\/\.\.\/app\//g, to: "from '@/app/" },
  { from: /from ['"]\.\.\/\.\.\/app\//g, to: "from '@/app/" },
  { from: /from ['"]\.\.\/app\//g, to: "from '@/app/" },
];

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
  
  replacements.forEach(({ from, to }) => {
    const matches = content.match(from);
    if (matches) {
      content = content.replace(from, to);
      modified = true;
      fileReplacements += matches.length;
    }
  });
  
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