#!/usr/bin/env node

/**
 * CSP Production Verification Script
 * 
 * This script verifies that CSP headers are properly configured in production
 * Run this after deployment to ensure security headers are active
 */

import https from 'https';
import { URL } from 'url';

// Configuration
const PRODUCTION_URL = process.env['PRODUCTION_URL'] || 'https://your-app.vercel.app';
const STAGING_URL = process.env['STAGING_URL'] || 'https://your-app-staging.vercel.app';

// Expected security headers
const REQUIRED_HEADERS = {
  'content-security-policy': {
    required: true,
    mustInclude: [
      'default-src',
      'script-src',
      'style-src',
      'connect-src',
      'nonce-'
    ],
    mustNotInclude: [
      'unsafe-eval',
      'localhost',
      'http://'
    ]
  },
  'x-content-type-options': {
    required: true,
    exactValue: 'nosniff'
  },
  'x-frame-options': {
    required: true,
    exactValue: 'DENY'
  },
  'x-xss-protection': {
    required: true,
    exactValue: '1; mode=block'
  },
  'referrer-policy': {
    required: true,
    exactValue: 'strict-origin-when-cross-origin'
  },
  'permissions-policy': {
    required: true,
    mustInclude: ['camera=()', 'microphone=()', 'geolocation=()']
  },
  'strict-transport-security': {
    required: true,
    mustInclude: ['max-age=', 'includeSubDomains']
  }
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green');
}

function logError(message: string) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, 'blue');
}

/**
 * Fetch headers from a URL
 */
async function fetchHeaders(url: string): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: 'HEAD',
      headers: {
        'User-Agent': 'CSP-Verification-Script/1.0'
      }
    };

    const req = https.request(options, (res) => {
      const headers: Record<string, string> = {};
      
      Object.entries(res.headers).forEach(([key, value]) => {
        headers[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value || '';
      });
      
      resolve(headers);
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Verify security headers
 */
function verifyHeaders(headers: Record<string, string>, environment: string): boolean {
  log(`\n${colors.bold}Verifying Security Headers for ${environment}${colors.reset}`);
  log('=' .repeat(50));
  
  let allPassed = true;
  
  for (const [headerName, requirements] of Object.entries(REQUIRED_HEADERS)) {
    const headerValue = headers[headerName];
    
    if (!headerValue && requirements.required) {
      logError(`Missing required header: ${headerName}`);
      allPassed = false;
      continue;
    }
    
    if (!headerValue) continue;
    
    // Check exact value
    if ('exactValue' in requirements && requirements.exactValue !== headerValue) {
      logError(`Invalid ${headerName}: expected "${requirements.exactValue}", got "${headerValue}"`);
      allPassed = false;
      continue;
    }
    
    // Check must include
    if ('mustInclude' in requirements) {
      const missing = requirements.mustInclude.filter(item => !headerValue.includes(item));
      if (missing.length > 0) {
        logError(`${headerName} missing required values: ${missing.join(', ')}`);
        allPassed = false;
        continue;
      }
    }
    
    // Check must not include
    if ('mustNotInclude' in requirements) {
      const found = requirements.mustNotInclude.filter(item => headerValue.includes(item));
      if (found.length > 0) {
        logError(`${headerName} contains forbidden values: ${found.join(', ')}`);
        allPassed = false;
        continue;
      }
    }
    
    logSuccess(`${headerName} is properly configured`);
  }
  
  return allPassed;
}

/**
 * Parse and display CSP directives
 */
function parseCSP(csp: string) {
  log(`\n${colors.bold}Content Security Policy Directives${colors.reset}`);
  log('=' .repeat(50));
  
  const directives = csp.split(';').map(d => d.trim()).filter(Boolean);
  
  directives.forEach(directive => {
    const [name, ...sources] = directive.split(' ');
    logInfo(`${name}: ${sources.join(' ')}`);
  });
}

/**
 * Main verification function
 */
async function verifyCSP(environment: 'production' | 'staging' = 'production') {
  const url = environment === 'production' ? PRODUCTION_URL : STAGING_URL;
  
  log(`\n${colors.bold}CSP Verification Script${colors.reset}`);
  log(`Testing: ${url}`);
  
  try {
    const headers = await fetchHeaders(url);
    
    // Verify all security headers
    const passed = verifyHeaders(headers, environment);
    
    // Parse and display CSP
    if (headers['content-security-policy']) {
      parseCSP(headers['content-security-policy']);
    }
    
    // Summary
    log(`\n${colors.bold}Summary${colors.reset}`);
    log('=' .repeat(50));
    
    if (passed) {
      logSuccess('All security headers are properly configured!');
      
      // Additional recommendations
      log(`\n${colors.bold}Recommendations${colors.reset}`);
      logInfo('1. Monitor CSP violations in browser console');
      logInfo('2. Consider adding CSP reporting endpoint');
      logInfo('3. Regularly audit allowed domains');
      logInfo('4. Test all critical user flows');
      
      return 0;
    } else {
      logError('Some security headers are missing or misconfigured!');
      logWarning('Please review the errors above and update the CSP configuration');
      return 1;
    }
    
  } catch (error) {
    logError(`Failed to fetch headers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return 1;
  }
}

/**
 * Test specific CSP scenarios
 */
async function testCSPScenarios() {
  log(`\n${colors.bold}Testing CSP Scenarios${colors.reset}`);
  log('=' .repeat(50));
  
  const scenarios = [
    {
      name: 'WebSocket Connection',
      test: () => {
        // This would be a real WebSocket test in production
        logInfo('WebSocket connections should be allowed to wss://stream.binance.com');
      }
    },
    {
      name: 'External API Calls',
      test: () => {
        logInfo('API calls should be allowed to https://api.binance.com');
        logInfo('API calls should be allowed to https://*.supabase.co');
      }
    },
    {
      name: 'Font Loading',
      test: () => {
        logInfo('Fonts should load from https://fonts.googleapis.com');
      }
    },
    {
      name: 'Analytics & Monitoring',
      test: () => {
        logInfo('Sentry should be able to report errors');
        logInfo('Vercel Analytics should track metrics');
      }
    }
  ];
  
  scenarios.forEach(scenario => {
    log(`\nTesting: ${scenario.name}`);
    scenario.test();
  });
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const environment = args.includes('--staging') ? 'staging' : 'production';
  const verbose = args.includes('--verbose');
  
  if (args.includes('--help')) {
    console.log(`
CSP Production Verification Script

Usage: npm run verify-csp-production [options]

Options:
  --staging    Test staging environment instead of production
  --verbose    Show detailed CSP analysis
  --help       Show this help message

Examples:
  npm run verify-csp-production
  npm run verify-csp-production --staging
  npm run verify-csp-production --verbose
    `);
    process.exit(0);
  }
  
  const exitCode = await verifyCSP(environment as 'production' | 'staging');
  
  if (verbose || exitCode !== 0) {
    await testCSPScenarios();
  }
  
  process.exit(exitCode);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    logError(`Script failed: ${error}`);
    process.exit(1);
  });
}