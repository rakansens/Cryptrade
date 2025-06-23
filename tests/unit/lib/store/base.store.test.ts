/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { act } from 'react';;
import { createBaseStore, type BaseState, type BaseActions } from '@/lib/store/base.store';

// Import JSDOM setup for this test
require('@/tests/setup/jsdom-environment');

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

describe('Store: createBaseStore', () => {
  // Create a test store for testing
  interface TestState extends BaseState {
    testValue: string;
  }

  interface TestActions extends BaseActions {
    setTestValue: (value: string) => void;
  }

  const testStore = createBaseStore<TestState, TestActions>(
    {
      name: 'TestStore',
      initialState: {
        error: null,
        isLoading: false,
        lastUpdateTime: 0,
        testValue: 'initial',
      },
      defaultState: {
        error: null,
        isLoading: false,
        lastUpdateTime: 0,
        testValue: 'default',
      },
    },
    (set, _get, debug) => ({
      setTestValue: (value: string) => {
        debug('setTestValue');
        set({ testValue: value });
      },
    })
  );

  beforeEach(() => {
    testStore.setState({
      error: null,
      isLoading: false,
      lastUpdateTime: 0,
      testValue: 'initial',
    });
  });

  it('should have initial state', () => {
    const { result } = renderHook(() => testStore());
    
    expect(result.current).toBeDefined();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.testValue).toBe('initial');
  });

  it('should update state correctly', () => {
    const { result } = renderHook(() => testStore());
    
    act(() => {
      result.current.setTestValue('updated');
    });
    
    expect(result.current.testValue).toBe('updated');
  });

  it('should handle async actions', async () => {
    const { result } = renderHook(() => testStore());
    
    await act(async () => {
      result.current.setLoading(true);
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 10));
      result.current.setLoading(false);
      result.current.setTestValue('async-updated');
    });
    
    expect(result.current.isLoading).toBe(false);
    expect(result.current.testValue).toBe('async-updated');
  });

  it('should persist state changes', () => {
    const { result: result1 } = renderHook(() => testStore());
    
    act(() => {
      result1.current.setTestValue('persisted');
    });
    
    const { result: result2 } = renderHook(() => testStore());
    
    // Verify state persists across different hook instances
    expect(result2.current.testValue).toBe('persisted');
  });
});
