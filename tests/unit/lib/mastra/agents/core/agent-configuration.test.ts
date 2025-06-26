// Phase 2 TDD: 🟢 Green フェーズ - AgentConfiguration分離用テスト  
// エージェント設定管理ロジックの分離テスト

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AgentConfiguration } from '../../../../../../lib/mastra/agents/core/agent-configuration';

interface AgentContext {
  queryComplexity?: 'simple' | 'complex';
  userTier?: 'free' | 'premium';
  isProposalMode?: boolean;
  userLevel?: 'beginner' | 'intermediate' | 'expert';
  marketStatus?: 'open' | 'closed';
  language?: string;
}

interface ModelSelection {
  provider: string;
  model: string;
  reasoning: string;
}

interface ToolConfiguration {
  enabledTools: string[];
  maxConcurrency: number;
  timeoutMs: number;
  retryCount: number;
}

describe('AgentConfiguration - Phase 2 TDD', () => {
  let agentConfiguration: AgentConfiguration;

  beforeEach(() => {
    agentConfiguration = new AgentConfiguration();
  });

  describe('動的モデル選択', () => {
    it('should select GPT-4o for proposal mode', () => {
      const context: AgentContext = {
        isProposalMode: true,
        userTier: 'free',
        queryComplexity: 'simple'
      };

      const result = agentConfiguration.selectModel(context);

      expect(result.model).toBe('gpt-4o');
      expect(result.reasoning).toContain('プロポーザルモード');
    });

    it('should select GPT-4o for complex queries', () => {
      const context: AgentContext = {
        queryComplexity: 'complex',
        userTier: 'free',
        isProposalMode: false
      };

      const result = agentConfiguration.selectModel(context);

      expect(result.model).toBe('gpt-4o');
      expect(result.reasoning).toContain('複雑なクエリ');
    });

    it('should select GPT-4o-mini for premium users', () => {
      const context: AgentContext = {
        userTier: 'premium',
        queryComplexity: 'simple',
        isProposalMode: false
      };

      const result = agentConfiguration.selectModel(context);

      expect(result.model).toBe('gpt-4o-mini');
      expect(result.reasoning).toContain('プレミアムユーザー');
    });

    it('should select GPT-3.5-turbo for free users with simple queries', () => {
      const context: AgentContext = {
        userTier: 'free',
        queryComplexity: 'simple',
        isProposalMode: false
      };

      const result = agentConfiguration.selectModel(context);

      expect(result.model).toBe('gpt-3.5-turbo');
      expect(result.reasoning).toContain('シンプルなクエリ');
    });

    it('should handle missing context gracefully', () => {
      const result = agentConfiguration.selectModel({});

      expect(result.model).toBeDefined();
      expect(result.provider).toBe('openai');
    });
  });

  describe('動的インストラクション生成', () => {
    it('should generate instructions for beginner users', () => {
      const context: AgentContext = {
        userLevel: 'beginner',
        language: 'ja'
      };

      const instructions = agentConfiguration.generateInstructions(context);

      expect(instructions).toContain('初心者向け');
      expect(instructions).toContain('分かりやすく');
    });

    it('should generate instructions for expert users', () => {
      const context: AgentContext = {
        userLevel: 'expert',
        language: 'ja'
      };

      const instructions = agentConfiguration.generateInstructions(context);

      expect(instructions).toContain('上級者向け');
      expect(instructions).toContain('詳細な');
    });

    it('should generate market closed instructions', () => {
      const context: AgentContext = {
        marketStatus: 'closed',
        language: 'ja'
      };

      const instructions = agentConfiguration.generateInstructions(context);

      expect(instructions).toContain('市場クローズ');
    });

    it('should include all base instruction components', () => {
      const context: AgentContext = {
        userLevel: 'intermediate',
        language: 'ja'
      };

      const instructions = agentConfiguration.generateInstructions(context);

      expect(instructions).toContain('あなたは');
      expect(instructions).toContain('仮想通貨');
      expect(instructions).toContain('分析');
    });
  });

  describe('インストラクションテンプレート構築', () => {
    it('should build complete instruction template', () => {
      const template = agentConfiguration.buildInstructionTemplate({
        userLevel: 'expert',
        marketStatus: 'open'
      });

      expect(template).toContain('システム指示');
      expect(template).toContain('ユーザーレベル');
      expect(template).toContain('市場状況');
    });

    it('should customize template for beginner in closed market', () => {
      const template = agentConfiguration.buildInstructionTemplate({
        userLevel: 'beginner',
        marketStatus: 'closed'
      });

      expect(template).toContain('初心者');
      expect(template).toContain('クローズ');
    });
  });

  describe('ツール設定管理', () => {
    it('should provide default tool configuration', () => {
      const config = agentConfiguration.getToolConfiguration({});

      expect(config.enabledTools).toContain('agentSelectionTool');
      expect(config.maxConcurrency).toBeGreaterThan(0);
    });

    it('should adapt tools for different user levels', () => {
      const beginnerConfig = agentConfiguration.getToolConfiguration({
        userLevel: 'beginner'
      });
      const expertConfig = agentConfiguration.getToolConfiguration({
        userLevel: 'expert'
      });

      expect(expertConfig.enabledTools.length).toBeGreaterThan(beginnerConfig.enabledTools.length);
    });

    it('should handle proposal mode tool configuration', () => {
      const config = agentConfiguration.getToolConfiguration({
        isProposalMode: true
      });

      expect(config.enabledTools).toContain('proposalGenerationTool');
    });
  });

  describe('設定の整合性', () => {
    it('should maintain consistency between model and instructions', () => {
      const context: AgentContext = {
        userTier: 'premium',
        queryComplexity: 'complex'
      };

      const model = agentConfiguration.selectModel(context);
      const instructions = agentConfiguration.generateInstructions(context);

      expect(model.model).toBe('gpt-4o');
      expect(instructions).toContain('詳細');
    });

    it('should optimize for cost when appropriate', () => {
      const context: AgentContext = {
        userTier: 'free',
        queryComplexity: 'simple'
      };

      const model = agentConfiguration.selectModel(context);

      expect(model.model).toBe('gpt-3.5-turbo');
      expect(model.reasoning).toContain('コスト効率');
    });
  });
});