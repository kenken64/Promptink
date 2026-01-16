import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '1m', target: 20 },   // Stay at 20 users
    { duration: '30s', target: 0 },   // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],    // Error rate should be less than 1%
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Test user credentials (for authenticated endpoints)
const TEST_USER = {
  email: __ENV.TEST_USER_EMAIL || 'test@example.com',
  password: __ENV.TEST_USER_PASSWORD || 'testpassword123',
};

let authToken = null;

// Setup: Login to get auth token
export function setup() {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: TEST_USER.email,
    password: TEST_USER.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    return { token: body.token };
  }

  console.warn('Login failed, some tests will be skipped');
  return { token: null };
}

export default function(data) {
  const token = data.token;
  const authHeaders = token ? {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  } : {
    'Content-Type': 'application/json',
  };

  // Test public endpoints
  group('Public Endpoints', () => {
    // Health check
    group('Health Check', () => {
      const res = http.get(`${BASE_URL}/api/health`);
      const success = check(res, {
        'health check status is 200': (r) => r.status === 200,
      });
      errorRate.add(!success);
      apiLatency.add(res.timings.duration);
    });

    sleep(0.5);

    // Static assets
    group('Static Assets', () => {
      const res = http.get(`${BASE_URL}/`);
      check(res, {
        'homepage loads': (r) => r.status === 200,
      });
    });

    sleep(0.5);
  });

  // Test authenticated endpoints (only if we have a token)
  if (token) {
    group('Authenticated Endpoints', () => {
      // Get subscription status
      group('Subscription Status', () => {
        const res = http.get(`${BASE_URL}/api/subscription/status`, {
          headers: authHeaders,
        });
        const success = check(res, {
          'subscription status is 200': (r) => r.status === 200,
          'has subscription data': (r) => {
            try {
              const body = JSON.parse(r.body);
              return body.success === true;
            } catch {
              return false;
            }
          },
        });
        errorRate.add(!success);
        apiLatency.add(res.timings.duration);
      });

      sleep(0.5);

      // Get orders
      group('Get Orders', () => {
        const res = http.get(`${BASE_URL}/api/orders`, {
          headers: authHeaders,
        });
        const success = check(res, {
          'orders status is 200': (r) => r.status === 200,
        });
        errorRate.add(!success);
        apiLatency.add(res.timings.duration);
      });

      sleep(0.5);

      // Get user settings
      group('Get Settings', () => {
        const res = http.get(`${BASE_URL}/api/settings`, {
          headers: authHeaders,
        });
        const success = check(res, {
          'settings status is 200': (r) => r.status === 200,
        });
        errorRate.add(!success);
        apiLatency.add(res.timings.duration);
      });

      sleep(0.5);

      // Get images (gallery)
      group('Get Images', () => {
        const res = http.get(`${BASE_URL}/api/images?limit=10`, {
          headers: authHeaders,
        });
        const success = check(res, {
          'images status is 200': (r) => r.status === 200,
        });
        errorRate.add(!success);
        apiLatency.add(res.timings.duration);
      });

      sleep(0.5);
    });
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'k6/results/api-tests-summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data, options) {
  const { metrics } = data;
  let summary = '\n========== Performance Test Summary ==========\n\n';

  summary += `Total Requests: ${metrics.http_reqs?.values?.count || 0}\n`;
  summary += `Failed Requests: ${metrics.http_req_failed?.values?.passes || 0}\n`;
  summary += `Average Response Time: ${(metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms\n`;
  summary += `95th Percentile: ${(metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms\n`;
  summary += `Max Response Time: ${(metrics.http_req_duration?.values?.max || 0).toFixed(2)}ms\n`;
  summary += `Error Rate: ${((metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%\n`;

  summary += '\n===============================================\n';

  return summary;
}
