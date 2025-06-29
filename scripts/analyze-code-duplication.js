#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const SIMILARITY_THRESHOLD = 0.7; // 70% similarity
const MIN_LINES = 10;
const TARGET_AREAS = {
  'API Routes': 'app/api',
  'Stores': 'store',
  'Chart Components': 'components/chart',
  'Auth': ['lib/auth', 'app/(auth)'],
  'Utils': 'lib/utils',
  'Services': 'lib/services',
  'Hooks': 'hooks'
};

// Function to normalize code for comparison
function normalizeCode(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/\/\/.*/g, '') // Remove line comments
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/['"`]/g, '"') // Normalize quotes
    .replace(/\b(const|let|var)\b/g, 'var') // Normalize variable declarations
    .trim();
}

// Function to calculate similarity between two code blocks
function calculateSimilarity(code1, code2) {
  const normalized1 = normalizeCode(code1);
  const normalized2 = normalizeCode(code2);
  
  if (normalized1.length === 0 || normalized2.length === 0) return 0;
  
  // Levenshtein distance-based similarity
  const maxLen = Math.max(normalized1.length, normalized2.length);
  const distance = levenshteinDistance(normalized1, normalized2);
  return 1 - distance / maxLen;
}

// Levenshtein distance calculation
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}

// Function to extract code blocks from a file
function extractCodeBlocks(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const blocks = [];
  
  // Extract functions
  const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  let match;
  while ((match = functionRegex.exec(content)) !== null) {
    const lines = match[0].split('\n').length;
    if (lines >= MIN_LINES) {
      blocks.push({
        name: match[1],
        code: match[0],
        type: 'function',
        lines
      });
    }
  }
  
  // Extract arrow functions
  const arrowFunctionRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  while ((match = arrowFunctionRegex.exec(content)) !== null) {
    const lines = match[0].split('\n').length;
    if (lines >= MIN_LINES) {
      blocks.push({
        name: match[1],
        code: match[0],
        type: 'arrow-function',
        lines
      });
    }
  }
  
  // Extract classes
  const classRegex = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  while ((match = classRegex.exec(content)) !== null) {
    const lines = match[0].split('\n').length;
    if (lines >= MIN_LINES) {
      blocks.push({
        name: match[1],
        code: match[0],
        type: 'class',
        lines
      });
    }
  }
  
  return blocks;
}

// Function to recursively find all TypeScript files
function findTypeScriptFiles(dir, excludePatterns = ['node_modules', '.next', 'dist', 'build', '.test.', '.spec.']) {
  const files = [];
  
  function traverse(currentPath) {
    if (excludePatterns.some(pattern => currentPath.includes(pattern))) {
      return;
    }
    
    const stats = fs.statSync(currentPath);
    if (stats.isDirectory()) {
      const entries = fs.readdirSync(currentPath);
      for (const entry of entries) {
        traverse(path.join(currentPath, entry));
      }
    } else if (stats.isFile() && currentPath.endsWith('.ts') || currentPath.endsWith('.tsx')) {
      files.push(currentPath);
    }
  }
  
  if (Array.isArray(dir)) {
    dir.forEach(d => traverse(d));
  } else {
    traverse(dir);
  }
  
  return files;
}

// Main analysis function
function analyzeArea(areaName, areaPath) {
  console.log(`\n=== Analyzing ${areaName} ===`);
  
  const files = findTypeScriptFiles(areaPath);
  const allBlocks = [];
  
  // Extract code blocks from all files
  for (const file of files) {
    try {
      const blocks = extractCodeBlocks(file);
      blocks.forEach(block => {
        block.file = file;
        allBlocks.push(block);
      });
    } catch (error) {
      console.error(`Error processing ${file}: ${error.message}`);
    }
  }
  
  // Find duplicates
  const duplicates = [];
  for (let i = 0; i < allBlocks.length; i++) {
    for (let j = i + 1; j < allBlocks.length; j++) {
      const similarity = calculateSimilarity(allBlocks[i].code, allBlocks[j].code);
      if (similarity >= SIMILARITY_THRESHOLD) {
        duplicates.push({
          similarity: Math.round(similarity * 100),
          block1: {
            name: allBlocks[i].name,
            file: allBlocks[i].file,
            type: allBlocks[i].type,
            lines: allBlocks[i].lines
          },
          block2: {
            name: allBlocks[j].name,
            file: allBlocks[j].file,
            type: allBlocks[j].type,
            lines: allBlocks[j].lines
          }
        });
      }
    }
  }
  
  return {
    area: areaName,
    filesAnalyzed: files.length,
    blocksFound: allBlocks.length,
    duplicatesFound: duplicates.length,
    duplicates: duplicates.sort((a, b) => b.similarity - a.similarity)
  };
}

// Main execution
console.log('🔍 Code Duplication Analysis');
console.log(`Threshold: ${SIMILARITY_THRESHOLD * 100}%`);
console.log(`Minimum lines: ${MIN_LINES}`);

const results = [];
for (const [areaName, areaPath] of Object.entries(TARGET_AREAS)) {
  try {
    const result = analyzeArea(areaName, areaPath);
    results.push(result);
    
    if (result.duplicatesFound > 0) {
      console.log(`Found ${result.duplicatesFound} duplicates`);
      result.duplicates.slice(0, 5).forEach(dup => {
        console.log(`  - ${dup.similarity}% similarity:`);
        console.log(`    ${dup.block1.name} (${dup.block1.file})`);
        console.log(`    ${dup.block2.name} (${dup.block2.file})`);
      });
    } else {
      console.log('No significant duplicates found');
    }
  } catch (error) {
    console.error(`Error analyzing ${areaName}: ${error.message}`);
  }
}

// Generate report
const report = {
  timestamp: new Date().toISOString(),
  configuration: {
    threshold: SIMILARITY_THRESHOLD,
    minLines: MIN_LINES
  },
  results,
  summary: {
    totalAreas: results.length,
    totalFiles: results.reduce((sum, r) => sum + r.filesAnalyzed, 0),
    totalBlocks: results.reduce((sum, r) => sum + r.blocksFound, 0),
    totalDuplicates: results.reduce((sum, r) => sum + r.duplicatesFound, 0)
  }
};

// Save report
fs.writeFileSync('reports/code-duplication-analysis.json', JSON.stringify(report, null, 2));

console.log('\n📊 Summary:');
console.log(`- Areas analyzed: ${report.summary.totalAreas}`);
console.log(`- Files analyzed: ${report.summary.totalFiles}`);
console.log(`- Code blocks found: ${report.summary.totalBlocks}`);
console.log(`- Duplicates found: ${report.summary.totalDuplicates}`);
console.log('\nFull report saved to reports/code-duplication-analysis.json');