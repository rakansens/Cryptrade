#!/bin/bash

echo "🔧 Applying test fixes..."

# Create babel config if it doesn't exist
if [ ! -f babel.config.js ]; then
  echo "Creating babel.config.js..."
  cat > babel.config.js << 'EOF'
module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current',
      },
    }],
    '@babel/preset-typescript',
    ['@babel/preset-react', {
      runtime: 'automatic',
    }],
  ],
  plugins: [],
};
EOF
fi

# Install babel dependencies
echo "Installing babel dependencies..."
npm install --save-dev @babel/core@^7.24.0 @babel/preset-env@^7.24.0 @babel/preset-react@^7.24.0 @babel/preset-typescript@^7.24.0 babel-jest@^29.7.0

# Fix jest.setup.js for zustand mocking
echo "Fixing jest.setup.js..."
sed -i.bak '461s/Object.defineProperty/Object.defineProperties/' jest.setup.js
sed -i.bak '464s/return useStore;/return Object.assign(useStore, store);/' jest.setup.js

# Fix use-auth.test.ts
echo "Fixing use-auth.test.ts..."
if [ -f tests/unit/hooks/use-auth.test.ts ]; then
  # Create a temporary file with the fix
  cat > tests/unit/hooks/use-auth.test.ts.tmp << 'EOF'
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AuthProvider } from '@/app/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

// Mock dependencies
jest.mock('@supabase/ssr');

// Mock router functions
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockPrefetch = jest.fn();
const mockBack = jest.fn();

// Update the router mock to return the mock functions
(useRouter as jest.Mock).mockReturnValue({
  push: mockPush,
  replace: mockReplace,
  prefetch: mockPrefetch,
  back: mockBack,
  pathname: '/',
  query: {},
  asPath: '/',
});
EOF
  
  # Replace the first part of the file
  tail -n +24 tests/unit/hooks/use-auth.test.ts >> tests/unit/hooks/use-auth.test.ts.tmp
  mv tests/unit/hooks/use-auth.test.ts.tmp tests/unit/hooks/use-auth.test.ts
fi

# Fix jest config to use babel-jest
echo "Updating jest.config.base.js..."
cat > config/jest/jest.config.base.js.tmp << 'EOF'
/** @type {import("jest").Config} */
module.exports = {
  // Use babel-jest for better JSX/TSX support
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-typescript',
        ['@babel/preset-react', { runtime: 'automatic' }]
      ],
    }]
  },
EOF
tail -n +10 config/jest/jest.config.base.js >> config/jest/jest.config.base.js.tmp
mv config/jest/jest.config.base.js.tmp config/jest/jest.config.base.js

# Fix store tests
echo "Fixing store tests..."
node scripts/fix-store-tests.js

echo "✅ Test fixes applied!"
echo ""
echo "Next steps:"
echo "1. Run: npm test -- --testPathPattern='analysis-history.store.test' to test store fixes"
echo "2. Run: npm test -- --testPathPattern='use-auth.test' to test auth fixes"
echo "3. Run: npm test to run all tests"