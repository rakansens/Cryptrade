import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 virtual users
    { duration: '1m', target: 10 },  // Stay at 10 virtual users
    { duration: '30s', target: 0 },  // Ramp down to 0 virtual users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.1'],    // Error rate must be below 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test main page load
  let response = http.get(`${BASE_URL}/`);
  check(response, {
    'main page status is 200': (r) => r.status === 200,
    'main page response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // Test API endpoints
  response = http.get(`${BASE_URL}/api/binance/ticker/24hr?symbol=BTCUSDT`);
  check(response, {
    'ticker API status is 200': (r) => r.status === 200,
    'ticker API response time < 300ms': (r) => r.timings.duration < 300,
  });

  sleep(1);

  // Test klines API
  response = http.get(`${BASE_URL}/api/binance/klines?symbol=BTCUSDT&interval=1m&limit=100`);
  check(response, {
    'klines API status is 200': (r) => r.status === 200,
    'klines API response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}