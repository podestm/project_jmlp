// Live timing viewers (k6). One step of the capacity search in run.sh.
// A viewer on /zive polls GET /races/live every 5 s (frontend/src/components/pages/Live/useLiveTiming.js),
// so N viewers = N / 5 requests per second. k6 drives that request rate directly (arrival rate),
// which needs a handful of VUs instead of one per viewer.
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE_URL || 'http://frontend';
const RATE = Number(__ENV.RATE || 20); // requests per second
const DURATION = __ENV.DURATION || '45s';

export const options = {
  scenarios: {
    viewers: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: Math.min(50 + RATE, 400),
      maxVUs: 800,
    },
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  const res = http.get(`${BASE}/races/live`, { tags: { name: 'live' }, timeout: '10s' });
  check(res, { 'live 200 with results': (r) => r.status === 200 && r.body.includes('categories') });
}

export function handleSummary(data) {
  return { stdout: JSON.stringify(summarize(data)) + '\n' };
}

function summarize(data) {
  const m = data.metrics;
  return {
    scenario: 'live',
    target_rps: RATE,
    viewers: RATE * 5,
    achieved_rps: Number((m.http_reqs.values.rate || 0).toFixed(1)),
    p95_ms: Math.round(m.http_req_duration.values['p(95)']),
    p99_ms: Math.round(m.http_req_duration.values['p(99)']),
    error_rate: Number((m.http_req_failed.values.rate || 0).toFixed(4)),
    dropped: m.dropped_iterations ? m.dropped_iterations.values.count : 0,
  };
}
