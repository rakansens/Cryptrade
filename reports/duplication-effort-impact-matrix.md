# Code Duplication - Effort vs Impact Matrix

## Visual Matrix

```
High Impact │ 
    1000+   │ [API Route]
            │ [Middleware]
            │     ◆
     800    │              
            │ [Semantic]
     600    │ [Embedding]    
            │     ◆         [Session]
     400    │               [Validation]
            │                   ◆      [DB Conversions]
            │                              ◆
     200    │           [WebSocket]    [Async Hooks]
            │               ◆              ◆
            │                          [Chart Trans]
     100    │ [Draw Handler]              ◆
            │     ◆      [Store Reset]
            │                ◆         [Validation]
      50    │                              ◆
            │ [Log Proc]              [Date Format]
            │     ◆      [Loading]        ◆
      20    │             [UI]
            │               ◆         [Debug Log]
            │                             ◆
Low Impact  └─────┬─────┬─────┬─────┬─────┬─────
              0.5   1     2     3     4     5
              Low Effort    →        High Effort
                          (days)
```

## Quadrant Analysis

### 🎯 Quick Wins (Low Effort, High Impact)
**Target: Immediate implementation**

| Item | Score | Effort | ROI |
|------|-------|--------|-----|
| Semantic Embedding Merge | 629.85 | 3 hours | 210/hour |
| Drawing Handler Cleanup | 100.00 | 1 hour | 100/hour |
| Store Reset Base Class | 97.50 | 2 hours | 49/hour |
| Log Processing Extract | 30.00 | 0.5 hours | 60/hour |

**Total Quick Wins: 857.35 points in 6.5 hours**

### 🚀 Strategic Initiatives (High Effort, High Impact)
**Target: Planned sprints**

| Item | Score | Effort | ROI |
|------|-------|--------|-----|
| API Route Middleware | 982.75 | 3 days | 327/day |
| Session Validation | 432.00 | 1 day | 432/day |
| DB Conversions | 367.50 | 1.5 days | 245/day |
| WebSocket Abstraction | 318.75 | 2 days | 159/day |
| Async Hook Pattern | 288.00 | 2 days | 144/day |

**Total Strategic: 2,389.00 points in 9.5 days**

### 🔧 Fill-ins (Low Effort, Low Impact)
**Target: During downtime**

| Item | Score | Effort | ROI |
|------|-------|--------|-----|
| Date Formatting | 67.50 | 2 hours | 34/hour |
| Cache Key Utils | 51.00 | 2 hours | 26/hour |
| Loading States | 54.00 | 4 hours | 14/hour |
| Error States | 53.55 | 3 hours | 18/hour |
| Debug Logging | 23.75 | 1 hour | 24/hour |

**Total Fill-ins: 249.80 points in 12 hours**

### ⏸️ Consider Later (High Effort, Low Impact)
**Target: Future consideration**

| Item | Score | Effort | ROI |
|------|-------|--------|-----|
| Form Validation Library | 110.25 | 1 day | 110/day |
| UI Component System | 107.55 | 1 day | 108/day |
| Generic Array Utils | 72.00 | 0.5 days | 144/day |
| Permission System | 216.00 | 2 days | 108/day |

**Total Consider Later: 505.80 points in 4.5 days**

## Implementation Roadmap

### Week 1: Maximum Impact
**Goal: 2,400+ points**

1. **Monday AM**: Quick Wins Round 1
   - Semantic Embedding Merge (3h) → 629.85 pts
   - Drawing Handler Cleanup (1h) → 100.00 pts
   
2. **Monday PM - Tuesday**: API Route Middleware
   - Design and implement (1.5 days) → 500 pts
   
3. **Wednesday - Thursday**: Continue API Middleware
   - Complete implementation (1.5 days) → 482.75 pts
   
4. **Friday**: Session Validation
   - Implement middleware (1 day) → 432.00 pts

**Week 1 Total: 2,144.60 points**

### Week 2: Service Layer
**Goal: 1,200+ points**

1. **Monday - Tuesday**: Database Conversions
   - Unify utilities (1.5 days) → 367.50 pts
   
2. **Wednesday - Thursday**: WebSocket Abstraction
   - Create base classes (2 days) → 318.75 pts
   
3. **Friday**: Quick Wins Round 2
   - Store Reset (2h) → 97.50 pts
   - Response Serialization (4h) → 187.50 pts

**Week 2 Total: 971.25 points**

### Week 3: Polish & Patterns
**Goal: 800+ points**

1. **Monday - Tuesday**: Async Hook Infrastructure
   - Implement pattern (2 days) → 288.00 pts
   
2. **Wednesday**: Chart Transformations
   - Generic utilities (1 day) → 224.00 pts
   
3. **Thursday - Friday**: Fill-ins
   - All small utilities (2 days) → 249.80 pts

**Week 3 Total: 761.80 points**

## Success Metrics Dashboard

```
┌─────────────────────────────────────┐
│        DUPLICATION REDUCTION        │
├─────────────────────────────────────┤
│ Starting Score:     4,655 points    │
│ Target Score:       < 1,000 points  │
│ Reduction Goal:     78%             │
├─────────────────────────────────────┤
│ Week 1 Progress:    ████████░░ 46%  │
│ Week 2 Progress:    ██████░░░░ 67%  │
│ Week 3 Progress:    █████████░ 84%  │
├─────────────────────────────────────┤
│ Lines Saved:        ~2,800          │
│ Files Affected:     147             │
│ Dev Hours Saved:    ~40/month       │
└─────────────────────────────────────┘
```

## Risk Mitigation

### High Risk Items
1. **API Route Middleware** - Affects all routes
   - Mitigation: Gradual rollout, feature flags
   
2. **Session Validation** - Security critical
   - Mitigation: Extensive testing, staging deployment

3. **WebSocket Abstraction** - Real-time features
   - Mitigation: Parallel implementation, A/B testing

### Low Risk Items
- Service merges (isolated impact)
- Utility extractions (additive changes)
- UI components (visual only)

## ROI Calculation

### Development Time Saved
- Current: ~2 hours/week on duplicate code maintenance
- After: ~0.5 hours/week
- **Savings: 6 hours/month**

### Bug Reduction
- Current: ~3 bugs/month from inconsistent duplicates
- After: ~1 bug/month
- **Savings: 8 hours/month debugging**

### New Feature Velocity
- Current: 20% time on boilerplate
- After: 5% time on boilerplate
- **Savings: 15% faster feature delivery**

### Total ROI
- Implementation: 15 days
- Monthly savings: 14 hours + 15% velocity
- **Payback period: 6 weeks**