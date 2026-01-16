import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginLatency = new Trend('login_latency');
const apiLatency = new Trend('api_latency');
const imageGenLatency = new Trend('image_generation_latency');

// Test configuration
export const options = {
  scenarios: {
    // Authenticated user journey simulation
    authenticated_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5 },   // Ramp up to 5 users
        { duration: '2m', target: 5 },    // Stay at 5 users
        { duration: '30s', target: 10 },  // Ramp up to 10 users
        { duration: '2m', target: 10 },   // Stay at 10 users
        { duration: '1m', target: 0 },    // Ramp down
      ],
      tags: { test_type: 'authenticated' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],    // 95% of requests under 2s
    http_req_failed: ['rate<0.05'],        // Max 5% failure rate
    errors: ['rate<0.05'],
    login_latency: ['p(95)<1000'],         // Login should be under 1s
    api_latency: ['p(95)<500'],            // API calls under 500ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://promptink-production.up.railway.app';

// Test user credentials - set via environment variables
const TEST_USER = {
  email: __ENV.TEST_USER_EMAIL || 'test@example.com',
  password: __ENV.TEST_USER_PASSWORD || 'testpassword123',
};

export default function() {
  let authToken = null;

  // ==================== LOGIN ====================
  group('Authentication', () => {
    group('Login', () => {
      const loginPayload = JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
      });

      const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'login' },
      });

      loginLatency.add(loginRes.timings.duration);

      const loginSuccess = check(loginRes, {
        'login status is 200': (r) => r.status === 200,
        'login returns token': (r) => {
          try {
            const body = JSON.parse(r.body);
            if (body.token) {
              authToken = body.token;
              return true;
            }
            return false;
          } catch {
            return false;
          }
        },
      });

      errorRate.add(!loginSuccess);

      if (!loginSuccess) {
        console.error(`Login failed: ${loginRes.status} - ${loginRes.body}`);
        return;
      }
    });
  });

  // Skip remaining tests if login failed
  if (!authToken) {
    sleep(1);
    return;
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };

  sleep(0.5);

  // ==================== SUBSCRIPTION ENDPOINTS ====================
  group('Subscription APIs', () => {
    group('Get Subscription Status', () => {
      const res = http.get(`${BASE_URL}/api/subscription/status`, {
        headers: authHeaders,
        tags: { name: 'subscription_status' },
      });

      const success = check(res, {
        'subscription status is 200': (r) => r.status === 200,
        'subscription has data': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.success === true && body.subscription !== undefined;
          } catch {
            return false;
          }
        },
      });

      errorRate.add(!success);
      apiLatency.add(res.timings.duration);
    });

    sleep(0.3);

    group('Get Access Status', () => {
      const res = http.get(`${BASE_URL}/api/subscription/access`, {
        headers: authHeaders,
        tags: { name: 'subscription_access' },
      });

      check(res, {
        'access status is 200': (r) => r.status === 200,
      });
      apiLatency.add(res.timings.duration);
    });
  });

  sleep(0.5);

  // ==================== ORDER ENDPOINTS ====================
  group('Order APIs', () => {
    group('Get Orders List', () => {
      const res = http.get(`${BASE_URL}/api/orders`, {
        headers: authHeaders,
        tags: { name: 'orders_list' },
      });

      const success = check(res, {
        'orders list is 200': (r) => r.status === 200,
        'orders returns array': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.success === true && Array.isArray(body.orders);
          } catch {
            return false;
          }
        },
      });

      errorRate.add(!success);
      apiLatency.add(res.timings.duration);
    });

    sleep(0.3);

    group('Get Order Status', () => {
      const res = http.get(`${BASE_URL}/api/orders/status`, {
        headers: authHeaders,
        tags: { name: 'orders_status' },
      });

      check(res, {
        'order status is 200': (r) => r.status === 200,
      });
      apiLatency.add(res.timings.duration);
    });
  });

  sleep(0.5);

  // ==================== SETTINGS ENDPOINTS ====================
  group('Settings APIs', () => {
    group('Get User Settings', () => {
      const res = http.get(`${BASE_URL}/api/settings`, {
        headers: authHeaders,
        tags: { name: 'settings_get' },
      });

      const success = check(res, {
        'settings is 200': (r) => r.status === 200,
      });

      errorRate.add(!success);
      apiLatency.add(res.timings.duration);
    });
  });

  sleep(0.5);

  // ==================== GALLERY/IMAGES ENDPOINTS ====================
  group('Gallery APIs', () => {
    group('Get Images List', () => {
      const res = http.get(`${BASE_URL}/api/images?limit=20&offset=0`, {
        headers: authHeaders,
        tags: { name: 'images_list' },
      });

      const success = check(res, {
        'images list is 200': (r) => r.status === 200,
        'images returns data': (r) => {
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

    sleep(0.3);

    group('Get Favorites', () => {
      const res = http.get(`${BASE_URL}/api/images?favorites=true&limit=10`, {
        headers: authHeaders,
        tags: { name: 'images_favorites' },
      });

      check(res, {
        'favorites is 200': (r) => r.status === 200,
      });
      apiLatency.add(res.timings.duration);
    });
  });

  sleep(0.5);

  // ==================== USER INFO ====================
  group('User APIs', () => {
    group('Get Current User', () => {
      const res = http.get(`${BASE_URL}/api/auth/me`, {
        headers: authHeaders,
        tags: { name: 'user_me' },
      });

      const success = check(res, {
        'user info is 200': (r) => r.status === 200,
        'user has email': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.user && body.user.email;
          } catch {
            return false;
          }
        },
      });

      errorRate.add(!success);
      apiLatency.add(res.timings.duration);
    });
  });

  // Random sleep between iterations (simulating real user behavior)
  sleep(Math.random() * 3 + 2);
}

export function handleSummary(data) {
  const summary = generateReport(data);

  return {
    'stdout': summary.text,
    'k6/results/authenticated-tests-summary.json': JSON.stringify(data, null, 2),
    'k6/results/authenticated-tests-report.html': summary.html,
  };
}

function generateReport(data) {
  const { metrics } = data;

  const text = `
╔════════════════════════════════════════════════════════════════════╗
║           AUTHENTICATED ENDPOINTS PERFORMANCE REPORT               ║
╠════════════════════════════════════════════════════════════════════╣
║ Target: ${BASE_URL.padEnd(57)}║
║ Time:   ${new Date().toISOString().padEnd(57)}║
╠════════════════════════════════════════════════════════════════════╣
║ OVERALL METRICS                                                    ║
╠════════════════════════════════════════════════════════════════════╣
║ Total Requests:      ${String(metrics.http_reqs?.values?.count || 0).padEnd(45)}║
║ Request Rate:        ${String((metrics.http_reqs?.values?.rate || 0).toFixed(2) + ' req/s').padEnd(45)}║
║ Failed Requests:     ${String(metrics.http_req_failed?.values?.passes || 0).padEnd(45)}║
║ Error Rate:          ${String(((metrics.errors?.values?.rate || 0) * 100).toFixed(2) + '%').padEnd(45)}║
╠════════════════════════════════════════════════════════════════════╣
║ RESPONSE TIMES                                                     ║
╠════════════════════════════════════════════════════════════════════╣
║ Average:             ${String((metrics.http_req_duration?.values?.avg || 0).toFixed(2) + 'ms').padEnd(45)}║
║ Median (P50):        ${String((metrics.http_req_duration?.values?.med || 0).toFixed(2) + 'ms').padEnd(45)}║
║ P90:                 ${String((metrics.http_req_duration?.values?.['p(90)'] || 0).toFixed(2) + 'ms').padEnd(45)}║
║ P95:                 ${String((metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2) + 'ms').padEnd(45)}║
║ P99:                 ${String((metrics.http_req_duration?.values?.['p(99)'] || 0).toFixed(2) + 'ms').padEnd(45)}║
║ Max:                 ${String((metrics.http_req_duration?.values?.max || 0).toFixed(2) + 'ms').padEnd(45)}║
╠════════════════════════════════════════════════════════════════════╣
║ LOGIN PERFORMANCE                                                  ║
╠════════════════════════════════════════════════════════════════════╣
║ Avg Login Time:      ${String((metrics.login_latency?.values?.avg || 0).toFixed(2) + 'ms').padEnd(45)}║
║ P95 Login Time:      ${String((metrics.login_latency?.values?.['p(95)'] || 0).toFixed(2) + 'ms').padEnd(45)}║
╠════════════════════════════════════════════════════════════════════╣
║ API PERFORMANCE                                                    ║
╠════════════════════════════════════════════════════════════════════╣
║ Avg API Latency:     ${String((metrics.api_latency?.values?.avg || 0).toFixed(2) + 'ms').padEnd(45)}║
║ P95 API Latency:     ${String((metrics.api_latency?.values?.['p(95)'] || 0).toFixed(2) + 'ms').padEnd(45)}║
╚════════════════════════════════════════════════════════════════════╝
`;

  const html = generateHtmlReport(data, metrics);

  return { text, html };
}

function generateHtmlReport(data, metrics) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Authenticated Performance Test - PromptInk</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #eee; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #14b8a6; margin-bottom: 10px; }
    .subtitle { color: #888; margin-bottom: 30px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .card { background: rgba(22, 33, 62, 0.8); border-radius: 12px; padding: 24px; border: 1px solid rgba(20, 184, 166, 0.2); }
    .card h3 { color: #14b8a6; margin-top: 0; margin-bottom: 16px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
    .metric-big { font-size: 36px; font-weight: bold; color: #fff; }
    .metric-label { color: #888; font-size: 14px; margin-top: 4px; }
    .metric-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .metric-row:last-child { border-bottom: none; }
    .success { color: #10b981; }
    .warning { color: #f59e0b; }
    .error { color: #ef4444; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge.success { background: rgba(16, 185, 129, 0.2); color: #10b981; }
    .badge.error { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px 16px; text-align: left; }
    th { background: rgba(15, 52, 96, 0.5); color: #14b8a6; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
    td { border-bottom: 1px solid rgba(255,255,255,0.1); }
    .progress-bar { height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; margin-top: 8px; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #14b8a6, #10b981); border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Authenticated Performance Test Report</h1>
    <p class="subtitle">Target: ${BASE_URL} | Generated: ${new Date().toLocaleString()}</p>

    <div class="cards">
      <div class="card">
        <h3>Total Requests</h3>
        <div class="metric-big">${metrics.http_reqs?.values?.count || 0}</div>
        <div class="metric-label">${(metrics.http_reqs?.values?.rate || 0).toFixed(1)} requests/sec</div>
      </div>

      <div class="card">
        <h3>Error Rate</h3>
        <div class="metric-big ${(metrics.errors?.values?.rate || 0) < 0.01 ? 'success' : (metrics.errors?.values?.rate || 0) < 0.05 ? 'warning' : 'error'}">
          ${((metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%
        </div>
        <div class="metric-label">
          <span class="badge ${(metrics.errors?.values?.rate || 0) < 0.05 ? 'success' : 'error'}">
            ${(metrics.errors?.values?.rate || 0) < 0.05 ? 'PASSED' : 'FAILED'}
          </span>
        </div>
      </div>

      <div class="card">
        <h3>Avg Response Time</h3>
        <div class="metric-big">${(metrics.http_req_duration?.values?.avg || 0).toFixed(0)}ms</div>
        <div class="metric-label">P95: ${(metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(0)}ms</div>
      </div>

      <div class="card">
        <h3>Login Performance</h3>
        <div class="metric-big">${(metrics.login_latency?.values?.avg || 0).toFixed(0)}ms</div>
        <div class="metric-label">P95: ${(metrics.login_latency?.values?.['p(95)'] || 0).toFixed(0)}ms</div>
      </div>
    </div>

    <div class="card">
      <h3>Response Time Breakdown</h3>
      <table>
        <tr><th>Percentile</th><th>Response Time</th><th>Status</th></tr>
        <tr>
          <td>P50 (Median)</td>
          <td>${(metrics.http_req_duration?.values?.med || 0).toFixed(2)}ms</td>
          <td><span class="badge success">OK</span></td>
        </tr>
        <tr>
          <td>P90</td>
          <td>${(metrics.http_req_duration?.values?.['p(90)'] || 0).toFixed(2)}ms</td>
          <td><span class="badge ${(metrics.http_req_duration?.values?.['p(90)'] || 0) < 1000 ? 'success' : 'error'}">${(metrics.http_req_duration?.values?.['p(90)'] || 0) < 1000 ? 'OK' : 'SLOW'}</span></td>
        </tr>
        <tr>
          <td>P95</td>
          <td>${(metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms</td>
          <td><span class="badge ${(metrics.http_req_duration?.values?.['p(95)'] || 0) < 2000 ? 'success' : 'error'}">${(metrics.http_req_duration?.values?.['p(95)'] || 0) < 2000 ? 'OK' : 'SLOW'}</span></td>
        </tr>
        <tr>
          <td>P99</td>
          <td>${(metrics.http_req_duration?.values?.['p(99)'] || 0).toFixed(2)}ms</td>
          <td><span class="badge ${(metrics.http_req_duration?.values?.['p(99)'] || 0) < 3000 ? 'success' : 'error'}">${(metrics.http_req_duration?.values?.['p(99)'] || 0) < 3000 ? 'OK' : 'SLOW'}</span></td>
        </tr>
        <tr>
          <td>Max</td>
          <td>${(metrics.http_req_duration?.values?.max || 0).toFixed(2)}ms</td>
          <td>-</td>
        </tr>
      </table>
    </div>

    <div class="card">
      <h3>API Endpoints Tested</h3>
      <table>
        <tr><th>Endpoint</th><th>Method</th><th>Auth Required</th></tr>
        <tr><td>/api/auth/login</td><td>POST</td><td>No</td></tr>
        <tr><td>/api/auth/me</td><td>GET</td><td>Yes</td></tr>
        <tr><td>/api/subscription/status</td><td>GET</td><td>Yes</td></tr>
        <tr><td>/api/subscription/access</td><td>GET</td><td>Yes</td></tr>
        <tr><td>/api/orders</td><td>GET</td><td>Yes</td></tr>
        <tr><td>/api/orders/status</td><td>GET</td><td>Yes</td></tr>
        <tr><td>/api/settings</td><td>GET</td><td>Yes</td></tr>
        <tr><td>/api/images</td><td>GET</td><td>Yes</td></tr>
      </table>
    </div>
  </div>
</body>
</html>`;
}
