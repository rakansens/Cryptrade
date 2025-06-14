import { createStoreDebugger } from '../zustand-helpers';

describe('zustand-helpers', () => {
  describe('createStoreDebugger', () => {
    let originalEnv: string | undefined;
    let consoleDebugSpy: jest.SpyInstance;

    beforeEach(() => {
      // Save original NODE_ENV
      originalEnv = process.env.NODE_ENV;
      // Mock console.debug
      consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    });

    afterEach(() => {
      // Restore original NODE_ENV
      process.env.NODE_ENV = originalEnv;
      // Restore console.debug
      consoleDebugSpy.mockRestore();
    });

    it('should log debug messages in development environment', () => {
      process.env.NODE_ENV = 'development';
      
      const debug = createStoreDebugger('TestStore');
      debug('action performed');

      expect(consoleDebugSpy).toHaveBeenCalledWith('[TestStore] action performed');
    });

    it('should not log debug messages in production environment', () => {
      process.env.NODE_ENV = 'production';
      
      const debug = createStoreDebugger('TestStore');
      debug('action performed');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should not log debug messages in test environment', () => {
      process.env.NODE_ENV = 'test';
      
      const debug = createStoreDebugger('TestStore');
      debug('action performed');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should handle undefined NODE_ENV', () => {
      delete process.env.NODE_ENV;
      
      const debug = createStoreDebugger('TestStore');
      debug('action performed');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should include store name in debug output', () => {
      process.env.NODE_ENV = 'development';
      
      const chartDebug = createStoreDebugger('ChartStore');
      const chatDebug = createStoreDebugger('ChatStore');
      
      chartDebug('chart updated');
      chatDebug('message sent');

      expect(consoleDebugSpy).toHaveBeenCalledWith('[ChartStore] chart updated');
      expect(consoleDebugSpy).toHaveBeenCalledWith('[ChatStore] message sent');
    });

    it('should handle empty store name', () => {
      process.env.NODE_ENV = 'development';
      
      const debug = createStoreDebugger('');
      debug('anonymous action');

      expect(consoleDebugSpy).toHaveBeenCalledWith('[] anonymous action');
    });

    it('should handle special characters in store name', () => {
      process.env.NODE_ENV = 'development';
      
      const debug = createStoreDebugger('Test-Store_v2.0');
      debug('action with special chars');

      expect(consoleDebugSpy).toHaveBeenCalledWith('[Test-Store_v2.0] action with special chars');
    });

    it('should handle empty action string', () => {
      process.env.NODE_ENV = 'development';
      
      const debug = createStoreDebugger('TestStore');
      debug('');

      expect(consoleDebugSpy).toHaveBeenCalledWith('[TestStore] ');
    });

    it('should handle very long action strings', () => {
      process.env.NODE_ENV = 'development';
      
      const debug = createStoreDebugger('TestStore');
      const longAction = 'a'.repeat(1000);
      debug(longAction);

      expect(consoleDebugSpy).toHaveBeenCalledWith(`[TestStore] ${longAction}`);
    });

    it('should be reusable for multiple actions', () => {
      process.env.NODE_ENV = 'development';
      
      const debug = createStoreDebugger('TestStore');
      
      debug('action1');
      debug('action2');
      debug('action3');

      expect(consoleDebugSpy).toHaveBeenCalledTimes(3);
      expect(consoleDebugSpy).toHaveBeenNthCalledWith(1, '[TestStore] action1');
      expect(consoleDebugSpy).toHaveBeenNthCalledWith(2, '[TestStore] action2');
      expect(consoleDebugSpy).toHaveBeenNthCalledWith(3, '[TestStore] action3');
    });

    it('should handle Unicode characters in actions', () => {
      process.env.NODE_ENV = 'development';
      
      const debug = createStoreDebugger('TestStore');
      debug('アクション実行 🚀');

      expect(consoleDebugSpy).toHaveBeenCalledWith('[TestStore] アクション実行 🚀');
    });

    it('should handle multiline action strings', () => {
      process.env.NODE_ENV = 'development';
      
      const debug = createStoreDebugger('TestStore');
      debug('action\nwith\nmultiple\nlines');

      expect(consoleDebugSpy).toHaveBeenCalledWith('[TestStore] action\nwith\nmultiple\nlines');
    });

    it('should return a stable function reference', () => {
      const debug1 = createStoreDebugger('TestStore');
      const debug2 = createStoreDebugger('TestStore');

      expect(typeof debug1).toBe('function');
      expect(typeof debug2).toBe('function');
      // They should be different function instances
      expect(debug1).not.toBe(debug2);
    });

    it('should handle errors in console.debug gracefully', () => {
      process.env.NODE_ENV = 'development';
      
      // Mock console.debug to throw an error
      consoleDebugSpy.mockImplementation(() => {
        throw new Error('Console error');
      });

      const debug = createStoreDebugger('TestStore');
      
      // Should not throw
      expect(() => debug('action')).not.toThrow();
    });

    describe('Performance considerations', () => {
      it('should have minimal overhead in production', () => {
        process.env.NODE_ENV = 'production';
        
        const debug = createStoreDebugger('PerfStore');
        const iterations = 10000;
        
        const start = Date.now();
        for (let i = 0; i < iterations; i++) {
          debug(`action ${i}`);
        }
        const end = Date.now();
        
        // Should complete very quickly since it doesn't actually log
        expect(end - start).toBeLessThan(100);
        expect(consoleDebugSpy).not.toHaveBeenCalled();
      });
    });
  });
});