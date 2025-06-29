#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Extract functions from TypeScript code
function extractFunctions(content, filePath) {
  const functions = [];
  
  // Regular expressions for different function patterns
  const patterns = [
    // Regular functions
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g,
    // Arrow functions
    /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>\s*\{/g,
    // Class methods
    /(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g
  ];
  
  for (const pattern of patterns) {
    let match;
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(content)) !== null) {
      const startIndex = match.index;
      const functionName = match[1];
      
      // Extract the function body by counting braces
      let braceCount = 0;
      let inString = false;
      let stringChar = '';
      let endIndex = content.indexOf('{', startIndex);
      
      if (endIndex === -1) continue;
      
      for (let i = endIndex; i < content.length; i++) {
        const char = content[i];
        const prevChar = i > 0 ? content[i - 1] : '';
        
        // Handle strings
        if (!inString && (char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
          inString = true;
          stringChar = char;
        } else if (inString && char === stringChar && prevChar !== '\\') {
          inString = false;
        }
        
        // Count braces outside of strings
        if (!inString) {
          if (char === '{') braceCount++;
          else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              endIndex = i + 1;
              break;
            }
          }
        }
      }
      
      const functionBody = content.substring(startIndex, endIndex);
      const lines = functionBody.split('\n').length;
      
      if (lines >= 10) {
        functions.push({
          name: functionName,
          body: functionBody,
          lines,
          file: filePath,
          hash: crypto.createHash('md5').update(normalizeCode(functionBody)).digest('hex')
        });
      }
    }
  }
  
  return functions;
}

// Normalize code for comparison
function normalizeCode(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/\/\/.*/g, '') // Remove line comments
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/['"`]/g, '"') // Normalize quotes
    .trim();
}

// Calculate similarity between two functions
function calculateSimilarity(func1, func2) {
  const norm1 = normalizeCode(func1.body);
  const norm2 = normalizeCode(func2.body);
  
  // Token-based similarity
  const tokens1 = norm1.split(/\s+/);
  const tokens2 = norm2.split(/\s+/);
  
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

// Find TypeScript files
function findTypeScriptFiles(dir) {
  const files = [];
  
  function traverse(currentPath) {
    if (currentPath.includes('node_modules') || 
        currentPath.includes('.next') || 
        currentPath.includes('dist')) {
      return;
    }
    
    try {
      const stats = fs.statSync(currentPath);
      if (stats.isDirectory()) {
        const entries = fs.readdirSync(currentPath);
        for (const entry of entries) {
          traverse(path.join(currentPath, entry));
        }
      } else if (stats.isFile() && (currentPath.endsWith('.ts') || currentPath.endsWith('.tsx'))) {
        files.push(currentPath);
      }
    } catch (error) {
      // Skip inaccessible files
    }
  }
  
  traverse(dir);
  return files;
}

console.log('🔍 Finding Similar Functions\n');

const directories = {
  'API Routes': 'app/api',
  'Services': 'lib/services',
  'Stores': 'store',
  'Hooks': 'hooks',
  'Utils': 'lib/utils'
};

const allFunctions = [];
const results = [];

// Extract all functions
for (const [area, dir] of Object.entries(directories)) {
  console.log(`Analyzing ${area}...`);
  const files = findTypeScriptFiles(dir);
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const functions = extractFunctions(content, file);
      functions.forEach(func => {
        func.area = area;
        allFunctions.push(func);
      });
    } catch (error) {
      // Skip files with errors
    }
  }
}

console.log(`\nFound ${allFunctions.length} functions total\n`);

// Find similar functions
const similarPairs = [];
const processedPairs = new Set();

for (let i = 0; i < allFunctions.length; i++) {
  for (let j = i + 1; j < allFunctions.length; j++) {
    const func1 = allFunctions[i];
    const func2 = allFunctions[j];
    
    // Skip if same file
    if (func1.file === func2.file) continue;
    
    // Create pair key
    const pairKey = [func1.hash, func2.hash].sort().join('-');
    if (processedPairs.has(pairKey)) continue;
    processedPairs.add(pairKey);
    
    const similarity = calculateSimilarity(func1, func2);
    
    if (similarity >= 0.7) {
      similarPairs.push({
        similarity: Math.round(similarity * 100),
        func1: {
          name: func1.name,
          file: func1.file,
          lines: func1.lines,
          area: func1.area
        },
        func2: {
          name: func2.name,
          file: func2.file,
          lines: func2.lines,
          area: func2.area
        }
      });
    }
  }
}

// Sort by similarity
similarPairs.sort((a, b) => b.similarity - a.similarity);

console.log('Top Similar Functions:');
console.log('====================\n');

similarPairs.slice(0, 20).forEach((pair, index) => {
  console.log(`${index + 1}. ${pair.similarity}% similarity`);
  console.log(`   ${pair.func1.name} (${pair.func1.lines} lines)`);
  console.log(`   ${pair.func1.file}`);
  console.log(`   ---`);
  console.log(`   ${pair.func2.name} (${pair.func2.lines} lines)`);
  console.log(`   ${pair.func2.file}`);
  console.log('');
});

// Group by area
const areaStats = {};
for (const pair of similarPairs) {
  const key = `${pair.func1.area}-${pair.func2.area}`;
  if (!areaStats[key]) {
    areaStats[key] = { count: 0, totalLines: 0 };
  }
  areaStats[key].count++;
  areaStats[key].totalLines += pair.func1.lines + pair.func2.lines;
}

console.log('\nDuplication by Area:');
console.log('===================\n');

Object.entries(areaStats)
  .sort((a, b) => b[1].count - a[1].count)
  .forEach(([areas, stats]) => {
    console.log(`${areas}: ${stats.count} similar pairs (~${stats.totalLines} lines affected)`);
  });

// Save detailed report
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    totalFunctions: allFunctions.length,
    similarPairs: similarPairs.length,
    averageSimilarity: similarPairs.length > 0 
      ? Math.round(similarPairs.reduce((sum, p) => sum + p.similarity, 0) / similarPairs.length)
      : 0
  },
  topSimilarFunctions: similarPairs.slice(0, 50),
  areaStatistics: areaStats,
  recommendations: [
    {
      area: 'Cross-area duplication',
      description: 'Functions duplicated across different modules',
      priority: 'High'
    },
    {
      area: 'Same-area duplication',
      description: 'Similar functions within the same module',
      priority: 'Medium'
    }
  ]
};

fs.writeFileSync('reports/similar-functions-analysis.json', JSON.stringify(report, null, 2));
console.log('\n✅ Detailed report saved to reports/similar-functions-analysis.json');