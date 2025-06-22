/**
 * @jest-environment jsdom
 */
import React from 'react';
import { renderHook } from '@testing-library/react';

// Mock Next.js hooks before importing the hook
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: () => null,
    toString: () => '',
  }),
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Now import the hook
import { useViewPersistence } from '@/hooks/use-view-persistence';

describe('useViewPersistence simple test', () => {
  it('should return an object with expected properties', () => {
    const { result } = renderHook(() => useViewPersistence());
    
    console.log('Hook result:', result.current);
    
    // First, check if we get anything at all
    expect(result.current).toBeDefined();
    
    // Check the type of what we get
    console.log('Type of result.current:', typeof result.current);
    
    // If it's an object, check its keys
    if (result.current && typeof result.current === 'object') {
      console.log('Keys:', Object.keys(result.current));
    }
    
    // Basic expectations
    expect(result.current).toHaveProperty('currentView');
    expect(result.current).toHaveProperty('showHome');
    expect(result.current).toHaveProperty('showChat');
    expect(result.current).toHaveProperty('setView');
    expect(result.current).toHaveProperty('goToChat');
    expect(result.current).toHaveProperty('goToHome');
  });
});