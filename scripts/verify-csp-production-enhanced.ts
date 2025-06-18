#!/usr/bin/env node

/**
 * Enhanced CSP Production Verification Script
 * 
 * This script performs comprehensive CSP validation for production deployment
 * including functional tests, performance checks, and security validation
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// Configuration
const ENVIRONMENTS = {
  local: 'http://localhost:3000',
  staging: process.env['STAGING_URL'] || 'https://cryptrade-staging.vercel.app',
  production: process.env['PRODUCTION_URL'] || 'https://cryptrade.vercel.app'
};

// Test scenarios
interface TestScenario {
  name: string;
  endpoint: string;
  method?: string;
  headers?: Record<string, string>;
  expectedHeaders?: Record<string, string | RegExp>;
  expectedCSPDirectives?: string[];
  forbiddenCSPValues?: string[];
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    name: 'Homepage',
    endpoint: '/',
    expectedCSPDirectives: ['default-src', 'script-src', 'style-src', 'connect-src'],
    forbiddenCSPValues: ['unsafe-eval', 'localhost', 'http://']
  },
  {
    name: 'API Endpoint',
    endpoint: '/api/binance/symbols',
    method: 'GET',
    expectedHeaders: {
      'x-content-type-options': 'nosniff'
    }
  },
  {
    name: 'Dashboard (Protected Route)',
    endpoint: '/dashboard',
    expectedCSPDirectives: ['connect-src'],
    forbiddenCSPValues: ['unsafe-eval']
  },
  {
    name: 'Static Asset',
    endpoint: '/_next/static/chunks/main.js',
    method: 'HEAD',
    expectedHeaders: {
      'cache-control': /public.*max-age/
    }
  }
];

// Security headers configuration
const SECURITY_HEADERS = {
  'content-security-policy': {
    required: true,
    validate: (value: string) => {
      const errors: string[] = [];
      
      // Check for required directives
      const requiredDirectives = ['default-src', 'script-src', 'style-src', 'connect-src'];
      requiredDirectives.forEach(directive => {
        if (!value.includes(directive)) {
          errors.push(`Missing required directive: ${directive}`);
        }
      });
      
      // Check for nonce support
      if (!value.includes('nonce-')) {
        errors.push('CSP should use nonces for inline scripts');
      }
      
      // Check for production-specific requirements
      if (value.includes('unsafe-eval')) {
        errors.push('unsafe-eval should not be used in production');
      }
      
      if (value.includes('localhost') || value.includes('http://')) {
        errors.push('Development URLs found in production CSP');
      }
      
      return errors;
    }
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
    validate: (value: string) => {
      const errors: string[] = [];
      const required = ['camera=()', 'microphone=()', 'geolocation=()'];
      required.forEach(policy => {
        if (!value.includes(policy)) {
          errors.push(`Missing required policy: ${policy}`);
        }
      });
      return errors;
    }
  },
  'strict-transport-security': {
    required: false, // Only in production
    validate: (value: string) => {
      const errors: string[] = [];
      if (!value.includes('max-age=')) {
        errors.push('HSTS must include max-age directive');
      }
      if (!value.includes('includeSubDomains')) {
        errors.push('HSTS should include includeSubDomains');
      }
      return errors;
    }
  }
};

// Utility functions
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m',
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

function logSection(title: string) {
  log(`\n${colors.bold}${title}${colors.reset}`, 'magenta');
  log('═'.repeat(60), 'magenta');
}

/**
 * Fetch headers from a URL
 */
async function fetchHeaders(url: string, options: Partial<TestScenario> = {}): Promise<{
  headers: Record<string, string>;
  statusCode: number;
  error?: string;
}> {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'CSP-Verification-Script/2.0',
          ...options.headers
        },
        timeout: 10000
      };

      const req = client.request(requestOptions, (res) => {
        const headers: Record<string, string> = {};
        
        Object.entries(res.headers).forEach(([key, value]) => {
          headers[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value || '';
        });
        
        resolve({
          headers,
          statusCode: res.statusCode || 0
        });
      });

      req.on('error', (error) => {
        resolve({
          headers: {},
          statusCode: 0,
          error: error.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          headers: {},
          statusCode: 0,
          error: 'Request timeout'
        });
      });

      req.end();
    } catch (error) {
      resolve({
        headers: {},
        statusCode: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

/**
 * Validate security headers
 */
function validateHeaders(headers: Record<string, string>, isProduction: boolean = false): {
  passed: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  Object.entries(SECURITY_HEADERS).forEach(([headerName, config]) => {
    const headerValue = headers[headerName];
    
    // Check if header is required
    if (!headerValue && config.required) {
      errors.push(`Missing required header: ${headerName}`);
      return;
    }
    
    // Skip optional headers if not present
    if (!headerValue) {
      if (headerName === 'strict-transport-security' && isProduction) {
        warnings.push('HSTS header should be present in production');
      }
      return;
    }
    
    // Validate exact value
    if ('exactValue' in config && config.exactValue !== headerValue) {
      errors.push(`Invalid ${headerName}: expected "${config.exactValue}", got "${headerValue}"`);
    }
    
    // Run custom validation
    if ('validate' in config) {
      const validationErrors = config.validate(headerValue);
      errors.push(...validationErrors);
    }
  });
  
  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Parse and analyze CSP directives
 */
function analyzeCSP(csp: string): {
  directives: Map<string, string[]>;
  issues: string[];
  suggestions: string[];
} {
  const directives = new Map<string, string[]>();
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  // Parse CSP string
  csp.split(';').forEach(directive => {
    const trimmed = directive.trim();
    if (!trimmed) return;
    
    const [name, ...sources] = trimmed.split(/\s+/);
    directives.set(name, sources);
  });
  
  // Analyze directives
  const scriptSrc = directives.get('script-src');
  if (scriptSrc) {
    if (scriptSrc.includes("'unsafe-inline'") && !scriptSrc.some(s => s.includes('nonce-'))) {
      issues.push("'unsafe-inline' used without nonce fallback");
    }
    if (scriptSrc.includes("'unsafe-eval'")) {
      issues.push("'unsafe-eval' should be avoided in production");
    }
  }
  
  // Check for report-uri or report-to
  if (!directives.has('report-uri') && !directives.has('report-to')) {
    suggestions.push('Consider adding CSP reporting to monitor violations');
  }
  
  // Check for upgrade-insecure-requests
  if (!directives.has('upgrade-insecure-requests')) {
    suggestions.push('Consider adding upgrade-insecure-requests for HTTPS enforcement');
  }
  
  return { directives, issues, suggestions };
}

/**
 * Test specific scenario
 */
async function testScenario(baseUrl: string, scenario: TestScenario): Promise<{
  passed: boolean;
  errors: string[];
  warnings: string[];
}> {
  const url = `${baseUrl}${scenario.endpoint}`;
  const result = await fetchHeaders(url, scenario);
  
  if (result.error) {
    return {
      passed: false,
      errors: [`Failed to fetch: ${result.error}`],
      warnings: []
    };
  }
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check expected headers
  if (scenario.expectedHeaders) {
    Object.entries(scenario.expectedHeaders).forEach(([header, expected]) => {
      const actual = result.headers[header.toLowerCase()];
      if (!actual) {
        errors.push(`Missing expected header: ${header}`);
      } else if (expected instanceof RegExp) {
        if (!expected.test(actual)) {
          errors.push(`Header ${header} doesn't match pattern: ${expected}`);
        }
      } else if (actual !== expected) {
        errors.push(`Header ${header}: expected "${expected}", got "${actual}"`);
      }
    });
  }
  
  // Check CSP directives
  const csp = result.headers['content-security-policy'];
  if (csp && (scenario.expectedCSPDirectives || scenario.forbiddenCSPValues)) {
    const { directives } = analyzeCSP(csp);
    
    if (scenario.expectedCSPDirectives) {
      scenario.expectedCSPDirectives.forEach(directive => {
        if (!directives.has(directive)) {
          errors.push(`Missing CSP directive: ${directive}`);
        }
      });
    }
    
    if (scenario.forbiddenCSPValues) {
      scenario.forbiddenCSPValues.forEach(forbidden => {
        if (csp.includes(forbidden)) {
          errors.push(`Forbidden value in CSP: ${forbidden}`);
        }
      });
    }
  }
  
  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Run functional tests
 */
async function runFunctionalTests(environment: string): Promise<boolean> {
  logSection(`Functional Tests - ${environment}`);
  
  const baseUrl = ENVIRONMENTS[environment as keyof typeof ENVIRONMENTS];
  if (!baseUrl) {
    logError(`Unknown environment: ${environment}`);
    return false;
  }
  
  let allPassed = true;
  
  for (const scenario of TEST_SCENARIOS) {
    process.stdout.write(`Testing ${scenario.name}... `);
    const result = await testScenario(baseUrl, scenario);
    
    if (result.passed) {
      logSuccess('PASSED');
    } else {
      logError('FAILED');
      result.errors.forEach(error => logError(`  ${error}`));
      allPassed = false;
    }
    
    if (result.warnings.length > 0) {
      result.warnings.forEach(warning => logWarning(`  ${warning}`));
    }
  }
  
  return allPassed;
}

/**
 * Performance impact test
 */
async function testPerformanceImpact(environment: string): Promise<void> {
  logSection('Performance Impact Test');
  
  const baseUrl = ENVIRONMENTS[environment as keyof typeof ENVIRONMENTS];
  const iterations = 5;
  const timings: number[] = [];
  
  logInfo(`Running ${iterations} requests to measure response time...`);
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await fetchHeaders(baseUrl);
    const duration = Date.now() - start;
    timings.push(duration);
    process.stdout.write('.');
  }
  console.log('');
  
  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  const min = Math.min(...timings);
  const max = Math.max(...timings);
  
  logInfo(`Average response time: ${avg.toFixed(2)}ms`);
  logInfo(`Min: ${min}ms, Max: ${max}ms`);
  
  if (avg > 1000) {
    logWarning('Response times are higher than expected');
  } else {
    logSuccess('Response times are within acceptable range');
  }
}

/**
 * Generate test report
 */
async function generateReport(
  environment: string,
  results: any,
  outputPath?: string
): Promise<void> {
  const report = {
    timestamp: new Date().toISOString(),
    environment,
    url: ENVIRONMENTS[environment as keyof typeof ENVIRONMENTS],
    results,
    recommendations: [
      'Monitor CSP violations in production',
      'Set up CSP reporting endpoint',
      'Regular security audits',
      'Performance monitoring'
    ]
  };
  
  const reportJson = JSON.stringify(report, null, 2);
  
  if (outputPath) {
    await fs.writeFile(outputPath, reportJson);
    logSuccess(`Report saved to: ${outputPath}`);
  }
  
  return;
}

/**
 * Main verification function
 */
async function main() {
  const args = process.argv.slice(2);
  const environment = args.find(arg => ['local', 'staging', 'production'].includes(arg)) || 'production';
  const verbose = args.includes('--verbose');
  const outputReport = args.includes('--report');
  
  if (args.includes('--help')) {
    console.log(`
Enhanced CSP Production Verification Script

Usage: npm run verify-csp [environment] [options]

Environments:
  local        Test local development server
  staging      Test staging environment
  production   Test production environment (default)

Options:
  --verbose    Show detailed analysis
  --report     Generate JSON report
  --help       Show this help message

Examples:
  npm run verify-csp production
  npm run verify-csp staging --verbose
  npm run verify-csp local --report
    `);
    process.exit(0);
  }
  
  log(`${colors.bold}Enhanced CSP Verification Script${colors.reset}`);
  log(`Environment: ${environment}`);
  log(`URL: ${ENVIRONMENTS[environment as keyof typeof ENVIRONMENTS]}\n`);
  
  const results: any = {
    securityHeaders: {},
    functionalTests: {},
    performance: {}
  };
  
  try {
    // Basic connectivity test
    logSection('Connectivity Test');
    const testResult = await fetchHeaders(ENVIRONMENTS[environment as keyof typeof ENVIRONMENTS]);
    if (testResult.error) {
      logError(`Cannot connect to ${environment}: ${testResult.error}`);
      process.exit(1);
    }
    logSuccess('Successfully connected to server');
    
    // Security headers validation
    logSection('Security Headers Validation');
    const validation = validateHeaders(testResult.headers, environment === 'production');
    results.securityHeaders = validation;
    
    if (validation.passed) {
      logSuccess('All required security headers are present');
    } else {
      validation.errors.forEach(error => logError(error));
    }
    
    validation.warnings.forEach(warning => logWarning(warning));
    
    // CSP analysis
    if (testResult.headers['content-security-policy']) {
      logSection('CSP Analysis');
      const cspAnalysis = analyzeCSP(testResult.headers['content-security-policy']);
      results.cspAnalysis = cspAnalysis;
      
      if (verbose) {
        cspAnalysis.directives.forEach((sources, directive) => {
          logInfo(`${directive}: ${sources.join(' ')}`);
        });
      }
      
      if (cspAnalysis.issues.length > 0) {
        logWarning('CSP Issues:');
        cspAnalysis.issues.forEach(issue => logWarning(`  - ${issue}`));
      }
      
      if (cspAnalysis.suggestions.length > 0) {
        logInfo('Suggestions:');
        cspAnalysis.suggestions.forEach(suggestion => logInfo(`  - ${suggestion}`));
      }
    }
    
    // Functional tests
    const functionalTestsPassed = await runFunctionalTests(environment);
    results.functionalTests.passed = functionalTestsPassed;
    
    // Performance impact
    if (environment !== 'local') {
      await testPerformanceImpact(environment);
    }
    
    // Summary
    logSection('Verification Summary');
    const overallPassed = validation.passed && functionalTestsPassed;
    
    if (overallPassed) {
      logSuccess('✨ All verifications passed! CSP is production-ready.');
    } else {
      logError('❌ Some verifications failed. Please review the errors above.');
    }
    
    // Generate report if requested
    if (outputReport) {
      const reportPath = path.join(process.cwd(), `csp-verification-${environment}-${Date.now()}.json`);
      await generateReport(environment, results, reportPath);
    }
    
    // Exit code
    process.exit(overallPassed ? 0 : 1);
    
  } catch (error) {
    logError(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    logError(`Script failed: ${error}`);
    process.exit(1);
  });
}