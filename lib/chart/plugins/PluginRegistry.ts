/**
 * Plugin Registry
 * 
 * レンダラープラグインの管理とライフサイクル制御
 */

import type { PatternVisualization } from '@/types/pattern';
import type { 
  IRendererPlugin, 
  IPluginRegistry, 
  PluginContext,
  PluginOptions,
  PluginMetadata 
} from './interfaces';
import { PluginError } from './interfaces';
import { logger } from '@/lib/utils/logger';

export class PluginRegistry implements IPluginRegistry {
  private plugins = new Map<string, IRendererPlugin>();
  private pluginMetadata = new Map<string, PluginMetadata>();
  private pluginOptions = new Map<string, PluginOptions>();
  private context?: PluginContext;
  
  constructor(context?: PluginContext) {
    this.context = context;
    logger.info('[PluginRegistry] Created registry', {
      hasContext: !!context,
      instanceId: context?.instanceId,
    });
  }
  
  /**
   * プラグインコンテキストを設定
   */
  setContext(context: PluginContext): void {
    this.context = context;
    
    // 既存のプラグインを再初期化
    for (const plugin of this.plugins.values()) {
      try {
        if (plugin.initialize) {
          plugin.initialize(context);
        }
      } catch (error) {
        logger.warn('[PluginRegistry] Failed to re-initialize plugin', {
          pluginName: plugin.name,
          error: String(error),
        });
      }
    }
    
    logger.info('[PluginRegistry] Context updated', {
      instanceId: context.instanceId,
      pluginCount: this.plugins.size,
    });
  }
  
  /**
   * プラグインの登録
   */
  register<T extends IRendererPlugin>(
    plugin: T, 
    metadata?: PluginMetadata,
    options?: PluginOptions
  ): void {
    if (this.plugins.has(plugin.name)) {
      logger.warn('[PluginRegistry] Plugin already registered, replacing', {
        pluginName: plugin.name,
      });
    }
    
    // プラグインを登録
    this.plugins.set(plugin.name, plugin);
    
    // メタデータを登録
    if (metadata) {
      this.pluginMetadata.set(plugin.name, metadata);
    }
    
    // オプションを登録
    if (options) {
      this.pluginOptions.set(plugin.name, options);
    }
    
    // プラグインを初期化
    if (this.context && plugin.initialize) {
      try {
        plugin.initialize(this.context);
      } catch (error) {
        logger.error('[PluginRegistry] Failed to initialize plugin', {
          pluginName: plugin.name,
          error: String(error),
        });
        throw new PluginError(plugin.name, 'register', `Failed to initialize: ${String(error)}`);
      }
    }
    
    logger.info('[PluginRegistry] Plugin registered', {
      pluginName: plugin.name,
      hasMetadata: !!metadata,
      hasOptions: !!options,
      initialized: !!(this.context && plugin.initialize),
      totalPlugins: this.plugins.size,
    });
  }
  
  /**
   * プラグインの取得
   */
  get<T extends IRendererPlugin>(name: string): T | undefined {
    const plugin = this.plugins.get(name) as T | undefined;
    logger.debug('[PluginRegistry] Plugin retrieved', {
      pluginName: name,
      found: !!plugin,
    });
    return plugin;
  }
  
  /**
   * 指定したデータをサポートするプラグインを取得
   */
  getSupporting(data: PatternVisualization): IRendererPlugin[] {
    const supportingPlugins: IRendererPlugin[] = [];
    
    for (const plugin of this.plugins.values()) {
      try {
        // プラグインが無効化されていないかチェック
        const options = this.pluginOptions.get(plugin.name);
        if (options?.enabled === false) {
          logger.debug('[PluginRegistry] Plugin disabled, skipping', {
            pluginName: plugin.name,
          });
          continue;
        }
        
        // サポート確認
        if (plugin.supports(data)) {
          supportingPlugins.push(plugin);
        }
      } catch (error) {
        logger.warn('[PluginRegistry] Error checking plugin support', {
          pluginName: plugin.name,
          error: String(error),
        });
      }
    }
    
    logger.debug('[PluginRegistry] Found supporting plugins', {
      supportingCount: supportingPlugins.length,
      supportingPlugins: supportingPlugins.map(p => p.name),
      totalPlugins: this.plugins.size,
    });
    
    return supportingPlugins;
  }
  
  /**
   * すべてのプラグインを取得
   */
  getAll(): IRendererPlugin[] {
    return Array.from(this.plugins.values());
  }
  
  /**
   * プラグインの登録解除
   */
  unregister(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      logger.warn('[PluginRegistry] Plugin not found for unregistration', {
        pluginName: name,
      });
      return false;
    }
    
    try {
      // プラグインのクリーンアップ
      if (plugin.dispose) {
        plugin.dispose();
      }
      
      // レジストリから削除
      this.plugins.delete(name);
      this.pluginMetadata.delete(name);
      this.pluginOptions.delete(name);
      
      logger.info('[PluginRegistry] Plugin unregistered', {
        pluginName: name,
        remainingPlugins: this.plugins.size,
      });
      
      return true;
    } catch (error) {
      logger.error('[PluginRegistry] Failed to unregister plugin', {
        pluginName: name,
        error: String(error),
      });
      return false;
    }
  }
  
  /**
   * すべてのプラグインのクリーンアップ
   */
  async dispose(): Promise<void> {
    logger.info('[PluginRegistry] Disposing all plugins', {
      pluginCount: this.plugins.size,
    });
    
    const disposalPromises: Promise<void>[] = [];
    const disposalErrors: string[] = [];
    
    for (const [name, plugin] of this.plugins.entries()) {
      try {
        if (plugin.dispose) {
          const disposeResult = plugin.dispose();
          if (disposeResult instanceof Promise) {
            disposalPromises.push(disposeResult);
          }
        }
      } catch (error) {
        const errorMsg = `Failed to dispose ${name}: ${String(error)}`;
        disposalErrors.push(errorMsg);
        logger.error('[PluginRegistry] Plugin disposal error', {
          pluginName: name,
          error: String(error),
        });
      }
    }
    
    // 非同期クリーンアップを待機
    if (disposalPromises.length > 0) {
      try {
        await Promise.allSettled(disposalPromises);
      } catch (error) {
        logger.warn('[PluginRegistry] Some async disposals failed', {
          error: String(error),
        });
      }
    }
    
    // 内部状態をクリア
    this.plugins.clear();
    this.pluginMetadata.clear();
    this.pluginOptions.clear();
    this.context = undefined;
    
    logger.info('[PluginRegistry] All plugins disposed', {
      disposalErrors: disposalErrors.length > 0 ? disposalErrors : undefined,
    });
    
    if (disposalErrors.length > 0) {
      throw new Error(`Plugin disposal errors: ${disposalErrors.join(', ')}`);
    }
  }
  
  /**
   * プラグインのメタデータを取得
   */
  getMetadata(name: string): PluginMetadata | undefined {
    return this.pluginMetadata.get(name);
  }
  
  /**
   * プラグインのオプションを取得
   */
  getOptions(name: string): PluginOptions | undefined {
    return this.pluginOptions.get(name);
  }
  
  /**
   * プラグインのオプションを更新
   */
  updateOptions(name: string, options: Partial<PluginOptions>): boolean {
    const currentOptions = this.pluginOptions.get(name) || {};
    const newOptions = { ...currentOptions, ...options };
    
    this.pluginOptions.set(name, newOptions);
    
    logger.info('[PluginRegistry] Plugin options updated', {
      pluginName: name,
      options: newOptions,
    });
    
    return true;
  }
  
  /**
   * プラグインの有効/無効を切り替え
   */
  setPluginEnabled(name: string, enabled: boolean): boolean {
    return this.updateOptions(name, { enabled });
  }
  
  /**
   * パターンを複数のプラグインで描画
   */
  async renderWithAllSupporting(
    id: string, 
    data: PatternVisualization, 
    extra?: unknown
  ): Promise<{ successes: string[]; failures: Array<{ plugin: string; error: string }> }> {
    const supportingPlugins = this.getSupporting(data);
    const successes: string[] = [];
    const failures: Array<{ plugin: string; error: string }> = [];
    
    logger.info('[PluginRegistry] Rendering with supporting plugins', {
      patternId: id,
      supportingPlugins: supportingPlugins.map(p => p.name),
    });
    
    for (const plugin of supportingPlugins) {
      try {
        await plugin.render(id, data, extra);
        successes.push(plugin.name);
        logger.debug('[PluginRegistry] Plugin render success', {
          patternId: id,
          pluginName: plugin.name,
        });
      } catch (error) {
        const errorMsg = String(error);
        failures.push({ plugin: plugin.name, error: errorMsg });
        logger.warn('[PluginRegistry] Plugin render failure', {
          patternId: id,
          pluginName: plugin.name,
          error: errorMsg,
        });
      }
    }
    
    logger.info('[PluginRegistry] Multi-plugin render complete', {
      patternId: id,
      successes: successes.length,
      failures: failures.length,
      successPlugins: successes,
      failurePlugins: failures.map(f => f.plugin),
    });
    
    return { successes, failures };
  }
  
  /**
   * パターンを複数のプラグインで削除
   */
  async removeWithAllSupporting(
    id: string
  ): Promise<{ successes: string[]; failures: Array<{ plugin: string; error: string }> }> {
    const successes: string[] = [];
    const failures: Array<{ plugin: string; error: string }> = [];
    
    // すべてのプラグインで削除を試行
    for (const plugin of this.plugins.values()) {
      try {
        await plugin.remove(id);
        successes.push(plugin.name);
        logger.debug('[PluginRegistry] Plugin remove success', {
          patternId: id,
          pluginName: plugin.name,
        });
      } catch (error) {
        const errorMsg = String(error);
        failures.push({ plugin: plugin.name, error: errorMsg });
        logger.debug('[PluginRegistry] Plugin remove failure (expected if not applicable)', {
          patternId: id,
          pluginName: plugin.name,
          error: errorMsg,
        });
      }
    }
    
    logger.info('[PluginRegistry] Multi-plugin remove complete', {
      patternId: id,
      successes: successes.length,
      failures: failures.length,
    });
    
    return { successes, failures };
  }
  
  /**
   * デバッグ用状態取得
   */
  getDebugState(): {
    pluginCount: number;
    hasContext: boolean;
    instanceId?: number;
    plugins: Array<{
      name: string;
      metadata?: PluginMetadata;
      options?: PluginOptions;
      hasInitialize: boolean;
      hasDispose: boolean;
    }>;
  } {
    return {
      pluginCount: this.plugins.size,
      hasContext: !!this.context,
      instanceId: this.context?.instanceId,
      plugins: Array.from(this.plugins.entries()).map(([name, plugin]) => ({
        name,
        metadata: this.pluginMetadata.get(name),
        options: this.pluginOptions.get(name),
        hasInitialize: typeof plugin.initialize === 'function',
        hasDispose: typeof plugin.dispose === 'function',
      })),
    };
  }
}