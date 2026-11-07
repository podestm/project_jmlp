# Progress log

Handoff notes between agent sessions and context windows. Newest entry first. A new session reads the
top entry before doing anything else; a session that ends (or is about to be compacted) adds one.
Keep entries short: what changed, what was verified, what is next, what is blocked. Facts that stay true
belong in AGENTS.md, docs/ or an ADR, not here.

Template:

```
## YYYY-MM-DD — <topic> (<feature ids>)
- Done:
- Verified: <command> → <result>
- Next:
- Blocked / decisions needed:
```

---

## 2026-11-07 — Load test harness and first capacity run (PERF-01, PERF-02)
- Done: `harness/load/` — disposable copy of the production stack with synthetic data, k6 step search,
  production watchdog, results in .harness/state/load and harness/load/results/.
- Verified: run on the production host in a quiet period: live timing 400 viewers OK, 600 fails (p95 4 s,
  backend CPU-bound) → PERF-01 failing; registrations ≥ 32/s, all stored once → PERF-02 passing.
  Production backend ≤ 4 % CPU during the run, watchdog never triggered.
- Next: PERF-01 — cache the /races/live payload for a few seconds, re-run `harness/load/run.sh live`.
- Blocked / decisions needed: none.

## 2026-11-07 — CI/CD live; weekend block removed (HAR-05)
- Done: first production deployment 08befe1 -> 721a036 (manual run of deploy-main.sh), GitHub deploy job
  connected and re-ran green. Owner removed the weekend block: only the owner merges to main and decides when
  to deploy. Deploy lock moved from /tmp to the state dir (a root-owned /tmp lock from the agent's dry-runs
  had blocked the first run). Calendar empty-state fix (fd39eac) went through dev -> test.
- Verified: shellcheck clean; dry-run on a Saturday without flag deploys, unhealthy -> rollback; production
  /health 200, season API reports the migrated is_current flag.
- Next: HAR-04 Playwright e2e suite; mount the repo root in harness/lib/backend-tests.sh so the API contract
  test also runs locally (ask first, harness/lib).
- Blocked / decisions needed: none.

## 2026-11-07 — Production deployment triggered by merge to main (HAR-05)
- Done: owner's decision — no timer; merging PR dev -> main deploys. CI job `deploy` (needs frontend, backend,
  harness; environment `production`, optional required reviewers) connects with a key whose authorized_keys
  entry forces deploy/prod/ssh-deploy.sh (accepts only `deploy <40-hex sha>`), which runs deploy-main.sh:
  tip-of-main check, CI gate (shared deploy/lib/ci-gate.sh), weekend block, DB dump, pred-<sha> image tags,
  3-min health check, automatic rollback of images + code (not DB), failed-commit marker. Runs on main are
  never cancelled; hangup is ignored so a dropped connection cannot kill a build.
- Verified: shellcheck clean; workflow parses; dry-run with stubbed docker/curl — weekend, older sha skipped,
  unknown sha, CI pending, CI failed, unhealthy -> rollback, retry of failed commit, healthy deploy, nothing new;
  forced-command filter rejects anything but `deploy <sha>`; `harness/tests/run.sh` PASS.
- Next: owner sets up environment, key and secrets (deploy/prod/README.md), first deployment manual.
- Blocked / decisions needed: owner of the production checkout not verified by the agent (guard).

## 2026-11-07 — CI workflow (HAR-05)
- Done: `.github/workflows/ci.yml` — frontend (lint, style/import rules, vitest, build), backend (pytest on a
  MySQL 8 service container, app user limited to jmlpcz_test) and harness self-test. Runs on push to dev and on
  PRs to dev and main (owner's flow: local work → push dev → CI → auto-deploy to test → browser check → PR dev→main).
  `deploy/test/auto-deploy-dev.sh` deploys a dev commit only after all three jobs succeeded on it.
- Verified: YAML parses; `harness/tests/run.sh` PASS; CI gate dry-run: no runs → wait, unknown → no deploy.
  First GitHub run: backend red — test_api_contract.py runs only with the frontend present (skipped in
  harness/lib/backend-tests.sh, which mounts backend/app only) and misread `/standings${query}` as a path.
  Fixed the path-shape helper (+ test); full backend suite with the whole repo: 801 passed, 0 skipped.
- Known: local backend-tests.sh still skips the contract test; mount the repo root there (harness/lib, ask first).
- Next: make `frontend`, `backend`, `harness` required status checks in the main ruleset; then HAR-04.
- Blocked / decisions needed: none.

## 2026-11-07 — Agent harness, phase 1–3 (HAR-01)
- Done: AGENTS.md as canonical entry point with nested AGENTS.md for backend, frontend and the offline layer;
  CLAUDE.md files import them. Architecture and design rules live in those AGENTS.md files; no docs/ folder
  (owner's decision: no documentation folder in the application repo).
  `.claude/` gained shared settings (permissions, hooks), subagents (code-reviewer, offline-auditor,
  design-reviewer, browser-verifier) and workflow skills (/next, /checkpoint, /review).
  `harness/` gained init.sh, verify.sh (fast/full), a throwaway-MySQL backend test runner, this log and
  features.json. Server-specific details moved to the gitignored CLAUDE.local.md before the repo goes public.
  Removed docs/ (superpowers plans, old Czech README/runbook), .github prompt, and the unused local dev
  setup (docker-compose.yml, build.sh, rebuild.sh, docker/mysql/init). Production and test compose files stay.
- Verified: `harness/tests/run.sh` PASS (guard 25 block / 23 allow cases); `harness/verify.sh full` PASS —
  eslint, style rules, frontend 1247 tests, backend 799 passed / 1 skipped on throwaway MySQL, build (~6 min).
- Known: `npm run check:orphans` flags `src/pdf/liza/testHelpers.js` (imported only by tests) — not in verify until fixed.
- Next: HAR-04 Playwright e2e suite (start with the offline timekeeper day, TK-03), then HAR-05 CI, HAR-06 evals.
- Blocked / decisions needed: `db/init_exact.sql` seeds `admin@jmlp.cz` / `admin123`; confirm production
  no longer accepts it before publishing. Git history was not rewritten; it contains placeholder secrets only.
