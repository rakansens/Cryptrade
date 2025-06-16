// Mock logger before imports
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PluginRegistry } from '../PluginRegistry';
import type { 
  IRendererPlugin, 
  PluginContext, 
  PluginMetadata, 
  PluginOptions 
} from '../interfaces';
import type { PatternVisualization } from '@/types/pattern';

// Mock plugin implementation
class MockPlugin implements IRendererPlugin {
  name = 'test-plugin';
  initialized = false;
  disposed = false;

  supports(data: PatternVisualization): boolean {
    // Check if pattern has certain characteristics
    return data.keyPoints.length >= 3;
  }

  async render(_id: string, _data: PatternVisualization): Promise<void> {
    if (!this.initialized) {
      throw new Error('Plugin not initialized');
    }
    // Mock rendering
  }

  async remove(_id: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Plugin not initialized');
    }
    // Mock removal
  }

  initialize(_context: PluginContext): void {
    this.initialized = true;
  }

  dispose(): void {
    this.disposed = true;
  }
}

// Async dispose plugin
class AsyncDisposePlugin extends MockPlugin {
  override name = 'async-dispose-plugin';
  
  override async dispose(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 10));
    this.disposed = true;
  }
}

// Error-prone plugin
class ErrorPlugin extends MockPlugin {
  override name = 'error-plugin';
  
  override supports(): boolean {
    throw new Error('Support check failed');
  }

  override async render(): Promise<void> {
    throw new Error('Render failed');
  }

  override async remove(): Promise<void> {
    throw new Error('Remove failed');
  }

  override initialize(): void {
    throw new Error('Initialize failed');
  }

  override dispose(): void {
    throw new Error('Dispose failed');
  }
}

describe('PluginRegistry', () => {
  let registry: PluginRegistry;
  let mockContext: PluginContext;
  let mockPlugin: MockPlugin;
  let mockPattern: PatternVisualization;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockContext = {
      instanceId: 123,
      chart: {} as any,
      mainSeries: {} as any,
      registry: {} as any,
      utilities: {
        getLineColor: jest.fn(),
        convertLineStyle: jest.fn(),
        addOpacity: jest.fn(),
        calculateTimeRange: jest.fn(),
      } as any,
    };

    mockPlugin = new MockPlugin();
    
    mockPattern = {
      keyPoints: [
        { time: 1234567890, value: 50000, type: 'peak' as const },
        { time: 1234567895, value: 49000, type: 'trough' as const },
        { time: 1234567900, value: 51000, type: 'peak' as const }
      ],
      lines: [
        { from: 0, to: 2, type: 'resistance' as const }
      ]
    };

    registry = new PluginRegistry(mockContext);
  });

  describe('constructor', () => {
    it('should create registry with context', () => {
      const reg = new PluginRegistry(mockContext);
      expect(reg).toBeDefined();
    });

    it('should create registry without context', () => {
      const reg = new PluginRegistry();
      expect(reg).toBeDefined();
    });
  });

  describe('setContext', () => {
    it('should set context and reinitialize plugins', () => {
      const reg = new PluginRegistry();
      const plugin = new MockPlugin();
      
      reg.register(plugin);
      expect(plugin.initialized).toBe(false);
      
      reg.setContext(mockContext);
      expect(plugin.initialized).toBe(true);
    });

    it('should handle reinitialization errors gracefully', () => {
      const reg = new PluginRegistry();
      const errorPlugin = new ErrorPlugin();
      
      reg.register(errorPlugin);
      
      // Should not throw
      expect(() => reg.setContext(mockContext)).not.toThrow();
    });
  });

  describe('register', () => {
    it('should register a plugin successfully', () => {
      registry.register(mockPlugin);
      expect(registry.get('test-plugin')).toBe(mockPlugin);
      expect(mockPlugin.initialized).toBe(true);
    });

    it('should register plugin with metadata and options', () => {
      const metadata: PluginMetadata = {
        name: 'test-plugin',
        version: '1.0.0',
        author: 'Test Author',
        description: 'Test plugin',
        supports: ['triangle', 'flag'],
      };
      
      const options: PluginOptions = {
        enabled: true,
      };
      
      registry.register(mockPlugin, metadata, options);
      
      expect(registry.getMetadata('test-plugin')).toEqual(metadata);
      expect(registry.getOptions('test-plugin')).toEqual(options);
    });

    it('should replace existing plugin with warning', () => {
      const plugin1 = new MockPlugin();
      const plugin2 = new MockPlugin();
      
      registry.register(plugin1);
      registry.register(plugin2);
      
      expect(registry.get('test-plugin')).toBe(plugin2);
    });

    it('should handle initialization failure', () => {
      const errorPlugin = new ErrorPlugin();
      
      expect(() => registry.register(errorPlugin)).toThrow('Failed to initialize');
    });

    it('should not initialize if no context', () => {
      const reg = new PluginRegistry();
      const plugin = new MockPlugin();
      
      reg.register(plugin);
      expect(plugin.initialized).toBe(false);
    });
  });

  describe('get', () => {
    it('should retrieve registered plugin', () => {
      registry.register(mockPlugin);
      const retrieved = registry.get<MockPlugin>('test-plugin');
      
      expect(retrieved).toBe(mockPlugin);
    });

    it('should return undefined for non-existent plugin', () => {
      const retrieved = registry.get('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getSupporting', () => {
    it('should return plugins that support the data', () => {
      const plugin1 = new MockPlugin();
      plugin1.name = 'plugin1';
      
      const plugin2 = new MockPlugin();
      plugin2.name = 'plugin2';
      plugin2.supports = () => false;
      
      registry.register(plugin1);
      registry.register(plugin2);
      
      const supporting = registry.getSupporting(mockPattern);
      
      expect(supporting).toHaveLength(1);
      expect(supporting[0].name).toBe('plugin1');
    });

    it('should skip disabled plugins', () => {
      registry.register(mockPlugin, undefined, { enabled: false });
      
      const supporting = registry.getSupporting(mockPattern);
      expect(supporting).toHaveLength(0);
    });

    it('should handle support check errors', () => {
      const errorPlugin = new ErrorPlugin();
      const goodPlugin = new MockPlugin();
      goodPlugin.name = 'good-plugin';
      
      registry.register(errorPlugin);
      registry.register(goodPlugin);
      
      const supporting = registry.getSupporting(mockPattern);
      
      expect(supporting).toHaveLength(1);
      expect(supporting[0].name).toBe('good-plugin');
    });

    it('should return empty array when no plugins support data', () => {
      // Create a pattern with no keyPoints to ensure it's not supported
      const pattern: PatternVisualization = {
        keyPoints: [], // Empty keyPoints means MockPlugin won't support it
        lines: mockPattern.lines
      };
      
      registry.register(mockPlugin);
      
      const supporting = registry.getSupporting(pattern);
      expect(supporting).toHaveLength(0);
    });
  });

  describe('getAll', () => {
    it('should return all registered plugins', () => {
      const plugin1 = new MockPlugin();
      plugin1.name = 'plugin1';
      
      const plugin2 = new MockPlugin();
      plugin2.name = 'plugin2';
      
      registry.register(plugin1);
      registry.register(plugin2);
      
      const all = registry.getAll();
      
      expect(all).toHaveLength(2);
      expect(all.map(p => p.name)).toContain('plugin1');
      expect(all.map(p => p.name)).toContain('plugin2');
    });

    it('should return empty array when no plugins', () => {
      const all = registry.getAll();
      expect(all).toHaveLength(0);
    });
  });

  describe('unregister', () => {
    it('should unregister plugin successfully', () => {
      registry.register(mockPlugin);
      
      const result = registry.unregister('test-plugin');
      
      expect(result).toBe(true);
      expect(mockPlugin.disposed).toBe(true);
      expect(registry.get('test-plugin')).toBeUndefined();
    });

    it('should return false for non-existent plugin', () => {
      const result = registry.unregister('non-existent');
      expect(result).toBe(false);
    });

    it('should handle dispose errors', () => {
      const errorPlugin = new ErrorPlugin();
      registry.register(errorPlugin);
      
      const result = registry.unregister('error-plugin');
      expect(result).toBe(false);
    });

    it('should remove metadata and options', () => {
      registry.register(mockPlugin, { 
        name: 'test-plugin',
        version: '1.0.0',
        supports: ['test']
      }, { enabled: true });
      
      registry.unregister('test-plugin');
      
      expect(registry.getMetadata('test-plugin')).toBeUndefined();
      expect(registry.getOptions('test-plugin')).toBeUndefined();
    });
  });

  describe('dispose', () => {
    it('should dispose all plugins', async () => {
      const plugin1 = new MockPlugin();
      plugin1.name = 'plugin1';
      
      const plugin2 = new MockPlugin();
      plugin2.name = 'plugin2';
      
      registry.register(plugin1);
      registry.register(plugin2);
      
      await registry.dispose();
      
      expect(plugin1.disposed).toBe(true);
      expect(plugin2.disposed).toBe(true);
      expect(registry.getAll()).toHaveLength(0);
    });

    it('should handle async disposal', async () => {
      const asyncPlugin = new AsyncDisposePlugin();
      registry.register(asyncPlugin);
      
      await registry.dispose();
      
      expect(asyncPlugin.disposed).toBe(true);
    });

    it('should collect disposal errors', async () => {
      const errorPlugin = new ErrorPlugin();
      const goodPlugin = new MockPlugin();
      
      registry.register(errorPlugin);
      registry.register(goodPlugin);
      
      await expect(registry.dispose()).rejects.toThrow('Plugin disposal errors');
      expect(goodPlugin.disposed).toBe(true);
    });

    it('should clear all internal state', async () => {
      registry.register(mockPlugin, { 
        name: 'test-plugin',
        version: '1.0.0',
        supports: ['test']
      }, { enabled: true });
      
      await registry.dispose();
      
      expect(registry.getAll()).toHaveLength(0);
      expect(registry.getMetadata('test-plugin')).toBeUndefined();
      expect(registry.getOptions('test-plugin')).toBeUndefined();
    });
  });

  describe('metadata and options management', () => {
    beforeEach(() => {
      registry.register(mockPlugin);
    });

    it('should update plugin options', () => {
      const result = registry.updateOptions('test-plugin', { 
        enabled: false
      });
      
      expect(result).toBe(true);
      expect(registry.getOptions('test-plugin')).toEqual({
        enabled: false
      });
    });

    it('should merge options on update', () => {
      registry.updateOptions('test-plugin', { enabled: true });
      registry.updateOptions('test-plugin', { config: { priority: 3 } });
      
      expect(registry.getOptions('test-plugin')).toEqual({
        enabled: true,
        config: { priority: 3 }
      });
    });

    it('should set plugin enabled state', () => {
      registry.setPluginEnabled('test-plugin', false);
      
      expect(registry.getOptions('test-plugin')).toEqual({
        enabled: false,
      });
    });
  });

  describe('renderWithAllSupporting', () => {
    it('should render with all supporting plugins', async () => {
      const plugin1 = new MockPlugin();
      plugin1.name = 'plugin1';
      
      const plugin2 = new MockPlugin();
      plugin2.name = 'plugin2';
      
      registry.register(plugin1);
      registry.register(plugin2);
      
      const result = await registry.renderWithAllSupporting(
        'pattern-1',
        mockPattern
      );
      
      expect(result.successes).toEqual(['plugin1', 'plugin2']);
      expect(result.failures).toHaveLength(0);
    });

    it('should handle render failures', async () => {
      const errorPlugin = new ErrorPlugin();
      const goodPlugin = new MockPlugin();
      goodPlugin.name = 'good-plugin';
      
      registry.register(errorPlugin);
      registry.register(goodPlugin);
      
      const result = await registry.renderWithAllSupporting(
        'pattern-1',
        mockPattern
      );
      
      expect(result.successes).toEqual(['good-plugin']);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toEqual({
        plugin: 'error-plugin',
        error: 'Error: Render failed',
      });
    });

    it('should pass extra data to render', async () => {
      const customPlugin = new MockPlugin();
      customPlugin.render = jest.fn() as any;
      
      registry.register(customPlugin);
      
      const extraData = { custom: 'data' };
      await registry.renderWithAllSupporting(
        'pattern-1',
        mockPattern,
        extraData
      );
      
      expect(customPlugin.render).toHaveBeenCalledWith(
        'pattern-1',
        mockPattern,
        extraData
      );
    });
  });

  describe('removeWithAllSupporting', () => {
    it('should remove from all plugins', async () => {
      const plugin1 = new MockPlugin();
      plugin1.name = 'plugin1';
      plugin1.remove = jest.fn() as any;
      
      const plugin2 = new MockPlugin();
      plugin2.name = 'plugin2';
      plugin2.remove = jest.fn() as any;
      
      registry.register(plugin1);
      registry.register(plugin2);
      
      const result = await registry.removeWithAllSupporting('pattern-1');
      
      expect(result.successes).toEqual(['plugin1', 'plugin2']);
      expect(result.failures).toHaveLength(0);
      expect(plugin1.remove).toHaveBeenCalledWith('pattern-1');
      expect(plugin2.remove).toHaveBeenCalledWith('pattern-1');
    });

    it('should handle remove failures gracefully', async () => {
      const errorPlugin = new ErrorPlugin();
      const goodPlugin = new MockPlugin();
      goodPlugin.name = 'good-plugin';
      
      registry.register(errorPlugin);
      registry.register(goodPlugin);
      
      const result = await registry.removeWithAllSupporting('pattern-1');
      
      expect(result.successes).toEqual(['good-plugin']);
      expect(result.failures).toHaveLength(1);
    });
  });

  describe('getDebugState', () => {
    it('should return complete debug state', () => {
      const metadata: PluginMetadata = {
        version: '1.0.0',
        author: 'Test',
      };
      
      const options: PluginOptions = {
        enabled: true,
      };
      
      registry.register(mockPlugin, metadata, options);
      
      const state = registry.getDebugState();
      
      expect(state).toEqual({
        pluginCount: 1,
        hasContext: true,
        instanceId: 123,
        plugins: [{
          name: 'test-plugin',
          metadata,
          options,
          hasInitialize: true,
          hasDispose: true,
        }],
      });
    });

    it('should handle plugins without optional methods', () => {
      const minimalPlugin: IRendererPlugin = {
        name: 'minimal',
        supports: () => true,
        render: async () => {},
        remove: async () => {},
        dispose: async () => {},
      };
      
      registry.register(minimalPlugin);
      
      const state = registry.getDebugState();
      
      expect(state.plugins[0]).toEqual({
        name: 'minimal',
        hasInitialize: false,
        hasDispose: false,
      });
    });

    it('should exclude instanceId when undefined', () => {
      const reg = new PluginRegistry();
      const state = reg.getDebugState();
      
      expect(state).toEqual({
        pluginCount: 0,
        hasContext: false,
        plugins: [],
      });
      expect(state).not.toHaveProperty('instanceId');
    });
  });
});