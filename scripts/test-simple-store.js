#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('Creating simple store test...\n');

const testContent = `
/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { useConfigStore } from '@/store/config.store';

describe('Simple Store Test', () => {
  it('should access store', () => {
    const { result } = renderHook(() => useConfigStore());
    console.log('Store state:', result.current);
    expect(result.current).toBeDefined();
  });
});
`;

// Write test file
const fs = require('fs');
const testPath = path.join(__dirname, '..', 'tests', 'unit', 'store', 'simple.test.ts');
fs.writeFileSync(testPath, testContent);

try {
  // Run the test
  execSync(`npx jest ${testPath} --no-coverage`, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
} catch (error) {
  console.error('Test failed');
} finally {
  // Clean up
  fs.unlinkSync(testPath);
}