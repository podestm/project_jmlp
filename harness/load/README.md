# Load test (capacity)

Finds how many live-timing viewers and race registrations per second the application sustains, on the
real production hardware, without touching production data.

```
harness/load/run.sh [live|registration|all]
```

- Builds a disposable copy of the stack from the production Dockerfiles (`docker-compose.load.yml`,
  project `jmlp-harness-load`), with **synthetic data only** (`seed.py`: one live race with 150 racers
  and partial times, one race with open registration). No ports are published; k6 joins the network.
- Raises the load step by step and stops at the first step that misses the target:
  - live timing: p95 ≤ 1 s, errors < 1 %. A viewer polls `GET /races/live` every 5 s, so
    1 req/s = 5 viewers. Steps `LIVE_STEPS` (req/s), 45 s each.
  - registrations: race detail + `POST /registrations/`, p95 ≤ 2 s, errors < 1 %. Steps `REG_STEPS`
    (registrations/s), 20 s each. Afterwards every registration must be stored exactly once.
- **Production watchdog:** checks production `/health` every 2 s; two answers slower than
  `PROD_MAX_S` (1.5 s) abort the test immediately. Memory of the copy is capped so it cannot take RAM
  from production; CPU is shared — run it when no race is on and traffic is low.
- Results: `.harness/state/load/<timestamp>/summary.md` (+ `results.jsonl`, per-step CPU samples,
  `run.log`). The stack and its data are removed at the end, also on abort.

Limits of the model: the load generator runs on the same host (capped at 0.75 CPU), so it competes with
the application at the top steps; timekeeper writes during the race are not simulated; page assets
(JS, fonts) are served by nginx with long caching and are not part of the test.
