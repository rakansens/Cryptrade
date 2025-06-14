# 🚀 Cryptrade × Mastra Drawing Reliability Roadmap

## Overview
2週間スプリント × 3セット / 随時リリース可能

## Sprint Plan

| Sprint | 期間 | 主要ゴール | 完了条件 (DoD) |
|--------|------|------------|----------------|
| 0: Kick-off | 0.5w | • Backlog整理<br>• ブランチ戦略決定<br>• CI/CD準備 | - WBS登録完了<br>- 空E2Eがグリーン |
| 1: 描画I/O信頼性 | 1w | ① 描画完了のPromise化<br>② 操作キュー実装 | - E2E: trendline→undo→redraw安定<br>- 失敗時UIトースト表示 |
| 2: 耐障害性&メトリクス | 1w | ③ リトライ機構<br>④ 描画系メトリクス | - /metricsに4系列出力<br>- Chaosテストで劣化<1sec |
| 3: E2E自動化&未対応イベント | 1w | ⑤ Playwrightシナリオ<br>⑥ eventカバレッジ補完 | - GitHub ActionsでE2E通過<br>- Coverage 80%→95% |

## Sprint 1 Task Breakdown

| # | 担当 | 見積 | 内容 |
|---|------|------|------|
| 1 | FE | 4h | ChartLayerにdrawingAdded$ RxJS Subject追加 |
| 2 | FE | 3h | useChartStore: addDrawingAsync()/removeDrawingAsync() |
| 2.5 | FE | 2h | 既存描画の移行・後方互換性アダプター |
| 3 | FE | 3h | DeferredActionRunner→queue組込み |
| 4 | BE | 2h | chartControl.tool.ts即時実行モード対応 |
| 5 | QA | 1h | Playwright test: trendline-undo-redraw |
| 6 | DevOps | 1h | CIパイプにPlaywright step追加 |

## KPI/Monitoring

| KPI | 目標値 | 監視方法 |
|-----|--------|----------|
| Drawing success rate | ≥99% | drawing_success_total/(success+failed) |
| Orchestrator retry P95 | ≤1 | Prometheus histogram_quantile |
| LLM latency (UI ops) | P95≤800ms | Langfuse trace |
| E2E pass rate (main) | 100% | GitHub Actions |
| Release roll-back time | <5min | Argo-Rollouts |

## Technical Decisions

### Queue Implementation
- Option 1: `p-queue` (npm) - 実績あり、並行数制御が簡単
- Option 2: 自前実装 - 軽量だが機能限定
- **Decision**: TBD in Sprint 1

### Promise Implementation Pattern
```typescript
class ChartDrawingManager extends EventEmitter {
  addDrawing(drawing): Promise<DrawingPrimitive> {
    return new Promise((resolve, reject) => {
      this.once(`drawing:added:${drawing.id}`, resolve);
      this.once(`drawing:error:${drawing.id}`, reject);
      // existing logic
    });
  }
}
```

## Risk Management

| リスク | 影響度 | 対策 |
|--------|--------|------|
| Lightweight Charts API非同期制約 | 高 | ポーリングによる状態確認 |
| 複数ユーザーの同時描画 | 中 | 楽観的ロックとconflict解決UI |
| WebSocket切断時の描画喪失 | 中 | LocalStorageによる一時保存 |

## Quick Wins (Sprint 0.5)
```typescript
// Error tracking (1h implementation)
window.addEventListener('chart:error', (e) => {
  logger.error('[Chart Error]', { 
    detail: e.detail,
    timestamp: Date.now(),
    sessionId: getSessionId()
  });
});
```

## Next Actions
1. ✅ Create feature branch
2. 📝 Create GitHub Issues
3. 🚀 Implement Sprint 1 tasks

---
Last Updated: 2025-01-03