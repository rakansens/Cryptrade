#!/usr/bin/env node

/**
 * Fix @testing-library/react-hooks imports
 * Replace deprecated @testing-library/react-hooks with @testing-library/react
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all test files
const testFiles = glob.sync('**/*.test.{ts,tsx}', {
  ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**']
});

console.log(`Found ${testFiles.length} test files to check...`);

let totalFixed = 0;
const filesFixed = [];

testFiles.forEach(file => {
  const filePath = path.resolve(file);
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Pattern 1: Import statements from @testing-library/react-hooks
  if (content.includes('@testing-library/react-hooks')) {
    // Replace the import
    content = content.replace(
      /import\s*{\s*([^}]+)\s*}\s*from\s*['"]@testing-library\/react-hooks['"]/g,
      "import { $1 } from '@testing-library/react'"
    );
    
    // Also handle default imports
    content = content.replace(
      /import\s+(\w+)\s+from\s*['"]@testing-library\/react-hooks['"]/g,
      "import $1 from '@testing-library/react'"
    );
  }
  
  // Pattern 2: Fix act imports - act should come from react
  content = content.replace(
    /import\s*{\s*([^}]*)\s*act\s*([^}]*)\s*}\s*from\s*['"]@testing-library\/react['"]/g,
    (match, before, after) => {
      const otherImports = (before + after).split(',').filter(i => i.trim() && i.trim() !== ',').map(i => i.trim());
      let result = '';
      
      if (otherImports.length > 0) {
        result += `import { ${otherImports.join(', ')} } from '@testing-library/react';\n`;
      }
      result += `import { act } from 'react';`;
      
      return result;
    }
  );
  
  // Pattern 3: Ensure renderHook is imported correctly
  if (content.includes('renderHook') && !content.includes("from '@testing-library/react'")) {
    // Add import if missing
    const importMatch = content.match(/import\s*{\s*([^}]+)\s*}\s*from\s*['"]@testing-library\/[^'"]+['"]/);
    if (importMatch) {
      // Add to existing import
      const [fullMatch, imports] = importMatch;
      if (!imports.includes('renderHook')) {
        content = content.replace(fullMatch, fullMatch.replace(imports, `${imports}, renderHook`));
      }
    }
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    totalFixed++;
    filesFixed.push(file);
    console.log(`✓ Fixed imports in ${file}`);
  }
});

console.log(`\nFixed ${totalFixed} files total`);
if (filesFixed.length > 0) {
  console.log('\nFiles fixed:');
  filesFixed.forEach(file => console.log(`  - ${file}`));
}