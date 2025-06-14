/**
 * Tool Compatibility Layer
 * 
 * Ensures tools work correctly across different AI model providers
 * by adapting schemas and handling provider-specific quirks
 */

import { z } from 'zod';
import { logger } from '@/lib/utils/logger';
import { ToolError } from '@/lib/errors/base-error';

// Zodスキーマ型の拡張
type ZodTypeAny = z.ZodType<unknown, z.ZodTypeDef, unknown>;

// ツールの基本型定義
export interface Tool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  execute: (params: TInput) => Promise<TOutput>;
}

// パラメータ型
type ToolParams = Record<string, unknown> | unknown[];

// レスポンス型
type ToolResponse = 
  | string 
  | number 
  | boolean 
  | null
  | ToolResponse[]
  | { [key: string]: ToolResponse };

/**
 * Provider-specific compatibility configurations
 */
export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  openai: {
    name: 'OpenAI',
    supportsOptionalProperties: true,
    supportsEnums: true,
    supportsArrays: true,
    supportsNullable: true,
    maxDepth: 5,
    requiresExplicitTypes: false,
  },
  'openai-reasoning': {
    name: 'OpenAI Reasoning Models',
    supportsOptionalProperties: false, // o1モデルはoptionalを無視することがある
    supportsEnums: true,
    supportsArrays: true,
    supportsNullable: false,
    maxDepth: 3,
    requiresExplicitTypes: true,
  },
  anthropic: {
    name: 'Anthropic',
    supportsOptionalProperties: true,
    supportsEnums: true,
    supportsArrays: true,
    supportsNullable: true,
    maxDepth: 5,
    requiresExplicitTypes: false,
  },
  google: {
    name: 'Google',
    supportsOptionalProperties: true,
    supportsEnums: true,
    supportsArrays: true,
    supportsNullable: true,
    maxDepth: 4,
    requiresExplicitTypes: true,
  },
  mistral: {
    name: 'Mistral',
    supportsOptionalProperties: true,
    supportsEnums: false, // Enumsを文字列に変換する必要がある
    supportsArrays: true,
    supportsNullable: false,
    maxDepth: 3,
    requiresExplicitTypes: true,
  },
};

/**
 * Tool compatibility adapter
 */
export class ToolCompatibilityAdapter {
  private provider: string;
  private config: ProviderConfig;

  constructor(provider: string) {
    this.provider = provider;
    this.config = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.openai;
    
    logger.info(`[ToolCompatibility] Initialized for provider: ${this.provider}`, {
      config: this.config,
    });
  }

  /**
   * Adapt Zod schema for the specific provider
   */
  adaptSchema(schema: ZodTypeAny): ZodTypeAny {
    try {
      const adapted = this.transformSchema(schema);
      
      logger.debug(`[ToolCompatibility] Schema adapted for ${this.provider}`, {
        original: this.getSchemaStructure(schema),
        adapted: this.getSchemaStructure(adapted),
      });
      
      return adapted;
    } catch (error) {
      throw new ToolError(
        `Failed to adapt schema for ${this.provider}`,
        'schema-adaptation',
        {
          provider: this.provider,
          error: String(error),
        }
      );
    }
  }

  /**
   * Transform schema based on provider capabilities
   */
  private transformSchema(schema: ZodTypeAny, depth = 0): ZodTypeAny {
    // 深さ制限チェック
    if (depth > this.config.maxDepth) {
      return z.unknown();
    }

    // Optional処理
    if (schema instanceof z.ZodOptional && !this.config.supportsOptionalProperties) {
      // Optionalをサポートしない場合は、デフォルト値付きに変換
      const innerType = this.transformSchema(schema._def.innerType, depth + 1);
      return innerType.nullable();
    }

    // Nullable処理
    if (schema instanceof z.ZodNullable && !this.config.supportsNullable) {
      // Nullableをサポートしない場合は、optionalに変換
      return this.transformSchema(schema._def.innerType, depth + 1).optional();
    }

    // Enum処理
    if (schema instanceof z.ZodEnum && !this.config.supportsEnums) {
      // Enumをサポートしない場合は、文字列に変換
      const values = schema._def.values as string[];
      return z.string().describe(`One of: ${values.join(', ')}`);
    }

    // Array処理
    if (schema instanceof z.ZodArray) {
      if (!this.config.supportsArrays) {
        // 配列をサポートしない場合は、カンマ区切り文字列に
        return z.string().describe('Comma-separated values');
      }
      const elementType = this.transformSchema(schema._def.type, depth + 1);
      return z.array(elementType);
    }

    // Object処理
    if (schema instanceof z.ZodObject) {
      const shape = schema._def.shape();
      const newShape: Record<string, ZodTypeAny> = {};
      
      for (const [key, value] of Object.entries(shape)) {
        newShape[key] = this.transformSchema(value as ZodTypeAny, depth + 1);
      }
      
      return z.object(newShape);
    }

    // Union処理
    if (schema instanceof z.ZodUnion) {
      const options = schema._def.options as ZodTypeAny[];
      const transformedOptions = options.map(opt => 
        this.transformSchema(opt, depth + 1)
      );
      
      // 2つのオプションのみサポート
      if (transformedOptions.length === 2) {
        return z.union([transformedOptions[0], transformedOptions[1]]);
      }
      
      // それ以上は最初のオプションを使用
      return transformedOptions[0];
    }

    // デフォルト: そのまま返す
    return schema;
  }

  /**
   * Adapt tool execution parameters
   */
  adaptParameters(params: ToolParams): ToolParams {
    // プロバイダー固有のパラメータ調整
    switch (this.provider) {
      case 'openai-reasoning':
        // o1モデルの場合、明示的な型変換
        return this.enforceTypes(params);
      
      case 'mistral':
        // Mistralの場合、enumを文字列に
        return this.convertEnumsToStrings(params);
      
      default:
        return params;
    }
  }

  /**
   * Adapt tool response
   */
  adaptResponse(response: ToolResponse): ToolResponse {
    // プロバイダー固有のレスポンス調整
    switch (this.provider) {
      case 'google':
        // Googleの場合、特定のフォーマットが必要
        return this.formatForGoogle(response);
      
      default:
        return response;
    }
  }

  /**
   * Get schema structure for debugging
   */
  private getSchemaStructure(schema: ZodTypeAny): string {
    try {
      if (schema instanceof z.ZodObject) {
        const shape = schema._def.shape();
        const fields = Object.keys(shape).join(', ');
        return `Object { ${fields} }`;
      }
      return schema.constructor.name;
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Enforce explicit types
   */
  private enforceTypes(params: ToolParams): ToolParams {
    if (Array.isArray(params)) {
      return params.map(p => this.enforceTypes(p as ToolParams));
    }
    
    if (params && typeof params === 'object') {
      const result: ToolParams = {};
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) {
          continue;
        }
        result[key] = this.enforceTypes(value as ToolParams);
      }
      return result;
    }
    
    return params;
  }

  /**
   * Convert enums to strings
   */
  private convertEnumsToStrings(params: ToolParams): ToolParams {
    if (Array.isArray(params)) {
      return params.map(p => this.convertEnumsToStrings(p as ToolParams));
    }
    
    if (params && typeof params === 'object') {
      const result: ToolParams = {};
      for (const [key, value] of Object.entries(params)) {
        result[key] = this.convertEnumsToStrings(value as ToolParams);
      }
      return result;
    }
    
    // Enumっぽい値は文字列に
    if (typeof params === 'symbol') {
      return String(params) as ToolParams;
    }
    
    return params;
  }

  /**
   * Format response for Google
   */
  private formatForGoogle(response: ToolResponse): ToolResponse {
    // Googleは特定のレスポンス形式を期待
    if (typeof response === 'string') {
      return { text: response };
    }
    
    if (Array.isArray(response)) {
      return { items: response };
    }
    
    return response;
  }
}

/**
 * Provider configuration interface
 */
interface ProviderConfig {
  name: string;
  supportsOptionalProperties: boolean;
  supportsEnums: boolean;
  supportsArrays: boolean;
  supportsNullable: boolean;
  maxDepth: number;
  requiresExplicitTypes: boolean;
}

/**
 * Create a compatible tool
 */
export function createCompatibleTool<TInput, TOutput>(
  tool: Tool<TInput, TOutput>,
  provider: string
): Tool<TInput, TOutput> {
  const adapter = new ToolCompatibilityAdapter(provider);
  
  return {
    ...tool,
    inputSchema: adapter.adaptSchema(tool.inputSchema),
    execute: async (params: TInput) => {
      const adaptedParams = adapter.adaptParameters(params as ToolParams);
      const result = await tool.execute(adaptedParams as TInput);
      return adapter.adaptResponse(result as ToolResponse) as TOutput;
    },
  };
}