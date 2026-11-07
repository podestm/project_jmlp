# JMLP — race management for a Czech youth ski cup

Production system of the South Moravian Ski Cup (Jihomoravský lyžařský pohár): public website, online
registration, admin back office and an offline-first timekeeper used on the hill on race day.
FastAPI + raw SQL on MySQL, React 18 + Vite, IndexedDB sync for the timekeeper.

The repository is set up to be developed by coding agents. Start with [AGENTS.md](AGENTS.md).

## Agent harness

| Piece | Where |
|---|---|
| Conventions and rules, nested per area | `AGENTS.md`, `backend/`, `frontend/`, `frontend/src/offline/` (imported by `CLAUDE.md`) |
| Session briefing | `harness/init.sh` |
| Verification loop (fast / full) | `harness/verify.sh`; backend tests on a throwaway MySQL |
| Cross-session state | `harness/features.json` (features, acceptance, checks, status), `harness/progress.md` (handoff log) |
| Guardrails | `.claude/settings.json` permissions; hooks in `.claude/hooks/` (command guard, per-file checks, verify-before-stop) |
| Reviewer agents | `.claude/agents/` — code, offline invariants, design system, real-browser verification |
| Workflow | `/next` → work → `/checkpoint`, `/review` (`.claude/skills/`) |
| Harness self-test | `harness/tests/run.sh` |
| CI on every pull request | `.github/workflows/ci.yml` (same checks as `verify.sh full`) |

## Run the checks

```bash
harness/init.sh            # prerequisites + briefing
harness/verify.sh fast     # changed files
harness/verify.sh full     # everything (needs Docker)
```

Deployment of the test and production environments is described in `deploy/` and is operated by a human.
