import { renderHook, act, waitFor } from '@testing-library/react';
import { useAsyncFn } from '../use-async';

describe('useAsyncFn', () => {
  describe('initial state', () => {
    it('should initialize with default state', () => {
      const asyncFn = jest.fn().mockResolvedValue('test');
      
      const { result } = renderHook(() => useAsyncFn(asyncFn));
      
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.result).toBeNull();
    });
  });

  describe('execute function', () => {
    it('should execute async function and update state', async () => {
      const mockData = { id: 1, name: 'Test' };
      const asyncFn = jest.fn().mockResolvedValue(mockData);
      
      const { result } = renderHook(() => useAsyncFn(asyncFn));
      
      // Execute the async function
      await act(async () => {
        const returnValue = await result.current.execute();
        expect(returnValue).toBe(mockData);
      });
      
      // Check final state
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.result).toEqual(mockData);
      expect(asyncFn).toHaveBeenCalledTimes(1);
    });

    it('should handle loading state correctly', async () => {
      const asyncFn = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('delayed'), 100))
      );
      
      const { result } = renderHook(() => useAsyncFn(asyncFn));
      
      // Start execution
      act(() => {
        result.current.execute();
      });
      
      // Check loading state immediately
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
      
      // Wait for completion
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.result).toBe('delayed');
    });

    it('should handle errors correctly', async () => {
      const errorMessage = 'Something went wrong';
      const asyncFn = jest.fn().mockRejectedValue(new Error(errorMessage));
      
      const { result } = renderHook(() => useAsyncFn(asyncFn));
      
      // Execute and expect void return on error
      await act(async () => {
        const returnValue = await result.current.execute();
        expect(returnValue).toBeUndefined();
      });
      
      // Check error state
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.result).toBeNull();
    });

    it('should handle non-Error objects', async () => {
      const asyncFn = jest.fn().mockRejectedValue('String error');
      
      const { result } = renderHook(() => useAsyncFn(asyncFn));
      
      await act(async () => {
        await result.current.execute();
      });
      
      expect(result.current.error).toBe('String error');
    });

    it('should pass arguments to async function', async () => {
      const asyncFn = jest.fn((a: number, b: string) => 
        Promise.resolve({ sum: a, text: b })
      );
      
      const { result } = renderHook(() => 
        useAsyncFn<[number, string], { sum: number; text: string }>(asyncFn)
      );
      
      await act(async () => {
        const returnValue = await result.current.execute(5, 'hello');
        expect(returnValue).toEqual({ sum: 5, text: 'hello' });
      });
      
      expect(asyncFn).toHaveBeenCalledWith(5, 'hello');
      expect(result.current.result).toEqual({ sum: 5, text: 'hello' });
    });

    it('should clear error on new execution', async () => {
      const asyncFn = jest.fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce('Success');
      
      const { result } = renderHook(() => useAsyncFn(asyncFn));
      
      // First execution - error
      await act(async () => {
        await result.current.execute();
      });
      
      expect(result.current.error).toBe('First error');
      
      // Second execution - success
      await act(async () => {
        await result.current.execute();
      });
      
      expect(result.current.error).toBeNull();
      expect(result.current.result).toBe('Success');
    });
  });

  describe('reset function', () => {
    it('should reset all state to initial values', async () => {
      const asyncFn = jest.fn().mockResolvedValue('test data');
      
      const { result } = renderHook(() => useAsyncFn(asyncFn));
      
      // Execute to set some data
      await act(async () => {
        await result.current.execute();
      });
      
      expect(result.current.result).toBe('test data');
      
      // Reset
      act(() => {
        result.current.reset();
      });
      
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.result).toBeNull();
    });

    it('should reset error state', async () => {
      const asyncFn = jest.fn().mockRejectedValue(new Error('Test error'));
      
      const { result } = renderHook(() => useAsyncFn(asyncFn));
      
      // Execute to cause error
      await act(async () => {
        await result.current.execute();
      });
      
      expect(result.current.error).toBe('Test error');
      
      // Reset
      act(() => {
        result.current.reset();
      });
      
      expect(result.current.error).toBeNull();
    });
  });

  describe('immediate option', () => {
    it('should execute immediately on mount when immediate is true', async () => {
      const asyncFn = jest.fn().mockResolvedValue('immediate result');
      
      const { result } = renderHook(() => 
        useAsyncFn(asyncFn, { immediate: true })
      );
      
      // Should start loading immediately
      expect(result.current.loading).toBe(true);
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.result).toBe('immediate result');
      expect(asyncFn).toHaveBeenCalledTimes(1);
    });

    it('should not execute immediately when immediate is false', () => {
      const asyncFn = jest.fn().mockResolvedValue('test');
      
      renderHook(() => 
        useAsyncFn(asyncFn, { immediate: false })
      );
      
      expect(asyncFn).not.toHaveBeenCalled();
    });

    it('should execute with empty args when immediate is true', async () => {
      const asyncFn = jest.fn().mockResolvedValue('no args');
      
      renderHook(() => 
        useAsyncFn(asyncFn, { immediate: true })
      );
      
      await waitFor(() => {
        expect(asyncFn).toHaveBeenCalledWith();
      });
    });
  });

  describe('deps option', () => {
    it('should update execute function when deps change', () => {
      const asyncFn = jest.fn().mockResolvedValue('test');
      const dep1 = { value: 1 };
      const dep2 = { value: 2 };
      
      const { result, rerender } = renderHook(
        ({ deps }) => useAsyncFn(asyncFn, { deps }),
        { initialProps: { deps: [dep1] } }
      );
      
      const firstExecute = result.current.execute;
      
      // Change deps
      rerender({ deps: [dep2] });
      
      expect(result.current.execute).not.toBe(firstExecute);
    });

    it('should not update execute function when deps are the same', () => {
      const asyncFn = jest.fn().mockResolvedValue('test');
      const dep = 'constant';
      
      const { result, rerender } = renderHook(
        ({ deps }) => useAsyncFn(asyncFn, { deps }),
        { initialProps: { deps: [dep] } }
      );
      
      const firstExecute = result.current.execute;
      
      // Rerender with same deps
      rerender({ deps: [dep] });
      
      expect(result.current.execute).toBe(firstExecute);
    });
  });

  describe('concurrent executions', () => {
    it('should handle multiple rapid executions', async () => {
      let callCount = 0;
      const asyncFn = jest.fn().mockImplementation(async () => {
        callCount++;
        const currentCall = callCount;
        await new Promise(resolve => setTimeout(resolve, 50));
        return `Result ${currentCall}`;
      });
      
      const { result } = renderHook(() => useAsyncFn(asyncFn));
      
      // Execute multiple times rapidly
      act(() => {
        result.current.execute();
        result.current.execute();
        result.current.execute();
      });
      
      expect(result.current.loading).toBe(true);
      
      // Wait for all to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      // Should have the result from the last execution
      expect(result.current.result).toBe('Result 3');
      expect(asyncFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('hook lifecycle', () => {
    it('should maintain stable reset function reference', () => {
      const asyncFn = jest.fn().mockResolvedValue('test');
      
      const { result, rerender } = renderHook(() => useAsyncFn(asyncFn));
      
      const firstReset = result.current.reset;
      
      // Rerender
      rerender();
      
      expect(result.current.reset).toBe(firstReset);
    });

    it('should handle asyncFn reference changes', async () => {
      const asyncFn1 = jest.fn().mockResolvedValue('result1');
      const asyncFn2 = jest.fn().mockResolvedValue('result2');
      
      const { result, rerender } = renderHook(
        ({ fn }) => useAsyncFn(fn),
        { initialProps: { fn: asyncFn1 } }
      );
      
      // Execute with first function
      await act(async () => {
        await result.current.execute();
      });
      
      expect(result.current.result).toBe('result1');
      
      // Change the async function
      rerender({ fn: asyncFn2 });
      
      // Execute with second function
      await act(async () => {
        await result.current.execute();
      });
      
      expect(result.current.result).toBe('result2');
    });
  });

  describe('TypeScript type safety', () => {
    it('should infer correct types', async () => {
      interface User {
        id: number;
        name: string;
      }
      
      const fetchUser = async (id: number): Promise<User> => {
        return { id, name: 'John' };
      };
      
      const { result } = renderHook(() => 
        useAsyncFn<[number], User>(fetchUser)
      );
      
      await act(async () => {
        const user = await result.current.execute(1);
        // TypeScript should know user is User | void
        if (user) {
          expect(user.name).toBe('John');
        }
      });
      
      // TypeScript should know result is User | null
      expect(result.current.result?.id).toBe(1);
    });

    it('should handle functions with multiple arguments', async () => {
      const createUser = async (name: string, age: number, admin: boolean): Promise<{ name: string; age: number; admin: boolean }> => {
        return { name, age, admin };
      };
      
      const { result } = renderHook(() => 
        useAsyncFn<[string, number, boolean], { name: string; age: number; admin: boolean }>(createUser)
      );
      
      await act(async () => {
        await result.current.execute('Alice', 25, true);
      });
      
      expect(result.current.result).toEqual({
        name: 'Alice',
        age: 25,
        admin: true
      });
    });
  });

  describe('edge cases', () => {
    it('should handle undefined return values', async () => {
      const asyncFn = jest.fn().mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useAsyncFn(asyncFn));
      
      await act(async () => {
        const returnValue = await result.current.execute();
        expect(returnValue).toBeUndefined();
      });
      
      expect(result.current.result).toBeUndefined();
      expect(result.current.error).toBeNull();
    });

    it('should handle null return values', async () => {
      const asyncFn = jest.fn().mockResolvedValue(null);
      
      const { result } = renderHook(() => useAsyncFn(asyncFn));
      
      await act(async () => {
        const returnValue = await result.current.execute();
        expect(returnValue).toBeNull();
      });
      
      expect(result.current.result).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });
});