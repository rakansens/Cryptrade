#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

// Configuration
const PATTERN_SIMILARITY_THRESHOLD = 0.7;
const MIN_STATEMENTS = 5;

// Pattern types to analyze
const PATTERNS_TO_ANALYZE = {
  'Error Handling': {
    detect: (path) => {
      return path.isTryStatement() || 
             (path.isCallExpression() && path.node.callee.name === 'catch');
    }
  },
  'API Response Handling': {
    detect: (path) => {
      return path.isCallExpression() && 
             path.node.callee.type === 'MemberExpression' &&
             (path.node.callee.object.name === 'res' || 
              path.node.callee.object.name === 'response');
    }
  },
  'State Updates': {
    detect: (path) => {
      return path.isCallExpression() && 
             (path.node.callee.name === 'setState' || 
              path.node.callee.name === 'dispatch' ||
              (path.node.callee.type === 'MemberExpression' && 
               path.node.callee.property.name === 'setState'));
    }
  },
  'Data Fetching': {
    detect: (path) => {
      return path.isCallExpression() && 
             (path.node.callee.name === 'fetch' || 
              path.node.callee.name === 'axios' ||
              (path.node.callee.type === 'MemberExpression' && 
               ['get', 'post', 'put', 'delete'].includes(path.node.callee.property.name)));
    }
  },
  'WebSocket Handling': {
    detect: (path) => {
      return path.isCallExpression() && 
             path.node.callee.type === 'MemberExpression' &&
             (path.node.callee.object.name === 'ws' || 
              path.node.callee.object.name === 'socket' ||
              path.node.callee.property.name === 'emit' ||
              path.node.callee.property.name === 'on');
    }
  },
  'Validation Logic': {
    detect: (path) => {
      return path.isIfStatement() && 
             path.node.test && 
             (path.node.test.type === 'UnaryExpression' && path.node.test.operator === '!' ||
              path.node.test.type === 'BinaryExpression' && ['===', '!==', '<', '>', '<=', '>='].includes(path.node.test.operator));
    }
  },
  'Array Processing': {
    detect: (path) => {
      return path.isCallExpression() && 
             path.node.callee.type === 'MemberExpression' &&
             ['map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every'].includes(path.node.callee.property.name);
    }
  },
  'Async Operations': {
    detect: (path) => {
      return path.isAwaitExpression() || 
             (path.isCallExpression() && path.node.callee.name === 'Promise') ||
             (path.isCallExpression() && path.node.callee.type === 'MemberExpression' && 
              ['then', 'catch', 'finally'].includes(path.node.callee.property.name));
    }
  }
};

// Extract patterns from AST
function extractPatterns(ast, filePath) {
  const patterns = {};
  
  Object.keys(PATTERNS_TO_ANALYZE).forEach(patternType => {
    patterns[patternType] = [];
  });
  
  traverse(ast, {
    enter(path) {
      Object.entries(PATTERNS_TO_ANALYZE).forEach(([patternType, config]) => {
        if (config.detect(path)) {
          // Get the containing function or method
          let container = path.getFunctionParent();
          if (!container) container = path.scope.block;
          
          const code = generate(path.node).code;
          const containerCode = container ? generate(container).code : code;
          
          patterns[patternType].push({
            code,
            containerCode,
            location: {
              start: path.node.loc?.start,
              end: path.node.loc?.end
            },
            file: filePath
          });
        }
      });
    }
  });
  
  return patterns;
}

// Normalize pattern for comparison
function normalizePattern(code) {
  return code
    .replace(/\b\w+\b/g, (match) => {
      // Keep keywords, replace identifiers with placeholder
      const keywords = ['if', 'else', 'for', 'while', 'do', 'return', 'break', 'continue', 
                       'try', 'catch', 'finally', 'throw', 'async', 'await', 'const', 'let', 'var',
                       'function', 'class', 'extends', 'implements', 'new', 'this', 'super'];
      return keywords.includes(match) ? match : 'ID';
    })
    .replace(/["'`].*?["'`]/g, 'STR') // Replace strings
    .replace(/\d+/g, 'NUM') // Replace numbers
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Calculate pattern similarity
function calculatePatternSimilarity(pattern1, pattern2) {
  const norm1 = normalizePattern(pattern1);
  const norm2 = normalizePattern(pattern2);
  
  const tokens1 = norm1.split(' ');
  const tokens2 = norm2.split(' ');
  
  const commonTokens = tokens1.filter(t => tokens2.includes(t)).length;
  const similarity = (2 * commonTokens) / (tokens1.length + tokens2.length);
  
  return similarity;
}

// Parse TypeScript/JavaScript file
function parseFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  
  try {
    return parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy'],
      errorRecovery: true
    });
  } catch (error) {
    console.error(`Error parsing ${filePath}: ${error.message}`);
    return null;
  }
}

// Find files in directory
function findFiles(dir, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  const files = [];
  
  function traverse(currentPath) {
    if (currentPath.includes('node_modules') || 
        currentPath.includes('.next') || 
        currentPath.includes('dist') ||
        currentPath.includes('.test.') ||
        currentPath.includes('.spec.')) {
      return;
    }
    
    try {
      const stats = fs.statSync(currentPath);
      if (stats.isDirectory()) {
        const entries = fs.readdirSync(currentPath);
        for (const entry of entries) {
          traverse(path.join(currentPath, entry));
        }
      } else if (stats.isFile() && extensions.some(ext => currentPath.endsWith(ext))) {
        files.push(currentPath);
      }
    } catch (error) {
      // Skip inaccessible files
    }
  }
  
  if (Array.isArray(dir)) {
    dir.forEach(d => traverse(d));
  } else {
    traverse(dir);
  }
  
  return files;
}

// Analyze patterns in a directory
function analyzeDirectory(dirPath, dirName) {
  console.log(`\n=== Analyzing ${dirName} ===`);
  
  const files = findFiles(dirPath);
  const allPatterns = {};
  
  // Initialize pattern storage
  Object.keys(PATTERNS_TO_ANALYZE).forEach(patternType => {
    allPatterns[patternType] = [];
  });
  
  // Extract patterns from each file
  for (const file of files) {
    const ast = parseFile(file);
    if (ast) {
      const patterns = extractPatterns(ast, file);
      Object.entries(patterns).forEach(([patternType, instances]) => {
        allPatterns[patternType].push(...instances);
      });
    }
  }
  
  // Find duplicates for each pattern type
  const duplicates = {};
  
  Object.entries(allPatterns).forEach(([patternType, instances]) => {
    duplicates[patternType] = [];
    
    for (let i = 0; i < instances.length; i++) {
      for (let j = i + 1; j < instances.length; j++) {
        const similarity = calculatePatternSimilarity(instances[i].code, instances[j].code);
        if (similarity >= PATTERN_SIMILARITY_THRESHOLD) {
          duplicates[patternType].push({
            similarity: Math.round(similarity * 100),
            instance1: {
              file: instances[i].file,
              code: instances[i].code.substring(0, 100) + '...'
            },
            instance2: {
              file: instances[j].file,
              code: instances[j].code.substring(0, 100) + '...'
            }
          });
        }
      }
    }
  });
  
  return {
    directory: dirName,
    filesAnalyzed: files.length,
    patterns: Object.entries(allPatterns).map(([type, instances]) => ({
      type,
      instances: instances.length,
      duplicates: duplicates[type].length
    })),
    duplicates
  };
}

// Main execution
console.log('🔍 Pattern-Based Code Duplication Analysis');
console.log(`Threshold: ${PATTERN_SIMILARITY_THRESHOLD * 100}%`);

const DIRECTORIES_TO_ANALYZE = {
  'API Routes': 'app/api',
  'Stores': 'store',
  'Components': 'components',
  'Hooks': 'hooks',
  'Services': 'lib/services',
  'Utils': 'lib/utils'
};

const results = [];

for (const [name, path] of Object.entries(DIRECTORIES_TO_ANALYZE)) {
  try {
    const result = analyzeDirectory(path, name);
    results.push(result);
    
    console.log(`Files analyzed: ${result.filesAnalyzed}`);
    result.patterns.forEach(pattern => {
      if (pattern.duplicates > 0) {
        console.log(`  ${pattern.type}: ${pattern.instances} instances, ${pattern.duplicates} duplicates`);
      }
    });
  } catch (error) {
    console.error(`Error analyzing ${name}: ${error.message}`);
  }
}

// Generate detailed report
const report = {
  timestamp: new Date().toISOString(),
  configuration: {
    threshold: PATTERN_SIMILARITY_THRESHOLD,
    minStatements: MIN_STATEMENTS
  },
  results,
  refactoringOpportunities: []
};

// Identify top refactoring opportunities
results.forEach(result => {
  Object.entries(result.duplicates).forEach(([patternType, duplicates]) => {
    if (duplicates.length > 0) {
      report.refactoringOpportunities.push({
        area: result.directory,
        patternType,
        duplicateCount: duplicates.length,
        examples: duplicates.slice(0, 3),
        estimatedImpact: duplicates.length > 10 ? 'High' : duplicates.length > 5 ? 'Medium' : 'Low'
      });
    }
  });
});

// Sort opportunities by impact
report.refactoringOpportunities.sort((a, b) => {
  const impactOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
  return impactOrder[b.estimatedImpact] - impactOrder[a.estimatedImpact];
});

// Save report
fs.writeFileSync('reports/pattern-duplication-analysis.json', JSON.stringify(report, null, 2));

console.log('\n📊 Summary:');
console.log(`Total refactoring opportunities: ${report.refactoringOpportunities.length}`);
console.log('\nTop opportunities:');
report.refactoringOpportunities.slice(0, 5).forEach(opp => {
  console.log(`- ${opp.area} / ${opp.patternType}: ${opp.duplicateCount} duplicates (${opp.estimatedImpact} impact)`);
});

console.log('\nFull report saved to reports/pattern-duplication-analysis.json');