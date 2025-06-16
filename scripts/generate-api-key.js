#!/usr/bin/env node

const crypto = require('crypto');

/**
 * Generate a secure API key for authentication
 */
function generateApiKey() {
  const apiKey = crypto.randomBytes(32).toString('base64');
  
  console.log('========================================');
  console.log('🔐 Generated API Key:');
  console.log('');
  console.log(apiKey);
  console.log('');
  console.log('========================================');
  console.log('');
  console.log('To use this API key:');
  console.log('');
  console.log('1. Add to your .env.local file:');
  console.log(`   API_AUTH_SECRET=${apiKey}`);
  console.log('   API_AUTH_ENABLED=true');
  console.log('');
  console.log('2. Include in API requests:');
  console.log('   Authorization: Bearer ' + apiKey);
  console.log('');
  console.log('⚠️  Keep this key secure and never commit it to version control!');
  console.log('');
}

// Run the generator
generateApiKey();