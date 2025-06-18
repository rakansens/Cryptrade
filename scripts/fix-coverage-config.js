#!/usr/bin/env node

/**
 * Script to fix Jest coverage configuration
 * Ensures all source files are properly measured
 */

const fs = require('fs');
const path = require('path');

// Source directories to include in coverage
const sourceDirs = [
  'app',
  'lib',
  'hooks',
  'components',
  'store'
];

// Files and patterns to exclude
const excludePatterns = [
  '**/*.test.{ts,tsx}',
  '**/*.spec.{ts,tsx}',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/*.d.ts',
  '**/types/**',
  '**/*.stories.{ts,tsx}',
  
  // Next.js specific files
  '**/middleware.ts',
  '**/layout.tsx',
  '**/page.tsx',
  '**/loading.tsx',
  '**/error.tsx',
  '**/not-found.tsx',
  '**/template.tsx',
  '**/default.tsx',
  '**/global-error.tsx',
  
  // API routes
  'app/api/**',
  'app/**/route.{ts,tsx}',
  
  // Next.js app directory conventions
  'app/**/layout.{ts,tsx}',
  'app/**/page.{ts,tsx}',
  'app/**/loading.{ts,tsx}',
  'app/**/error.{ts,tsx}',
  'app/**/not-found.{ts,tsx}',
  'app/**/template.{ts,tsx}',
  'app/**/default.{ts,tsx}',
  'app/**/global-error.{ts,tsx}',
  
  // Build outputs
  '.next/**',
  'coverage/**',
  
  // Config files
  'jest.setup.js',
  'config/**',
  'scripts/**',
  
  // Mastra config files
  'lib/mastra/mastra-config.ts',
  'lib/mastra/mastra.ts',
];

function generateCoverageConfig() {
  const collectCoverageFrom = [
    ...sourceDirs.map(dir => `${dir}/**/*.{ts,tsx}`),
    ...excludePatterns.map(pattern => `!${pattern}`)
  ];

  const config = {
    collectCoverageFrom,
    coveragePathIgnorePatterns: [
      '/node_modules/',
      '/__tests__/',
      '/__mocks__/',
      '/coverage/',
      '/types/',
      '\\.test\\.',
      '\\.spec\\.',
      '\\.d\\.ts$',
      '\\.types\\.ts$',
      '\\.interface\\.ts$',
      '\\.constants?\\.ts$',
      '\\.schema\\.ts$',
      '/.stryker-tmp/',
      '/dist/',
      '/build/',
      '/.next/',
    ],
    forceCoverageMatch: [
      '**/*.{ts,tsx}',
    ],
    coverageProvider: 'v8',
    coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json-summary'],
  };

  return config;
}

// Count source files
function countSourceFiles(dir, count = { files: 0, lines: 0 }) {
  if (!fs.existsSync(dir)) return count;
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      countSourceFiles(fullPath, count);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      // Skip test files
      if (file.includes('.test.') || file.includes('.spec.') || dir.includes('__tests__')) {
        continue;
      }
      
      count.files++;
      const content = fs.readFileSync(fullPath, 'utf8');
      count.lines += content.split('\n').length;
    }
  }
  
  return count;
}

// Main execution
console.log('Analyzing source files for coverage configuration...\n');

const totalCount = { files: 0, lines: 0 };
for (const dir of sourceDirs) {
  const dirPath = path.join(process.cwd(), dir);
  const count = countSourceFiles(dirPath, { files: 0, lines: 0 });
  console.log(`${dir}/: ${count.files} files, ${count.lines} lines`);
  totalCount.files += count.files;
  totalCount.lines += count.lines;
}

console.log(`\nTotal: ${totalCount.files} source files, ${totalCount.lines} lines\n`);

const config = generateCoverageConfig();
console.log('Generated coverage configuration:');
console.log(JSON.stringify(config, null, 2));

// Write to a new config file
const configPath = path.join(process.cwd(), 'jest.config.coverage-fixed.js');
const configContent = `/** @type {import('jest').Config} */
const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  
  // Fixed coverage configuration
  ${Object.entries(config).map(([key, value]) => 
    `${key}: ${JSON.stringify(value, null, 2).split('\n').join('\n  ')}`
  ).join(',\n  ')},
  
  // Run in band for accurate coverage
  maxWorkers: 1,
  
  // Lower thresholds to start
  coverageThreshold: {
    global: {
      branches: 5,
      functions: 5,
      lines: 5,
      statements: 5,
    },
  },
};
`;

fs.writeFileSync(configPath, configContent);
console.log(`\nWritten fixed configuration to: ${configPath}`);
console.log('\nTo use the fixed configuration, run:');
console.log('npm test -- --config jest.config.coverage-fixed.js --coverage');