/**
 * Axiom — Load Test (k6)
 *
 * Stages:
 *   1. Ramp-up   : 0 → 10 VUs over 30 s
 *   2. Sustained : 10 VUs for 1 min
 *   3. Ramp-down : 10 → 0 VUs over 30 s
 *
 * Thresholds (fail the CI job if violated):
 *   - 95th-percentile response time < 3 000 ms
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
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.05'],
  },
}

// ── Env vars ───────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:39100'
const TEST_USERNAME = __ENV.TEST_USERNAME || ''
const TEST_PASSWORD = __ENV.TEST_PASSWORD || ''

// ── Setup: authenticate once before VUs start ─────────────────────────────────
//
// The login endpoint has a strict rate limit (5 req/min per IP) to prevent
// brute-force attacks. Calling login inside the default() function would cause
// every VU to hit the endpoint on every iteration, exhausting the quota almost
// immediately when running 10 concurrent VUs.
//
// Instead, setup() runs a single login before the test begins, extracts the
// access_token from the Set-Cookie response, and returns it as a Bearer token
// string. The token is injected into every VU via the `data` parameter and sent
// as an Authorization header — compatible with JWTCookieMiddleware (which only
// sets the header when one is not already present).
//
export function setup() {
  if (!TEST_USERNAME || !TEST_PASSWORD) return {}

  const res = http.post(
    `${BASE_URL}/api/v1/authentication/token/`,
    JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  )

  if (res.status !== 200) {
    throw new Error(`setup() login failed: HTTP ${res.status} — ${res.body}`)
  }

  const cookieArr = res.cookies.access_token
  if (!cookieArr || !cookieArr[0]) {
    throw new Error('setup() login succeeded but access_token cookie is missing')
  }

  return { token: cookieArr[0].value }
}

// ── Default function (one iteration per VU) ───────────────────────────────────
export default function (data) {
  // 1. Liveness check — no auth required; /live/ always returns 200 if the
  //    process is running (unlike /health/ which returns 503 when a dependency
  //    such as MinIO is unreachable, causing false-positive load-test failures).
  group('health', () => {
    const res = http.get(`${BASE_URL}/live/`)
    const ok = check(res, {
      'health: status 200': (r) => r.status === 200,
      'health: < 2000 ms': (r) => r.timings.duration < 2000,
    })
    errorRate.add(!ok)
    apiLatency.add(res.timings.duration)
  })

  // Skip authenticated endpoints when credentials are not configured
  // (allows running the script against a local dev server quickly).
  if (!TEST_USERNAME || !TEST_PASSWORD || !data.token) {
    sleep(1)
    return
  }

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.token}`,
    },
  }

  // 2. Authenticated endpoint smoke tests
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

  group('dashboard stats', () => {
    const res = http.get(`${BASE_URL}/api/v1/dashboard/stats/`, params)
    const ok = check(res, { 'dashboard: status 200': (r) => r.status === 200 })
    errorRate.add(!ok)
    apiLatency.add(res.timings.duration)
  })

  sleep(1)
}
