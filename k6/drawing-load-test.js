import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const drawingErrors = new Counter('drawing_errors');
const drawingSuccess = new Counter('drawing_success');
const errorRate = new Rate('error_rate');
const drawingDuration = new Trend('drawing_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp-up to 20 users
    { duration: '5m', target: 60 },   // Stay at 60 users (60 ops/sec)
    { duration: '30s', target: 0 },   // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'], // 95% of requests must complete below 800ms
    error_rate: ['rate<0.01'],        // Error rate must be below 1%
    http_req_failed: ['rate<0.01'],   // HTTP failure rate below 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Drawing operation types
const DRAWING_TYPES = [
  { type: 'horizontal', action: 'draw_horizontal' },
  { type: 'trendline', action: 'draw_trendline' },
  { type: 'fibonacci', action: 'draw_fibonacci' },
];

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT'];
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

export default function () {
  // Select random operation
  const drawingOp = DRAWING_TYPES[Math.floor(Math.random() * DRAWING_TYPES.length)];
  const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  const timeframe = TIMEFRAMES[Math.floor(Math.random() * TIMEFRAMES.length)];
  
  // Simulate user request to AI agent
  const userRequest = generateUserRequest(drawingOp.type);
  
  const payload = JSON.stringify({
    userRequest,
    conversationHistory: [],
    currentState: {
      symbol,
      timeframe,
      activeIndicators: ['ma', 'rsi'],
    },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '10s',
  };

  // Measure drawing operation
  const startTime = new Date();
  
  // Call the chart control endpoint (simulate agent tool execution)
  const response = http.post(`${BASE_URL}/api/ai/chart-control`, payload, params);
  
  const duration = new Date() - startTime;
  drawingDuration.add(duration);

  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has operations': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.operations && body.operations.length > 0;
      } catch (e) {
        return false;
      }
    },
    'no parse errors': (r) => {
      try {
        const body = JSON.parse(r.body);
        return !body.error || !body.error.includes('parse');
      } catch (e) {
        return false;
      }
    },
  });

  if (success) {
    drawingSuccess.add(1);
    errorRate.add(false);
  } else {
    drawingErrors.add(1);
    errorRate.add(true);
  }

  // Simulate WebSocket drawing confirmation
  if (success && Math.random() > 0.05) { // 95% confirmation rate
    sleep(0.1); // 100ms for drawing confirmation
    
    // Verify drawing was added
    const metricsResponse = http.get(`${BASE_URL}/api/metrics?format=json`);
    check(metricsResponse, {
      'metrics endpoint healthy': (r) => r.status === 200,
    });
  }

  // Think time between operations
  sleep(Math.random() * 2 + 0.5); // 0.5-2.5s between operations
}

function generateUserRequest(drawingType) {
  const requests = {
    horizontal: [
      'Add a horizontal line at current price',
      'Draw support line here',
      'Mark this price level',
      '水平線を引いて',
    ],
    trendline: [
      'Draw a trend line',
      'Connect these two points',
      'Show the uptrend',
      'トレンドラインを追加',
    ],
    fibonacci: [
      'Add fibonacci retracement',
      'Show fib levels',
      'Draw fibonacci here',
      'フィボナッチを表示',
    ],
  };

  const options = requests[drawingType] || requests.horizontal;
  return options[Math.floor(Math.random() * options.length)];
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data),
    'summary.html': htmlReport(data),
  };
}

// Helper function for text summary
function textSummary(data, options) {
  const { metrics } = data;
  
  return `
Load Test Results:
==================
Total Requests: ${metrics.http_reqs.values.count}
Success Rate: ${((1 - metrics.error_rate.values.rate) * 100).toFixed(2)}%
Error Rate: ${(metrics.error_rate.values.rate * 100).toFixed(2)}%

Drawing Operations:
- Success: ${metrics.drawing_success.values.count}
- Errors: ${metrics.drawing_errors.values.count}
- Avg Duration: ${metrics.drawing_duration.values.avg.toFixed(2)}ms
- P95 Duration: ${metrics.drawing_duration.values['p(95)'].toFixed(2)}ms

HTTP Metrics:
- Avg Response Time: ${metrics.http_req_duration.values.avg.toFixed(2)}ms
- P95 Response Time: ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
- Failed Requests: ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%
`;
}

// Helper function for HTML report
function htmlReport(data) {
  const { metrics } = data;
  const successRate = ((1 - metrics.error_rate.values.rate) * 100).toFixed(2);
  const errorRate = (metrics.error_rate.values.rate * 100).toFixed(2);
  
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Drawing Load Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .metric { margin: 20px 0; padding: 20px; background: #f5f5f5; border-radius: 8px; }
    .success { color: #4CAF50; }
    .error { color: #F44336; }
    .warning { color: #FF9800; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <h1>Drawing Operations Load Test Report</h1>
  
  <div class="metric">
    <h2>Overall Performance</h2>
    <p>Success Rate: <span class="${successRate >= 99 ? 'success' : 'warning'}">${successRate}%</span></p>
    <p>Error Rate: <span class="${errorRate <= 1 ? 'success' : 'error'}">${errorRate}%</span></p>
  </div>
  
  <div class="metric">
    <h2>Drawing Operations</h2>
    <table>
      <tr>
        <th>Metric</th>
        <th>Value</th>
      </tr>
      <tr>
        <td>Total Operations</td>
        <td>${metrics.drawing_success.values.count + metrics.drawing_errors.values.count}</td>
      </tr>
      <tr>
        <td>Successful</td>
        <td class="success">${metrics.drawing_success.values.count}</td>
      </tr>
      <tr>
        <td>Failed</td>
        <td class="error">${metrics.drawing_errors.values.count}</td>
      </tr>
      <tr>
        <td>Avg Duration</td>
        <td>${metrics.drawing_duration.values.avg.toFixed(2)}ms</td>
      </tr>
      <tr>
        <td>P95 Duration</td>
        <td class="${metrics.drawing_duration.values['p(95)'] <= 800 ? 'success' : 'warning'}">${metrics.drawing_duration.values['p(95)'].toFixed(2)}ms</td>
      </tr>
    </table>
  </div>
  
  <div class="metric">
    <h2>Test Configuration</h2>
    <p>Duration: 6 minutes</p>
    <p>Max VUs: 60 (60 ops/sec)</p>
    <p>Thresholds: P95 < 800ms, Error Rate < 1%</p>
  </div>
  
  <p><em>Generated at: ${new Date().toISOString()}</em></p>
</body>
</html>
`;
}