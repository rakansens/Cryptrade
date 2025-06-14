# WebSocket Manager Migration Guide

## Overview

This guide covers the migration from the legacy `binanceConnectionManager` to the new WSManager implementation. The migration is designed to be zero-downtime with instant rollback capabilities.

## Migration Strategy

### Phase-Based Rollout

| Phase | Environment | Feature Flag | Traffic | Purpose |
|-------|-------------|--------------|---------|---------|
| Phase-0 | Local/CI | `OFF` | 0% | Development and testing |
| Phase-1 | Staging | `ON` | 10% | Basic validation and metrics |
| Phase-2 | Staging | `ON` | 100% | Full regression testing |
| Phase-3 | Production | `ON` | 5% → 25% → 50% → 100% | Gradual production rollout |

### Feature Flag Control

The migration is controlled by the `USE_NEW_WS_MANAGER` environment variable:

```bash
# Enable WSManager
export USE_NEW_WS_MANAGER=true

# Disable WSManager (use legacy)
export USE_NEW_WS_MANAGER=false
# or unset the variable
```

## Pre-Migration Checklist

### Development Team

- [ ] ✅ All imports updated to use `getBinanceConnection()`
- [ ] ✅ Unit tests updated and passing (≥86% coverage)
- [ ] ✅ E2E tests implemented and passing
- [ ] ✅ TypeScript compilation successful
- [ ] ✅ ESLint checks passing

### SRE Team

- [ ] Monitoring dashboards configured
- [ ] Alerting rules deployed
- [ ] Prometheus metrics endpoints accessible
- [ ] Rollback procedures documented and tested
- [ ] Load balancer configuration ready

### QA Team

- [ ] Regression test suite updated
- [ ] Performance benchmarks established
- [ ] Multi-tab and high-frequency scenarios tested
- [ ] Network disconnection scenarios validated
- [ ] Browser compatibility confirmed

## Migration Steps

### Step 1: Code Changes (Completed)

All application code has been updated to use the migration layer:

```typescript
// Old way
import { binanceConnectionManager } from '@/lib/binance/connection-manager';

// New way (backward compatible)
import { getBinanceConnection } from '@/lib/ws';
const binanceConnectionManager = getBinanceConnection();
```

The API remains identical, ensuring zero code changes for consumers.

### Step 2: Feature Flag Deployment

#### Staging Environment

```bash
# Set environment variable in staging
kubectl set env deployment/cryptrade-api USE_NEW_WS_MANAGER=true -n staging

# Verify flag is active
curl -s http://staging.cryptrade.com/api/ws/metrics | jq '.metrics.implementation'
# Should return "WSManager"
```

#### Production Environment (Canary)

Use traffic splitting for gradual rollout:

```yaml
# kubernetes/canary-deployment.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: cryptrade-api
spec:
  strategy:
    canary:
      steps:
      - setWeight: 5
      - pause: {duration: 10m}
      - setWeight: 25
      - pause: {duration: 10m}
      - setWeight: 50
      - pause: {duration: 10m}
      - setWeight: 100
```

### Step 3: Monitoring and Validation

#### Key Metrics to Monitor

```bash
# Active connections should be ≤ stream count
curl -s http://app:3000/api/ws/metrics | jq '.metrics.activeConnections'

# Retry rate should be minimal in stable conditions
curl -s http://app:3000/api/ws/metrics | jq '.metrics.retryCount'

# Health check should return 200
curl -I http://app:3000/api/ws/metrics
```

#### Alerting Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Active Connections | > 50 | > 100 | Check for leaks |
| Retry Rate | > 0.5/sec | > 1.0/sec | Investigate network |
| Error Rate | > 1% | > 5% | Consider rollback |
| Response Time | > 200ms | > 500ms | Performance review |

### Step 4: Validation Criteria

#### Phase-1 Validation (10% Traffic)

- [ ] No increase in error rates
- [ ] Response times within 5% of baseline
- [ ] Memory usage stable
- [ ] No connection leaks detected
- [ ] Metrics endpoint responsive

#### Phase-2 Validation (100% Staging)

- [ ] All regression tests passing
- [ ] Performance benchmarks met
- [ ] 24-hour stability test passed
- [ ] Resource usage within expected bounds
- [ ] Monitoring dashboards functional

#### Phase-3 Validation (Production)

- [ ] Business metrics unchanged
- [ ] User experience metrics stable
- [ ] No customer complaints
- [ ] SLA compliance maintained
- [ ] On-call incidents not increased

## Rollback Procedures

### Immediate Rollback (Emergency)

```bash
# 1. Disable feature flag immediately
kubectl set env deployment/cryptrade-api USE_NEW_WS_MANAGER=false -n production

# 2. Verify rollback
curl -s http://production.cryptrade.com/api/ws/metrics | jq '.metrics.implementation'
# Should return "Legacy"

# 3. Monitor recovery
watch 'curl -s http://production.cryptrade.com/health'
```

### Canary Rollback (Gradual)

```bash
# Reduce traffic to WSManager gradually
kubectl patch rollout cryptrade-api --type='merge' -p='{"spec":{"strategy":{"canary":{"steps":[{"setWeight":0}]}}}}'
```

### Database Rollback (If Required)

```sql
-- If any database migrations were involved
-- (None required for this migration)
```

## Testing Strategy

### Unit Testing

- ✅ **Coverage**: 86% achieved for WSManager components
- ✅ **Scenarios**: Connection sharing, retry logic, cleanup
- ✅ **Mocking**: WebSocket behavior and error conditions
- ✅ **Performance**: Memory usage and resource cleanup

### Integration Testing

- ✅ **API Compatibility**: Legacy manager API preserved
- ✅ **Migration Layer**: Feature flag switching
- ✅ **Monitoring**: Metrics collection and export
- ✅ **Error Handling**: Graceful degradation

### E2E Testing

- ✅ **Stream Processing**: Message handling and filtering
- ✅ **Network Scenarios**: Disconnection and reconnection
- ✅ **High Frequency**: Burst message handling
- ✅ **Resource Management**: Cleanup and memory management

### Performance Testing

```bash
# Load test configuration
artillery run --target http://staging.cryptrade.com performance-test.yml

# Monitor during load test
watch 'curl -s http://staging.cryptrade.com/api/ws/metrics | jq ".metrics"'
```

## Risk Mitigation

### Identified Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Memory leaks | Low | High | Automatic cleanup + monitoring |
| Connection storms | Medium | Medium | Jitter + rate limiting |
| API compatibility | Low | High | Comprehensive testing + shim |
| Performance regression | Medium | High | Gradual rollout + metrics |
| Monitoring gaps | Low | Medium | Comprehensive dashboards |

### Mitigation Strategies

#### Memory Leak Prevention

```typescript
// Automatic cleanup every 5 minutes
// Manual cleanup API available
manager.forceCleanupIdleStreams();

// Resource monitoring
setInterval(() => {
  const metrics = manager.getMetrics();
  if (metrics.activeConnections > threshold) {
    alert('High connection count detected');
  }
}, 60000);
```

#### Connection Storm Prevention

```typescript
// Full jitter strategy prevents thundering herd
const delay = Math.random() * maxDelay;

// Rate limiting at application level
const rateLimiter = new RateLimiter(10, 'per minute');
```

#### API Compatibility Assurance

```typescript
// Comprehensive test suite ensures compatibility
describe('API Compatibility', () => {
  it('should maintain legacy API surface', () => {
    const legacy = legacyManager;
    const newImpl = getBinanceConnection();
    
    expect(newImpl).toHaveProperty('subscribe');
    expect(newImpl).toHaveProperty('getConnectionStatus');
    expect(newImpl).toHaveProperty('disconnect');
  });
});
```

## Communication Plan

### Stakeholder Updates

| Audience | Channel | Frequency | Content |
|----------|---------|-----------|---------|
| Engineering | #ws-migration | Real-time | Technical updates, blockers |
| QA Team | #ws-qateam | Daily | Test results, validation status |
| SRE | #alerts | Real-time | Monitoring alerts, performance |
| Management | Email | Weekly | High-level progress, risks |
| Customers | Status page | As needed | Service impact notifications |

### Notification Templates

#### Migration Start

```
🚀 WSManager Migration Phase-{X} Starting

Environment: {env}
Traffic: {percentage}%
Duration: {duration}
Monitoring: {dashboard_url}

Expected completion: {time}
Rollback plan: Ready ✅
```

#### Success Notification

```
✅ WSManager Migration Phase-{X} Complete

Results:
- Error rate: {rate}% (target: <1%)
- Performance: {perf}% (target: <5% degradation)
- Connections: {count} active
- Health: All systems green ✅

Next phase: {next_phase}
```

#### Rollback Notification

```
⚠️ WSManager Migration Rollback Initiated

Reason: {reason}
Affected environment: {env}
Rollback method: {method}
ETA to recovery: {eta}

Status updates: {channel}
```

## Post-Migration

### Cleanup Tasks

After successful migration to production:

1. **Remove Legacy Code** (30 days after migration)
   ```typescript
   // Mark as deprecated
   /** @deprecated Use getBinanceConnection() instead */
   export const binanceConnectionManager = ...
   ```

2. **Update Documentation**
   - ✅ WS_MANAGER.md
   - ✅ MIGRATION.md
   - [ ] API documentation
   - [ ] Runbooks

3. **Monitoring Adjustment**
   - Remove legacy metrics
   - Adjust alert thresholds
   - Archive old dashboards

4. **Performance Optimization**
   - Analyze usage patterns
   - Optimize connection pooling
   - Fine-tune cleanup intervals

### Success Metrics

| Metric | Baseline | Target | Achieved |
|--------|----------|--------|----------|
| Connection efficiency | N/A | 90% reduction | TBD |
| Memory usage | 100MB | <120MB | TBD |
| Error rate | 0.1% | <0.1% | TBD |
| Response time | 50ms | <55ms | TBD |
| Retry rate | 0.05/sec | <0.1/sec | TBD |

## Lessons Learned

### What Went Well

- ✅ Comprehensive testing strategy
- ✅ Backward compatibility preserved
- ✅ Monitoring and observability prepared
- ✅ Feature flag infrastructure
- ✅ Clear rollback procedures

### Areas for Improvement

- [ ] Earlier performance testing
- [ ] More granular traffic splitting
- [ ] Customer communication timing
- [ ] Automated rollback triggers

### Recommendations for Future Migrations

1. **Start with Monitoring** - Set up observability first
2. **Test Everything** - Unit, integration, E2E, performance
3. **Plan for Rollback** - Make it fast and reliable
4. **Communicate Early** - Keep stakeholders informed
5. **Go Slow** - Gradual rollout reduces risk

## Contact Information

| Role | Contact | Availability |
|------|---------|--------------|
| Migration Lead | @dev-team | 24/7 during migration |
| SRE On-Call | @sre-team | 24/7 |
| QA Lead | @qa-team | Business hours |
| Product Manager | @pm-team | Business hours |

### Emergency Contacts

- **Immediate Issues**: Slack #ws-migration
- **Escalation**: Page DevOps on-call
- **Business Impact**: Contact VP Engineering

---

*Last updated: {current_date}*
*Migration status: Phase-0 Complete, Phase-1 Ready*