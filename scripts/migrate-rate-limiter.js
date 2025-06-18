#!/usr/bin/env node

/**
 * Migration script for rate limiter persistence
 * 
 * This script helps migrate from the in-memory rate limiter to the persistent version
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 Rate Limiter Migration Script');
console.log('================================\n');

// Files that need to be updated
const filesToUpdate = [
  'app/api/ai/chat/route.ts',
  'app/api/binance/klines/route.ts',
  'app/api/binance/ticker/route.ts',
  'lib/api/middleware.ts',
  'lib/api/middlewares/index.ts'
];

// Check if files exist and update imports
console.log('📝 Updating imports in files...\n');

filesToUpdate.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${file} - File not found, skipping...`);
    return;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Update import statements
    content = content.replace(
      /from ['"]@\/lib\/api\/rate-limit['"]/g,
      'from \'@/lib/api/rate-limit-persistent\''
    );
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ ${file} - Updated successfully`);
    } else {
      console.log(`ℹ️  ${file} - No changes needed`);
    }
  } catch (error) {
    console.error(`❌ ${file} - Error updating: ${error.message}`);
  }
});

// Create data directory if it doesn't exist
console.log('\n📁 Creating data directory for SQLite database...');
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ Data directory created');
} else {
  console.log('ℹ️  Data directory already exists');
}

// Update .gitignore
console.log('\n📝 Updating .gitignore...');
const gitignorePath = path.join(process.cwd(), '.gitignore');
if (fs.existsSync(gitignorePath)) {
  let gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  
  if (!gitignoreContent.includes('/data/rate-limit.db')) {
    gitignoreContent += '\n# Rate limiter database\n/data/rate-limit.db\n/data/rate-limit.db-*\n';
    fs.writeFileSync(gitignorePath, gitignoreContent);
    console.log('✅ .gitignore updated');
  } else {
    console.log('ℹ️  .gitignore already contains rate limiter entries');
  }
}

// Check package.json for better-sqlite3
console.log('\n📦 Checking dependencies...');
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  if (!packageJson.dependencies['better-sqlite3']) {
    console.log('⚠️  better-sqlite3 not found in dependencies');
    console.log('   Run: npm install better-sqlite3');
  } else {
    console.log('✅ better-sqlite3 is installed');
  }
}

console.log('\n✨ Migration preparation complete!');
console.log('\nNext steps:');
console.log('1. Install dependencies: npm install better-sqlite3');
console.log('2. Review the changes in updated files');
console.log('3. Test rate limiting functionality');
console.log('4. Deploy with confidence!\n');

console.log('📚 Documentation: docs/rate-limiter-configuration.md');