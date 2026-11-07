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

## 2026-11-07 — CI workflow (HAR-05)
- Done: `.github/workflows/ci.yml` — frontend (lint, style/import rules, vitest, build), backend (pytest on a
  MySQL 8 service container, app user limited to jmlpcz_test) and harness self-test. Runs on push to dev and on
  PRs to main (owner's flow: local work → push dev → CI → auto-deploy to test → browser check → PR dev→main).
  `deploy/test/auto-deploy-dev.sh` deploys a dev commit only after all three jobs succeeded on it.
- Verified: YAML parses; `harness/tests/run.sh` PASS; CI gate dry-run: no runs → wait, unknown → no deploy.
  First GitHub run pending.
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
