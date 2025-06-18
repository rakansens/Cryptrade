#!/usr/bin/env node

/**
 * Quick verification script to ensure CSP setup is complete
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

const requiredFiles = [
  'lib/security/csp.ts',
  'config/csp-production.config.ts',
  'middleware.ts',
  'app/api/csp-report/route.ts',
  'scripts/test-csp-headers.ts',
  'scripts/verify-csp-production-enhanced.ts',
  'scripts/monitor-csp-violations.ts',
  'docs/CSP_PRODUCTION_DEPLOYMENT_CHECKLIST.md',
  'CSP_TEST_RESULTS.md'
];

const requiredScripts = [
  'test-csp',
  'verify-csp',
  'monitor-csp'
];

console.log(chalk.blue.bold('\nCSP Setup Verification\n'));

// Check required files
console.log(chalk.yellow('Checking required files:'));
let allFilesPresent = true;

requiredFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(chalk.green(`✅ ${file}`));
  } else {
    console.log(chalk.red(`❌ ${file} - MISSING`));
    allFilesPresent = false;
  }
});

// Check package.json scripts
console.log(chalk.yellow('\nChecking package.json scripts:'));
const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
let allScriptsPresent = true;

requiredScripts.forEach(script => {
  if (packageJson.scripts[script]) {
    console.log(chalk.green(`✅ npm run ${script}`));
  } else {
    console.log(chalk.red(`❌ npm run ${script} - MISSING`));
    allScriptsPresent = false;
  }
});

// Check middleware implementation
console.log(chalk.yellow('\nChecking middleware implementation:'));
const middlewarePath = path.join(process.cwd(), 'middleware.ts');
const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');

if (middlewareContent.includes('applyCSPHeaders')) {
  console.log(chalk.green('✅ CSP headers applied in middleware'));
} else {
  console.log(chalk.red('❌ CSP headers not applied in middleware'));
}

if (middlewareContent.includes('generateNonce')) {
  console.log(chalk.green('✅ Nonce generation implemented'));
} else {
  console.log(chalk.red('❌ Nonce generation not implemented'));
}

// Summary
console.log(chalk.blue.bold('\nSetup Summary:'));
if (allFilesPresent && allScriptsPresent) {
  console.log(chalk.green.bold('✅ CSP setup is complete and ready for production!'));
  console.log(chalk.cyan('\nNext steps:'));
  console.log(chalk.cyan('1. Run "npm run build" to create production build'));
  console.log(chalk.cyan('2. Run "npm run verify-csp local" to test locally'));
  console.log(chalk.cyan('3. Follow docs/CSP_PRODUCTION_DEPLOYMENT_CHECKLIST.md'));
} else {
  console.log(chalk.red.bold('❌ CSP setup is incomplete. Please fix the issues above.'));
}

process.exit(allFilesPresent && allScriptsPresent ? 0 : 1);