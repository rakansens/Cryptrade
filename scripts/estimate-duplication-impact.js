#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Count lines of code that could be reduced
function countReducibleLines(directory, patterns) {
  let totalLines = 0;
  let reducibleLines = 0;
  
  function traverse(dir) {
    if (dir.includes('node_modules') || dir.includes('.next')) return;
    
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          traverse(fullPath);
        } else if (stats.isFile() && (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx'))) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');
          totalLines += lines.length;
          
          // Count lines matching patterns
          for (const line of lines) {
            for (const pattern of patterns) {
              if (line.includes(pattern)) {
                reducibleLines++;
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      // Skip inaccessible directories
    }
  }
  
  traverse(directory);
  return { totalLines, reducibleLines };
}

console.log('📊 Estimating Code Duplication Impact\n');

const areas = [
  {
    name: 'API Routes',
    path: 'app/api',
    patterns: [
      'getServerSession()',
      'return createApiErrorResponse',
      'catch (error)',
      'NextResponse.json('
    ],
    reductionFactor: 0.3
  },
  {
    name: 'Stores',
    path: 'store',
    patterns: [
      'set((state)',
      'reset:',
      'initialState',
      '...state,'
    ],
    reductionFactor: 0.25
  },
  {
    name: 'Hooks',
    path: 'hooks',
    patterns: [
      'useState(false)',
      'useEffect(() =>',
      'catch (error)',
      'setLoading('
    ],
    reductionFactor: 0.2
  },
  {
    name: 'Components',
    path: 'components',
    patterns: [
      'isLoading',
      'error &&',
      'loading ?',
      'setError('
    ],
    reductionFactor: 0.15
  }
];

let totalImpact = 0;
const results = [];

for (const area of areas) {
  const stats = countReducibleLines(area.path, area.patterns);
  const estimatedReduction = Math.floor(stats.reducibleLines * area.reductionFactor);
  const percentageReduction = ((estimatedReduction / stats.totalLines) * 100).toFixed(1);
  
  totalImpact += estimatedReduction;
  
  results.push({
    area: area.name,
    totalLines: stats.totalLines,
    reducibleLines: stats.reducibleLines,
    estimatedReduction,
    percentageReduction: parseFloat(percentageReduction)
  });
  
  console.log(`${area.name}:`);
  console.log(`  Total lines: ${stats.totalLines}`);
  console.log(`  Duplicate pattern lines: ${stats.reducibleLines}`);
  console.log(`  Estimated reduction: ${estimatedReduction} lines (${percentageReduction}%)`);
  console.log('');
}

// Calculate overall impact
const grandTotal = results.reduce((sum, r) => sum + r.totalLines, 0);
const percentageImpact = ((totalImpact / grandTotal) * 100).toFixed(1);

console.log('📈 Overall Impact:');
console.log(`  Total lines analyzed: ${grandTotal}`);
console.log(`  Estimated lines saved: ${totalImpact}`);
console.log(`  Overall reduction: ${percentageImpact}%`);
console.log('');

// Time estimation (assuming 50 lines per hour refactoring speed)
const hoursNeeded = Math.ceil(totalImpact / 50);
const daysNeeded = Math.ceil(hoursNeeded / 8);

console.log('⏱️  Time Estimation:');
console.log(`  Estimated hours: ${hoursNeeded}`);
console.log(`  Estimated days: ${daysNeeded}`);

// Save detailed report
const report = {
  timestamp: new Date().toISOString(),
  areas: results,
  impact: {
    totalLinesAnalyzed: grandTotal,
    estimatedLinesSaved: totalImpact,
    percentageReduction: parseFloat(percentageImpact)
  },
  timeEstimation: {
    hours: hoursNeeded,
    days: daysNeeded
  },
  recommendations: [
    'Start with API Routes for highest impact',
    'Implement base classes for stores',
    'Create shared hook utilities',
    'Standardize component patterns'
  ]
};

fs.writeFileSync('reports/duplication-impact-estimate.json', JSON.stringify(report, null, 2));
console.log('\n✅ Detailed report saved to reports/duplication-impact-estimate.json');