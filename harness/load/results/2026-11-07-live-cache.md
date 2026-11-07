# Load test 2026-11-07T17:00:45+00:00

- Commit: 1ee645f; host: 2 CPU, 3819 MB RAM (shared with production)
- Live timing: sustained **320 req/s ≈ 1600 viewers** (p95 ≤ 1 s, errors < 1 %)

| scenario | load | achieved | p95 ms | p99 ms | errors | load backend CPU % (max) | prod backend CPU % (max) |
|---|---|---|---|---|---|---|---|
| live | 20 req/s (100 viewers) | 20 | 8 | 14 | 0.00% | 8.14 | 4.01 |
| live | 40 req/s (200 viewers) | 40 | 5 | 12 | 0.00% | 9.7 | 3.78 |
| live | 80 req/s (400 viewers) | 80 | 4 | 10 | 0.00% | 16.88 | 4.74 |
| live | 120 req/s (600 viewers) | 120 | 4 | 8 | 0.00% | 23.41 | 4.65 |
| live | 160 req/s (800 viewers) | 160 | 3 | 8 | 0.00% | 26.13 | 3.4 |
| live | 200 req/s (1000 viewers) | 200 | 4 | 9 | 0.00% | 32.56 | 0.28 |
| live | 260 req/s (1300 viewers) | 259.9 | 8 | 24 | 0.00% | 39.21 | 3.6 |
| live | 320 req/s (1600 viewers) | 320 | 144 | 384 | 0.00% | 53.37 | 3.66 |
| live | 400 req/s (2000 viewers) | 399 | 747 | 1098 | 2.22% | 74.57 | 3.87 |

## Findings

- With the live payload cached as encoded JSON for 2 s per worker (`services/live_cache.py`), live
  timing serves **1000 viewers at p95 4 ms** with the backend at 33 % CPU, and **1600 viewers at p95
  144 ms**. At 2000 viewers p95 747 ms and 2.2 % errors while the backend sat at 75 % CPU: the limit
  there is the load generator on the same host (0.75 CPU) or nginx, not the application.
- Intermediate step (payload cached as a dict, JSON encoded per request): 1000 viewers at p95 287 ms,
  backend 160 % CPU — encoding was the second-largest cost.
- Before the change (2026-11-07.md): 400 viewers, failing at 600.
- Production backend stayed at ≤ 5 % CPU; the watchdog never triggered.
