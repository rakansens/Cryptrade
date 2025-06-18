#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all generated test files
const testFiles = glob.sync('tests/unit/app/api/**/route.test.ts');

testFiles.forEach(testFile => {
  console.log(`Fixing: ${testFile}`);
  
  let content = fs.readFileSync(testFile, 'utf-8');
  
  // Replace next-auth import and mock
  content = content.replace(
    `import { getServerSession } from 'next-auth';`,
    `// Authentication is handled by withAuth wrapper`
  );
  
  content = content.replace(
    `// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));`,
    `// Mock dependencies
jest.mock('@/lib/api/auth-handler', () => ({
  withAuth: jest.fn((handler) => handler),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));`
  );
  
  // Replace getServerSession mock calls with request modifications
  content = content.replace(
    /\(getServerSession as jest\.Mock\)\.mockResolvedValueOnce\(\{[\s\S]*?\}\);/g,
    `// Authentication is mocked in the request`
  );
  
  content = content.replace(
    /\(getServerSession as jest\.Mock\)\.mockResolvedValueOnce\(null\);/g,
    `// No authentication for this test`
  );
  
  content = content.replace(
    /\(getServerSession as jest\.Mock\)\.mockResolvedValue\(\{[\s\S]*?\}\);/g,
    `// Authentication is mocked in the request`
  );
  
  // Update request creation to include auth headers
  content = content.replace(
    /const request = new NextRequest\((.*?)\{([\s\S]*?)\}\);/g,
    (match, url, options) => {
      if (options.includes('// No authentication for this test')) {
        return match;
      }
      
      // Add auth headers for authenticated requests
      if (!options.includes('Authorization')) {
        const newOptions = options.replace(
          `headers: {`,
          `headers: {
          'Authorization': 'Bearer test-token',`
        );
        return `const request = new NextRequest(${url}{${newOptions}});`;
      }
      
      return match;
    }
  );
  
  // Add userId to authenticated requests
  content = content.replace(
    /const request = new NextRequest\((.*?)\);/g,
    (match, args) => {
      if (match.includes('Authorization')) {
        return match.replace('const request =', 'const request: any =') + `
      request.userId = '123';
      request.session = { expires_at: new Date(Date.now() + 86400000) };`;
      }
      return match;
    }
  );
  
  // Fix import path to remove .ts extension
  content = content.replace(/from '(.*?)\.ts'/g, "from '$1'");
  
  fs.writeFileSync(testFile, content, 'utf-8');
  console.log(`✅ Fixed: ${testFile}`);
});

console.log(`\n✅ Fixed ${testFiles.length} test files`);