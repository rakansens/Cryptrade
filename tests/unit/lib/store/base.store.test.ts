/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { createBaseStore } from '@/lib/store/base.store';

// Import JSDOM setup for this test
require('@/tests/setup/jsdom-environment');

describe('Store: createBaseStore', () => {

  // Mock logger
  jest.mock('@/lib/utils/logger', () => ({
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }
  }));

  // Mock zustand helpers
  jest.mock('@/lib/utils/zustand-helpers', () => ({
    createStoreDebugger: () => jest.fn()
  }));
  beforeEach(() => {
    createBaseStore.setState(createBaseStore.getInitialState());
  });

  it('should have initial state', () => {
    const { result } = renderHook(() => createBaseStore());
    
    expect(result.current).toBeDefined();
    // Add specific initial state checks
  });

  it('should update state correctly', () => {
    const { result } = renderHook(() => createBaseStore());
    
    act(() => {
      // Add state update action
    });
    
    // Add assertions for updated state
  });

  it('should handle async actions', async () => {
    const { result } = renderHook(() => createBaseStore());
    
    await act(async () => {
      // Add async action
    });
    
    // Add assertions
  });

  it('should persist state changes', () => {
    const { result: result1 } = renderHook(() => createBaseStore());
    
    act(() => {
      // Update state
    });
    
    const { result: result2 } = renderHook(() => createBaseStore());
    
    // Verify state persists across different hook instances
  });
});
