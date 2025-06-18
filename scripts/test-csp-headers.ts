#!/usr/bin/env node

/**
 * Test script to verify CSP headers are properly applied
 */

import fetch from 'node-fetch';
import chalk from 'chalk';

const TEST_URL = process.env['TEST_URL'] || 'http://localhost:3000';

interface SecurityHeader {
  name: string;
  expected: string | RegExp;
  required: boolean;
}

const SECURITY_HEADERS: SecurityHeader[] = [
  {
    name: 'Content-Security-Policy',
    expected: /default-src 'self'/,
    required: true,
  },
  {
    name: 'X-Content-Type-Options',
    expected: 'nosniff',
    required: true,
  },
  {
    name: 'X-Frame-Options',
    expected: 'DENY',
    required: true,
  },
  {
    name: 'X-XSS-Protection',
    expected: '1; mode=block',
    required: true,
  },
  {
    name: 'Referrer-Policy',
    expected: 'strict-origin-when-cross-origin',
    required: true,
  },
  {
    name: 'Permissions-Policy',
    expected: /camera=\(\), microphone=\(\), geolocation=\(\)/,
    required: true,
  },
];

async function testCSPHeaders() {
  console.log(chalk.blue(`Testing CSP headers at ${TEST_URL}...\\n`));

  try {
    const response = await fetch(TEST_URL);
    const headers = response.headers;
    let allPassed = true;

    for (const header of SECURITY_HEADERS) {
      const value = headers.get(header.name.toLowerCase());
      
      if (!value && header.required) {
        console.log(chalk.red(`❌ ${header.name}: MISSING`));
        allPassed = false;
        continue;
      }

      const matches = typeof header.expected === 'string' 
        ? value === header.expected
        : header.expected.test(value || '');

      if (matches) {
        console.log(chalk.green(`✅ ${header.name}: ${value}`));
      } else {
        console.log(chalk.red(`❌ ${header.name}: INVALID`));
        console.log(chalk.yellow(`   Expected: ${header.expected}`));
        console.log(chalk.yellow(`   Actual: ${value}`));
        allPassed = false;
      }
    }

    // Parse and display CSP directives
    const csp = headers.get('content-security-policy');
    if (csp) {
      console.log(chalk.blue('\\nCSP Directives:'));
      const directives = csp.split(';').map(d => d.trim());
      directives.forEach(directive => {
        const [name, ...values] = directive.split(' ');
        console.log(chalk.cyan(`  ${name}:`), values.join(' '));
      });
    }

    console.log('\\n' + (allPassed 
      ? chalk.green('✅ All security headers are properly configured!')
      : chalk.red('❌ Some security headers are missing or invalid.')
    ));

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error(chalk.red('Error testing headers:'), error);
    process.exit(1);
  }
}

// Run the test
testCSPHeaders();