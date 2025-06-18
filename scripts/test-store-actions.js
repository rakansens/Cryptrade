#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('Testing store actions...\n');

const testContent = `
/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { useConfigStore, useConfigActions } from '@/store/config.store';

describe('Store Actions Test', () => {
  it('should access store directly', () => {
    const { result } = renderHook(() => useConfigStore());
    const state = result.current;
    console.log('Direct store access - type of resetToDefaults:', typeof state.resetToDefaults);
    console.log('Direct store keys:', Object.keys(state));
    expect(state).toBeDefined();
  });

  it('should access actions hook', () => {
    const { result } = renderHook(() => useConfigActions());
    console.log('Actions hook result:', result.current);
    console.log('Actions hook keys:', Object.keys(result.current));
    console.log('Type of resetToDefaults from actions:', typeof result.current.resetToDefaults);
    expect(result.current).toBeDefined();
  });

  it('should call resetToDefaults', () => {
    const { result } = renderHook(() => useConfigStore());
    
    // Set some custom values first
    act(() => {
      result.current.setThemeMode('light');
    });
    
    expect(result.current.theme.mode).toBe('light');
    
    // Reset to defaults
    act(() => {
      result.current.resetToDefaults();
    });
    
    // Should be back to dark mode (default)
    expect(result.current.theme.mode).toBe('dark');
  });
});
`;

// Write test file
const fs = require('fs');
const testPath = path.join(__dirname, '..', 'tests', 'unit', 'store', 'actions.test.ts');
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