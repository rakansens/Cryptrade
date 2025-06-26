/**
 * AgentConfiguration - Phase 2 TDD Green phase implementation
 * 責務: 動的モデル選択、インストラクション生成、ツール設定管理
 * 
 * 変更履歴:
 * - Phase 2 TDD Green: 設定管理の基本実装
 */

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

export class AgentConfiguration {
  
  selectModel(context: AgentContext): ModelSelection {
    // プロポーザルモードでは高性能モデル
    if (context.isProposalMode) {
      return {
        provider: "openai",
        model: "gpt-4o",
        reasoning: "プロポーザルモードでは高精度が必要"
      };
    }

    // 複雑なクエリには高性能モデル
    if (context.queryComplexity === 'complex') {
      return {
        provider: "openai",
        model: "gpt-4o",
        reasoning: "複雑なクエリには高性能モデルが必要"
      };
    }

    // プレミアムユーザーには中性能モデル
    if (context.userTier === 'premium') {
      return {
        provider: "openai",
        model: "gpt-4o-mini",
        reasoning: "プレミアムユーザーには強化モデルを提供"
      };
    }

    // 無料ユーザーの単純クエリには基本モデル
    if (context.userTier === 'free' && context.queryComplexity === 'simple') {
      return {
        provider: "openai",
        model: "gpt-3.5-turbo",
        reasoning: "シンプルなクエリにはコスト効率モデル"
      };
    }

    // デフォルトは中性能モデル
    return {
      provider: "openai",
      model: "gpt-4o-mini",
      reasoning: "デフォルトでバランス型モデルを選択"
    };
  }

  generateInstructions(context: AgentContext): string {
    const baseInstructions = [
      "あなたは仮想通貨取引の分析アシスタントです。",
      "常に正確で有用な情報を提供してください。",
      "簡潔でありながら包括的な回答を心がけてください。"
    ];

    // クエリ複雑性別の調整
    if (context.queryComplexity === 'complex') {
      baseInstructions.push(
        "詳細な分析と包括的な説明を提供してください。"
      );
    }

    // ユーザーレベル別の調整
    if (context.userLevel === 'beginner') {
      baseInstructions.push(
        "初心者向けの分かりやすく説明してください。",
        "技術用語は簡単な言葉で説明してください。",
        "トレーディング概念の教育的コンテキストを提供してください。",
        "リスク管理と安全な取引に焦点を当ててください。"
      );
    } else if (context.userLevel === 'expert') {
      baseInstructions.push(
        "上級者向けの詳細な分析を提供してください。",
        "詳細な技術分析を提供してください。",
        "高度な指標やメトリクスを含めてください。",
        "取引用語に精通していることを前提としてください。"
      );
    }

    // マーケット状態別の調整
    if (context.marketStatus === 'closed') {
      baseInstructions.push(
        "現在市場クローズ中であることに言及してください。",
        "利用可能な履歴データの分析に焦点を当ててください。",
        "関連する場合は市場の再開時期に触れてください。"
      );
    }

    return baseInstructions.join('\n');
  }

  buildInstructionTemplate(context: AgentContext): string {
    const header = "## システム指示\n";
    const instructions = this.generateInstructions(context);
    
    // コンテキスト情報セクション
    const contextInfo = `\n\n## コンテキスト情報\n- ユーザーレベル: ${context.userLevel || '未設定'}\n- 市場状況: ${context.marketStatus || '不明'}`;
    
    const footer = "\n\n*常にユーザーの安全と責任ある取引慣行を優先してください。*";
    
    return header + instructions + contextInfo + footer;
  }

  getToolConfiguration(context: AgentContext): ToolConfiguration {
    const baseConfig: ToolConfiguration = {
      enabledTools: [
        "price_lookup",
        "technical_analysis",
        "market_data",
        "risk_calculator"
      ],
      maxConcurrency: 3,
      timeoutMs: 30000,
      retryCount: 2
    };

    // 基本設定にagentSelectionToolを追加
    baseConfig.enabledTools.push("agentSelectionTool");

    // ユーザーレベル別の調整
    if (context.userLevel === 'expert') {
      baseConfig.enabledTools.push(
        "advanced_charting",
        "options_analysis",
        "portfolio_optimization"
      );
      baseConfig.maxConcurrency = 5;
    } else if (context.userLevel === 'beginner') {
      baseConfig.enabledTools = baseConfig.enabledTools.filter(
        tool => !tool.includes('advanced')
      );
      baseConfig.maxConcurrency = 2;
    }

    // プロポーザルモード用のツール
    if (context.isProposalMode) {
      baseConfig.enabledTools.push(
        "proposalGenerationTool",
        "strategy_validator",
        "risk_assessor"
      );
      baseConfig.timeoutMs = 60000; // より長いタイムアウト
    }

    return baseConfig;
  }
}