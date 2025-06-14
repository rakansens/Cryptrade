# Agent Architecture Scope Matrix

## 既存機能 ↔ エージェント担当分析

| 既存機能 | 現在の実装 | Phase1対応 | エージェント化優先度 | 理由 |
|---------|-----------|-----------|-------------------|------|
| **会話処理** | `executeConversationalBranch()` | **Orchestrator** | 🔴 HIGH | ROI高、リスク低 |
| **意図分類** | `classifyUserIntent()` | **Orchestrator** | 🔴 HIGH | 中央司令官の核機能 |
| **市場データ取得** | `marketDataTool` | **残置** | 🟡 MEDIUM | 既に最適化済み |
| **テクニカル分析** | `generateTechnicalAnalysis()` | **Market Agent** | 🟡 MEDIUM | 機能拡張メリット |
| **リスク評価** | `generateRiskAssessment()` | **Risk Agent** | 🟢 LOW | 現状で十分 |
| **推奨生成** | `generateRecommendations()` | **Trading Agent** | 🟢 LOW | 現状で十分 |

## Phase1 境界線

### ✅ エージェント化対象
- **Orchestrator Agent**: 既存のIntent Classifierを置き換え
- **Market Data Agent**: 既存marketDataToolをラップ

### 🔄 残置（Phase2以降）
- Technical Analysis関数群
- Risk Assessment関数群  
- UI操作機能（未実装）
- バックテスト機能（未実装）

## ROI評価

| エージェント | 開発工数 | 期待効果 | ROI |
|-------------|----------|----------|-----|
| Orchestrator | 2-3日 | 自然言語理解向上 | ⭐⭐⭐ |
| Market Data | 1-2日 | レスポンス時間短縮 | ⭐⭐ |
| Chart Analysis | 5-7日 | 新機能追加 | ⭐ |