# WebSocket Manager Monitoring Setup

This directory contains monitoring configuration for the WSManager implementation.

## Files Overview

- `grafana-dashboard.json` - Complete Grafana dashboard for WSManager metrics
- `prometheus-config.yml` - Prometheus scraping configuration 
- `ws-manager-rules.yml` - Alerting rules and derived metrics
- `README.md` - This file

## Quick Setup

### 1. Prometheus Configuration

Add the WSManager scraping job to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'cryptrade-ws-metrics'
    static_configs:
      - targets: ['your-app-host:3000']
    metrics_path: '/api/ws/metrics'
    params:
      format: ['prometheus']
    scrape_interval: 30s
```

### 2. Import Grafana Dashboard

1. Open Grafana UI
2. Go to "+" → Import
3. Upload `grafana-dashboard.json`
4. Configure data source (Prometheus)

### 3. Setup Alerting Rules

Add `ws-manager-rules.yml` to your Prometheus rules directory:

```bash
# Copy rules file
cp ws-manager-rules.yml /etc/prometheus/rules/

# Reload Prometheus config
curl -X POST http://localhost:9090/-/reload
```

## Key Metrics

### Core Metrics (T-6 Requirements)

| Metric | Description | Type | Alert Threshold |
|--------|-------------|------|-----------------|
| `ws_manager_active_connections` | Current active WebSocket connections | Gauge | > 100 |
| `ws_manager_retry_count_total` | Total number of retry attempts | Counter | > 0.5/sec |

### Extended Metrics

| Metric | Description | Type |
|--------|-------------|------|
| `ws_manager_stream_creations_total` | Total streams created | Counter |
| `ws_manager_stream_cleanups_total` | Total streams cleaned up | Counter |
| `ws_manager_active_connections_hwm` | High water mark of connections | Gauge |

### Health Check

- **Endpoint**: `HEAD /api/ws/metrics`
- **Status Codes**:
  - `200` - Service healthy
  - `503` - Service unavailable

## Alert Configuration

### Critical Alerts

1. **Service Down** (`WSManagerServiceDown`)
   - Trigger: Metrics endpoint unreachable for 1 minute
   - Action: Page on-call SRE

2. **Connection Leak** (`WSManagerConnectionLeak`) 
   - Trigger: > 100 active connections for 5 minutes
   - Action: Investigate memory usage

### Warning Alerts

3. **High Retry Rate** (`WSManagerHighRetryRate`)
   - Trigger: > 0.5 retries/second for 2 minutes
   - Action: Check network stability

4. **Cleanup Lag** (`WSManagerCleanupLag`)
   - Trigger: 20+ uncleaned streams for 15 minutes
   - Action: Review cleanup logic

## Canary Monitoring

For Phase-1 canary deployment, special rules monitor:

- **Error Rate Comparison**: Staging vs Production
- **Performance Degradation**: > 1.5x retry rate increase
- **Automatic Rollback Trigger**: High error rate for 3+ minutes

## Phase-1 Staging Setup

```bash
# Set environment variable for staging
export USE_NEW_WS_MANAGER=true

# Deploy with 10% traffic weight
kubectl apply -f k8s/staging-canary.yaml

# Monitor metrics
curl -s http://staging.cryptrade.com/api/ws/metrics
```

## Dashboard Panels

1. **Active Connections** - Real-time connection count
2. **Retry Rate** - Exponential backoff effectiveness  
3. **Stream Lifecycle** - Creation vs cleanup rates
4. **High Water Mark** - Peak connection usage
5. **Health Status** - Service availability
6. **Error Analysis** - Retry frequency and patterns

## Troubleshooting

### High Retry Rate

```bash
# Check recent retry patterns
curl -s http://app:3000/api/ws/metrics | grep retry_count

# Review logs for connection errors
grep "WSManager.*retry" /var/log/app.log | tail -20
```

### Connection Leak

```bash
# Get current stream info
curl -s http://app:3000/api/ws/metrics | jq '.metrics.activeConnections'

# Force cleanup idle streams (if available)
# This would be through admin API or direct DB access
```

### Service Health Check

```bash
# Quick health check
curl -I http://app:3000/api/ws/metrics

# Get full metrics in JSON
curl http://app:3000/api/ws/metrics?format=json
```

## Production Considerations

1. **Retention**: Keep metrics for 30 days minimum
2. **Backup**: Export dashboard JSON regularly  
3. **Access Control**: Limit metrics endpoint access
4. **Rate Limiting**: Consider rate limiting on metrics endpoint
5. **Security**: Use HTTPS in production

## Contact

- **Development**: #ws-migration Slack channel
- **SRE Support**: #alerts Slack channel  
- **Escalation**: Page DevOps on-call via PagerDuty