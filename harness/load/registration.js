// Race registrations (k6). One step of the capacity search in run.sh.
// A parent opens the race detail, then submits the form for a new racer (invented data only).
import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';

const BASE = __ENV.BASE_URL || 'http://frontend';
const RATE = Number(__ENV.RATE || 1); // registrations per second
const DURATION = __ENV.DURATION || '30s';
const RACE_ID = Number(__ENV.RACE_ID || 2);
const CLUBS = Number(__ENV.CLUBS || 10);
const STEP = __ENV.STEP || '0'; // keeps names unique across steps

export const options = {
  scenarios: {
    parents: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: Math.min(20 + RATE * 4, 300),
      maxVUs: 600,
    },
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
  // Not a pass/fail gate (run.sh decides); it makes k6 report the POST on its own.
  thresholds: { 'http_req_duration{name:register}': ['max>=0'] },
};

export default function () {
  const n = exec.scenario.iterationInTest;
  const detail = http.get(`${BASE}/races/${RACE_ID}`, { tags: { name: 'race_detail' }, timeout: '10s' });
  check(detail, { 'detail 200': (r) => r.status === 200 });

  const body = JSON.stringify({
    race_id: RACE_ID,
    racer_name: `Zatez${STEP}x${n}`,
    racer_surname: `Testovaci${STEP}x${n}`,
    racer_sex: 1 + (n % 2),
    racer_year: 2011 + (n % 8),
    racer_email: `load-${STEP}-${n}@example.com`,
    club_id: 1 + (n % CLUBS),
  });
  const res = http.post(`${BASE}/registrations/`, body, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'register' },
    timeout: '15s',
  });
  check(res, { 'registered 200': (r) => r.status === 200 });
}

export function handleSummary(data) {
  const m = data.metrics;
  const reg = m['http_req_duration{name:register}'] || m.http_req_duration;
  const summary = {
    scenario: 'registration',
    target_per_s: RATE,
    attempted: m.iterations ? m.iterations.values.count : 0,
    p95_ms: Math.round(reg.values['p(95)']),
    p99_ms: Math.round(reg.values['p(99)']),
    error_rate: Number((m.http_req_failed.values.rate || 0).toFixed(4)),
    dropped: m.dropped_iterations ? m.dropped_iterations.values.count : 0,
  };
  return { stdout: JSON.stringify(summary) + '\n' };
}
