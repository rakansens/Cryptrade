import { renderHook, act, waitFor } from '@testing-library/react';
import { useAsyncState } from '../use-async-state';

describe('useAsyncState', () => {
  describe('initial state', () => {
    it('should initialize with default state', () => {
      const asyncFn = jest.fn().mockResolvedValue('test');
      
      const { result } = renderHook(() => useAsyncState(asyncFn));
      
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.data).toBeNull();
    });
  });

  describe('execute function', () => {
    it('should execute async function and update state', async () => {
      const mockData = { id: 1, name: 'Test' };
      const asyncFn = jest.fn().mockResolvedValue(mockData);
      
      const { result } = renderHook(() => useAsyncState(asyncFn));
      
      // Execute the async function
      await act(async () => {
        const returnValue = await result.current.execute();
        expect(returnValue).toBe(mockData);
      });
      
      // Check final state
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.data).toEqual(mockData);
      expect(asyncFn).toHaveBeenCalledTimes(1);
    });

    it('should handle loading state correctly', async () => {
      const asyncFn = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('delayed'), 100))
      );
      
      const { result } = renderHook(() => useAsyncState(asyncFn));
      
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
      
      expect(result.current.data).toBe('delayed');
    });

    it('should handle errors correctly', async () => {
      const errorMessage = 'Something went wrong';
      const asyncFn = jest.fn().mockRejectedValue(new Error(errorMessage));
      
      const { result } = renderHook(() => useAsyncState(asyncFn));
      
      // Execute and expect null return on error
      await act(async () => {
        const returnValue = await result.current.execute();
        expect(returnValue).toBeNull();
      });
      
      // Check error state
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.data).toBeNull();
    });

    it('should handle non-Error objects', async () => {
      const asyncFn = jest.fn().mockRejectedValue('String error');
      
      const { result } = renderHook(() => useAsyncState(asyncFn));
      
      await act(async () => {
        await result.current.execute();
      });
      
      expect(result.current.error).toBe('Unknown Error');
    });

    it('should pass arguments to async function', async () => {
      const asyncFn = jest.fn((a: number, b: string) => 
        Promise.resolve({ sum: a, text: b })
      );
      
      const { result } = renderHook(() => 
        useAsyncState<{ sum: number; text: string }, [number, string]>(asyncFn)
      );
      
      await act(async () => {
        const returnValue = await result.current.execute(5, 'hello');
        expect(returnValue).toEqual({ sum: 5, text: 'hello' });
      });
      
      expect(asyncFn).toHaveBeenCalledWith(5, 'hello');
      expect(result.current.data).toEqual({ sum: 5, text: 'hello' });
    });

    it('should clear error on new execution', async () => {
      const asyncFn = jest.fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce('Success');
      
      const { result } = renderHook(() => useAsyncState(asyncFn));
      
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
      expect(result.current.data).toBe('Success');
    });
  });

  describe('reset function', () => {
    it('should reset all state to initial values', async () => {
      const asyncFn = jest.fn().mockResolvedValue('test data');
      
      const { result } = renderHook(() => useAsyncState(asyncFn));
      
      // Execute to set some data
      await act(async () => {
        await result.current.execute();
      });
      
      expect(result.current.data).toBe('test data');
      
      // Reset
      act(() => {
        result.current.reset();
      });
      
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.data).toBeNull();
    });

    it('should reset error state', async () => {
      const asyncFn = jest.fn().mockRejectedValue(new Error('Test error'));
      
      const { result } = renderHook(() => useAsyncState(asyncFn));
      
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

  describe('concurrent executions', () => {
    it('should handle multiple rapid executions', async () => {
      let callCount = 0;
      const asyncFn = jest.fn().mockImplementation(async () => {
        callCount++;
        const currentCall = callCount;
        await new Promise(resolve => setTimeout(resolve, 50));
        return `Result ${currentCall}`;
      });
      
      const { result } = renderHook(() => useAsyncState(asyncFn));
      
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
      expect(result.current.data).toBe('Result 3');
      expect(asyncFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('hook lifecycle', () => {
    it('should maintain stable function references', () => {
      const asyncFn = jest.fn().mockResolvedValue('test');
      
      const { result, rerender } = renderHook(() => useAsyncState(asyncFn));
      
      const firstExecute = result.current.execute;
      const firstReset = result.current.reset;
      
      // Rerender
      rerender();
      
      expect(result.current.execute).toBe(firstExecute);
      expect(result.current.reset).toBe(firstReset);
    });

    it('should update execute function when asyncFn changes', () => {
      const asyncFn1 = jest.fn().mockResolvedValue('result1');
      const asyncFn2 = jest.fn().mockResolvedValue('result2');
      
      const { result, rerender } = renderHook(
        ({ fn }) => useAsyncState(fn),
        { initialProps: { fn: asyncFn1 } }
      );
      
      const firstExecute = result.current.execute;
      
      // Change the async function
      rerender({ fn: asyncFn2 });
      
      expect(result.current.execute).not.toBe(firstExecute);
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
        useAsyncState<User, [number]>(fetchUser)
      );
      
      await act(async () => {
        const user = await result.current.execute(1);
        // TypeScript should know user is User | null
        expect(user?.name).toBe('John');
      });
      
      // TypeScript should know data is User | null
      expect(result.current.data?.id).toBe(1);
    });
  });
});