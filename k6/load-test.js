/**
 * MindLedger — Load Test (k6)
 *
 * Stages:
 *   1. Ramp-up   : 0 → 10 VUs over 30 s
 *   2. Sustained : 10 VUs for 1 min
 *   3. Ramp-down : 10 → 0 VUs over 30 s
 *
 * Thresholds (fail the CI job if violated):
 *   - 95th-percentile response time < 2 000 ms
 *   - HTTP error rate < 5 %
 *
 * Required env vars (set in GitLab CI → Settings → CI/CD → Variables,
 * or pass via k6 -e flag for local runs):
 *   BASE_URL       Staging base URL, e.g. https://staging.example.com
 *   TEST_USERNAME  Username of a pre-seeded test user in the staging DB
 *   TEST_PASSWORD  Password of that test user
 *
 * Local run example (no auth):
 *   k6 run --env BASE_URL=http://localhost:39100 k6/load-test.js
 */

import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

// ── Custom metrics ─────────────────────────────────────────────────────────────
const errorRate = new Rate('errors')
const apiLatency = new Trend('api_latency_ms', true)

// ── Test configuration ─────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.05'],
  },
}

// ── Env vars ───────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:39100'
const TEST_USERNAME = __ENV.TEST_USERNAME || ''
const TEST_PASSWORD = __ENV.TEST_PASSWORD || ''

// ── Helper: obtain JWT cookies via the token endpoint ─────────────────────────
function login() {
  const res = http.post(
    `${BASE_URL}/api/v1/authentication/token/`,
    JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  )

  const ok = check(res, {
    'login: status 200': (r) => r.status === 200,
  })

  if (!ok) {
    errorRate.add(1)
    return null
  }

  // The API sets HttpOnly JWT cookies on the response; k6 tracks cookies per
  // jar automatically, so simply return the jar handle for the VU.
  return res.cookies
}

// ── Default function (one iteration per VU) ───────────────────────────────────
export default function () {
  // 1. Liveness check — no auth required; /live/ always returns 200 if the
  //    process is running (unlike /health/ which returns 503 when a dependency
  //    such as MinIO is unreachable, causing false-positive load-test failures).
  group('health', () => {
    const res = http.get(`${BASE_URL}/live/`)
    const ok = check(res, {
      'health: status 200': (r) => r.status === 200,
      'health: < 500 ms': (r) => r.timings.duration < 500,
    })
    errorRate.add(!ok)
    apiLatency.add(res.timings.duration)
  })

  // Skip authenticated endpoints when credentials are not configured
  // (allows running the script against a local dev server quickly).
  if (!TEST_USERNAME || !TEST_PASSWORD) {
    sleep(1)
    return
  }

  // 2. Authenticate
  const cookies = login()
  if (!cookies) {
    sleep(1)
    return
  }

  const params = {
    headers: { 'Content-Type': 'application/json' },
    cookies,
  }

  // 3. Authenticated endpoint smoke tests
  group('expenses list', () => {
    const res = http.get(`${BASE_URL}/api/v1/expenses/`, params)
    const ok = check(res, {
      'expenses: status 200': (r) => r.status === 200,
      'expenses: has results key': (r) => {
        try {
          return JSON.parse(r.body).results !== undefined
        } catch {
          return false
        }
      },
    })
    errorRate.add(!ok)
    apiLatency.add(res.timings.duration)
  })

  group('revenues list', () => {
    const res = http.get(`${BASE_URL}/api/v1/revenues/`, params)
    const ok = check(res, { 'revenues: status 200': (r) => r.status === 200 })
    errorRate.add(!ok)
    apiLatency.add(res.timings.duration)
  })

  group('dashboard', () => {
    const res = http.get(`${BASE_URL}/api/v1/dashboard/`, params)
    const ok = check(res, { 'dashboard: status 200': (r) => r.status === 200 })
    errorRate.add(!ok)
    apiLatency.add(res.timings.duration)
  })

  sleep(1)
}
