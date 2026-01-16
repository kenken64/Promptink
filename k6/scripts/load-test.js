import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const requestsPerSecond = new Counter('requests_per_second');
const responseTime = new Trend('response_time');

// Load test configuration - stress test
export const options = {
  scenarios: {
    // Smoke test - minimal load to verify system works
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      startTime: '0s',
      tags: { test_type: 'smoke' },
    },
    // Load test - normal expected load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },   // Ramp up
        { duration: '3m', target: 20 },   // Stay at peak
        { duration: '1m', target: 0 },    // Ramp down
      ],
      startTime: '30s',
      tags: { test_type: 'load' },
    },
    // Stress test - beyond normal load
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },   // Ramp up to stress level
        { duration: '2m', target: 50 },   // Stay at stress level
        { duration: '1m', target: 100 },  // Push to breaking point
        { duration: '2m', target: 100 },  // Hold at breaking point
        { duration: '2m', target: 0 },    // Ramp down
      ],
      startTime: '6m',
      tags: { test_type: 'stress' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],  // Response time thresholds
    http_req_failed: ['rate<0.05'],                   // Max 5% error rate
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://promptink-production.up.railway.app';

export default function() {
  // Test the main page load
  const mainPage = http.get(`${BASE_URL}/`);
  check(mainPage, {
    'main page status is 200': (r) => r.status === 200,
    'main page loads under 2s': (r) => r.timings.duration < 2000,
  });
  responseTime.add(mainPage.timings.duration);
  requestsPerSecond.add(1);

  sleep(Math.random() * 2 + 1); // Random sleep 1-3 seconds

  // Test static assets
  const cssRes = http.get(`${BASE_URL}/assets/styles.css`);
  check(cssRes, {
    'CSS loads': (r) => r.status === 200,
  });

  sleep(Math.random() * 1 + 0.5); // Random sleep 0.5-1.5 seconds

  // Test API health endpoint
  const healthRes = http.get(`${BASE_URL}/api/health`);
  const healthSuccess = check(healthRes, {
    'health check is 200': (r) => r.status === 200,
  });
  errorRate.add(!healthSuccess);
  responseTime.add(healthRes.timings.duration);
  requestsPerSecond.add(1);

  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  const summary = generateSummary(data);

  return {
    'stdout': summary,
    'k6/results/load-test-summary.json': JSON.stringify(data, null, 2),
    'k6/results/load-test-summary.html': generateHtmlReport(data),
  };
}

function generateSummary(data) {
  const { metrics } = data;

  let summary = `
╔══════════════════════════════════════════════════════════════╗
║                    K6 LOAD TEST RESULTS                      ║
╠══════════════════════════════════════════════════════════════╣
║ Target URL: ${BASE_URL.padEnd(47)}║
╠══════════════════════════════════════════════════════════════╣
║ REQUESTS                                                     ║
║   Total:         ${String(metrics.http_reqs?.values?.count || 0).padEnd(42)}║
║   Rate:          ${String((metrics.http_reqs?.values?.rate || 0).toFixed(2) + '/s').padEnd(42)}║
╠══════════════════════════════════════════════════════════════╣
║ RESPONSE TIME                                                ║
║   Average:       ${String((metrics.http_req_duration?.values?.avg || 0).toFixed(2) + 'ms').padEnd(42)}║
║   Median:        ${String((metrics.http_req_duration?.values?.med || 0).toFixed(2) + 'ms').padEnd(42)}║
║   P90:           ${String((metrics.http_req_duration?.values?.['p(90)'] || 0).toFixed(2) + 'ms').padEnd(42)}║
║   P95:           ${String((metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2) + 'ms').padEnd(42)}║
║   P99:           ${String((metrics.http_req_duration?.values?.['p(99)'] || 0).toFixed(2) + 'ms').padEnd(42)}║
║   Max:           ${String((metrics.http_req_duration?.values?.max || 0).toFixed(2) + 'ms').padEnd(42)}║
╠══════════════════════════════════════════════════════════════╣
║ ERRORS                                                       ║
║   Failed Reqs:   ${String(metrics.http_req_failed?.values?.passes || 0).padEnd(42)}║
║   Error Rate:    ${String(((metrics.errors?.values?.rate || 0) * 100).toFixed(2) + '%').padEnd(42)}║
╠══════════════════════════════════════════════════════════════╣
║ DATA TRANSFER                                                ║
║   Received:      ${String(formatBytes(metrics.data_received?.values?.count || 0)).padEnd(42)}║
║   Sent:          ${String(formatBytes(metrics.data_sent?.values?.count || 0)).padEnd(42)}║
╚══════════════════════════════════════════════════════════════╝
`;

  return summary;
}

function generateHtmlReport(data) {
  const { metrics } = data;

  return `<!DOCTYPE html>
<html>
<head>
  <title>K6 Load Test Report - PromptInk</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #1a1a2e; color: #eee; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #14b8a6; border-bottom: 2px solid #14b8a6; padding-bottom: 10px; }
    .card { background: #16213e; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
    .metric { display: inline-block; margin: 10px 20px; text-align: center; }
    .metric-value { font-size: 2em; font-weight: bold; color: #14b8a6; }
    .metric-label { color: #888; font-size: 0.9em; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
    .success { color: #10b981; }
    .warning { color: #f59e0b; }
    .error { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #333; }
    th { background: #0f3460; color: #14b8a6; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 K6 Load Test Report</h1>
    <p>Target: <strong>${BASE_URL}</strong></p>
    <p>Generated: ${new Date().toISOString()}</p>

    <div class="card">
      <h2>📊 Summary</h2>
      <div class="grid">
        <div class="metric">
          <div class="metric-value">${metrics.http_reqs?.values?.count || 0}</div>
          <div class="metric-label">Total Requests</div>
        </div>
        <div class="metric">
          <div class="metric-value">${(metrics.http_reqs?.values?.rate || 0).toFixed(1)}/s</div>
          <div class="metric-label">Requests/sec</div>
        </div>
        <div class="metric">
          <div class="metric-value">${(metrics.http_req_duration?.values?.avg || 0).toFixed(0)}ms</div>
          <div class="metric-label">Avg Response</div>
        </div>
        <div class="metric">
          <div class="metric-value ${(metrics.errors?.values?.rate || 0) < 0.01 ? 'success' : 'error'}">${((metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%</div>
          <div class="metric-label">Error Rate</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>⏱️ Response Time Percentiles</h2>
      <table>
        <tr><th>Percentile</th><th>Response Time</th></tr>
        <tr><td>P50 (Median)</td><td>${(metrics.http_req_duration?.values?.med || 0).toFixed(2)}ms</td></tr>
        <tr><td>P90</td><td>${(metrics.http_req_duration?.values?.['p(90)'] || 0).toFixed(2)}ms</td></tr>
        <tr><td>P95</td><td>${(metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms</td></tr>
        <tr><td>P99</td><td>${(metrics.http_req_duration?.values?.['p(99)'] || 0).toFixed(2)}ms</td></tr>
        <tr><td>Max</td><td>${(metrics.http_req_duration?.values?.max || 0).toFixed(2)}ms</td></tr>
      </table>
    </div>

    <div class="card">
      <h2>📦 Data Transfer</h2>
      <div class="grid">
        <div class="metric">
          <div class="metric-value">${formatBytes(metrics.data_received?.values?.count || 0)}</div>
          <div class="metric-label">Data Received</div>
        </div>
        <div class="metric">
          <div class="metric-value">${formatBytes(metrics.data_sent?.values?.count || 0)}</div>
          <div class="metric-label">Data Sent</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
