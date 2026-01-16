# K6 Performance Testing

This directory contains k6 performance test scripts for PromptInk.

## Prerequisites

1. **Install k6:**
   ```bash
   # macOS
   brew install k6

   # Ubuntu/Debian
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6

   # Windows
   choco install k6
   ```

2. **For Grafana integration (optional):**
   - Install Docker
   - Install InfluxDB and Grafana

## Test Scripts

| Script | Description |
|--------|-------------|
| `scripts/load-test.js` | Basic load test with smoke, load, and stress scenarios |
| `scripts/api-tests.js` | API endpoint tests |
| `scripts/authenticated-tests.js` | Tests for authenticated endpoints (requires login) |

## Running Tests Locally

### Basic Load Test
```bash
k6 run scripts/load-test.js
```

### With Custom Target URL
```bash
k6 run -e BASE_URL=https://promptink-production.up.railway.app scripts/load-test.js
```

### Authenticated Tests
```bash
k6 run \
  -e BASE_URL=https://promptink-production.up.railway.app \
  -e TEST_USER_EMAIL=your-test-email@example.com \
  -e TEST_USER_PASSWORD=your-test-password \
  scripts/authenticated-tests.js
```

### Smoke Test (Quick Validation)
```bash
k6 run --duration 30s --vus 1 scripts/load-test.js
```

### Custom VUs and Duration
```bash
k6 run --vus 50 --duration 5m scripts/load-test.js
```

## Output Formats

### JSON Output
```bash
k6 run --out json=results/test-output.json scripts/load-test.js
```

### CSV Output
```bash
k6 run --out csv=results/test-output.csv scripts/load-test.js
```

## Grafana Integration

### Option 1: Grafana Cloud (Recommended)

1. Create a Grafana Cloud account at https://grafana.com/products/cloud/
2. Get your K6 Cloud token from Grafana Cloud
3. Run with cloud output:
   ```bash
   K6_CLOUD_TOKEN=your-token k6 cloud scripts/load-test.js
   ```

### Option 2: Local InfluxDB + Grafana

1. **Start InfluxDB and Grafana with Docker:**
   ```bash
   docker run -d --name influxdb -p 8086:8086 influxdb:1.8
   docker run -d --name grafana -p 3000:3000 grafana/grafana
   ```

2. **Run k6 with InfluxDB output:**
   ```bash
   k6 run --out influxdb=http://localhost:8086/k6 scripts/load-test.js
   ```

3. **Import Dashboard:**
   - Open Grafana at http://localhost:3000
   - Add InfluxDB data source (URL: http://influxdb:8086, Database: k6)
   - Import `grafana-dashboard.json`

## GitHub Actions

The performance tests are integrated into GitHub Actions:

- **Smoke tests** run on every push to main
- **Load tests** run daily at 6 AM UTC
- **Manual trigger** for stress tests

### Required Secrets

Add these secrets to your GitHub repository:

| Secret | Description |
|--------|-------------|
| `K6_CLOUD_TOKEN` | (Optional) Grafana Cloud K6 token |
| `TEST_USER_EMAIL` | Test user email for authenticated tests |
| `TEST_USER_PASSWORD` | Test user password for authenticated tests |

## Performance Thresholds

| Metric | Threshold | Description |
|--------|-----------|-------------|
| `http_req_duration` | p(95) < 500ms | 95% of requests under 500ms |
| `http_req_failed` | rate < 1% | Less than 1% failed requests |
| `login_latency` | p(95) < 1000ms | Login under 1 second |

## Test Results

Results are saved to the `results/` directory:
- `*-summary.json` - Test summary in JSON format
- `*-report.html` - HTML report (for authenticated tests)

## Troubleshooting

### Login Failed
- Verify `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` are correct
- Ensure the test user exists in the target environment

### Connection Refused
- Verify `BASE_URL` is correct and accessible
- Check if the server is running

### High Error Rate
- Check server logs for errors
- Reduce VUs to find the breaking point
