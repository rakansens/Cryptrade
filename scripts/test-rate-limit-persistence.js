#!/usr/bin/env node

/**
 * Test script to verify rate limit persistence across restarts
 * 
 * Usage:
 *   node scripts/test-rate-limit-persistence.js
 */

const fs = require('fs').promises;
const path = require('path');

// Mock the environment
process.env.NODE_ENV = 'development';

// Import the rate limiter after setting env
const { checkRateLimit, cleanupRateLimiter } = require('../lib/api/rate-limit-persistent');

// Test configuration
const TEST_IDENTIFIER = 'test-user-123';
const TEST_CONFIG = {
  windowSec: 10, // 10 second window for testing
  maxRequests: 5  // 5 requests per window
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('🧪 Testing Rate Limit Persistence\n');
  
  try {
    // Phase 1: Make requests until rate limited
    console.log('📊 Phase 1: Making requests until rate limited...');
    let lastResult;
    
    for (let i = 1; i <= 7; i++) {
      const result = await checkRateLimit(TEST_IDENTIFIER, TEST_CONFIG);
      console.log(`  Request ${i}: ${result.success ? '✅ Allowed' : '❌ Blocked'} (${result.remainingRequests} remaining)`);
      lastResult = result;
      
      if (!result.success && i === 6) {
        console.log(`  ⏰ Rate limited! Retry after ${result.retryAfter} seconds`);
      }
    }
    
    // Phase 2: Simulate server restart
    console.log('\n🔄 Phase 2: Simulating server restart...');
    await cleanupRateLimiter();
    console.log('  Server "restarted" (connections closed)');
    
    // Phase 3: Verify persistence
    console.log('\n🔍 Phase 3: Verifying persistence after restart...');
    const resultAfterRestart = await checkRateLimit(TEST_IDENTIFIER, TEST_CONFIG);
    
    if (!resultAfterRestart.success) {
      console.log('  ✅ SUCCESS: Rate limit persisted across restart!');
      console.log(`  ⏰ Still rate limited for ${resultAfterRestart.retryAfter} more seconds`);
    } else {
      console.log('  ❌ FAIL: Rate limit was not persisted');
      console.log('  💡 This might happen if using memory storage or if the time window expired');
    }
    
    // Phase 4: Wait for rate limit to expire
    console.log('\n⏳ Phase 4: Waiting for rate limit window to expire...');
    const waitTime = (lastResult?.retryAfter || TEST_CONFIG.windowSec) + 1;
    console.log(`  Waiting ${waitTime} seconds...`);
    await sleep(waitTime * 1000);
    
    // Phase 5: Verify rate limit reset
    console.log('\n🔄 Phase 5: Verifying rate limit reset...');
    const resultAfterExpiry = await checkRateLimit(TEST_IDENTIFIER, TEST_CONFIG);
    
    if (resultAfterExpiry.success) {
      console.log('  ✅ SUCCESS: Rate limit reset after window expiry!');
      console.log(`  📊 Remaining requests: ${resultAfterExpiry.remainingRequests}`);
    } else {
      console.log('  ❌ FAIL: Rate limit did not reset properly');
    }
    
    // Check if SQLite database was created
    const dbPath = process.env.RATE_LIMIT_DB_PATH || './data/rate-limit.db';
    try {
      await fs.access(dbPath);
      console.log(`\n💾 SQLite database created at: ${dbPath}`);
      
      // Get file size
      const stats = await fs.stat(dbPath);
      console.log(`  📁 Database size: ${stats.size} bytes`);
    } catch {
      console.log('\n⚠️  No SQLite database found - using Redis or memory storage');
    }
    
    // Cleanup
    await cleanupRateLimiter();
    console.log('\n✨ Test completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
runTest().catch(console.error);