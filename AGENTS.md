# AGENTS.md

Operating manual for coding agents (Claude Code, Codex, Cursor, …) working in this repository. It is the
canonical source; `CLAUDE.md` files import it. Nested `AGENTS.md` files add rules for their subtree and win
over this file where they are more specific.

## What this is

**JMLP** (Jihomoravský lyžařský pohár, South Moravian Ski Cup) — the production system of a Czech series of
alpine ski races for children and youth: public website, online registration, admin back office and an
**offline-first timekeeper** used on the hill on race day. The cup has run since 2006, so the database
carries legacy records and a legacy schema (`fuj_jmlp_*` tables).

| Layer | Stack | Rules |
|---|---|---|
| Backend | FastAPI 0.110, SQLAlchemy 2 (raw SQL), MySQL 8 / MyISAM | [backend/AGENTS.md](backend/AGENTS.md) |
| Frontend | React 18, Vite 5, React Router 6, CSS Modules kit "Modrá stopa" | [frontend/AGENTS.md](frontend/AGENTS.md) |
| Offline timekeeper | IndexedDB (Dexie), sync queue, service worker | [frontend/src/offline/AGENTS.md](frontend/src/offline/AGENTS.md) |
| Harness | session state, verification loop, guards, agents | [harness/](harness/), [CLAUDE.md](CLAUDE.md) |

Product language is **Czech** (UI copy, domain terms, much of the code's comments and test names).
Agent-facing documentation is English. Keep Czech domain terms as they are in code (ročník = edition,
startovka = start list, časomíra = timekeeper, propozice = race notice, kategorie = age category).

## Commands

| Purpose | Command | Time |
|---|---|---|
| Start a session (briefing, deps) | `harness/init.sh` | ~5 s |
| Verify changed files | `harness/verify.sh fast` | 10 s – 1 min |
| Verify everything (before commit/PR) | `harness/verify.sh full` | ~8 min |
| Backend tests only (throwaway MySQL) | `harness/lib/backend-tests.sh [-k expr] [-x]` | ~2.5 min full |
| Frontend tests for given files | `cd frontend && npx vitest related --run <files>` | seconds |
| Frontend style rules | `cd frontend && npm run check:styles` | <1 s |
| Format (the PostToolUse hook does it per file) | `cd frontend && npm run format`, `harness/lib/ruff.sh format .` | seconds |
| Harness self-test | `harness/tests/run.sh` | ~2 s |

Backend tests never run against a shared database: `backend-tests.sh` starts its own MySQL on a private
Docker network with data in RAM. No running app stack is needed to test anything.

## Session protocol

Long tasks span many sessions and context windows. State lives in files, not in the conversation.

1. **Start**: `harness/init.sh` (the SessionStart hook prints the same briefing). Read the top entry of
   [harness/progress.md](harness/progress.md).
2. **Pick one feature** from [harness/features.json](harness/features.json) — failing first, then
   unverified, then todo — or the one you were asked for. One feature per unit of work.
3. **Plan** in numbered steps, each with its verification (`/next` does this). Ask first where listed below.
4. **Work in small steps**: test first when behaviour changes, then the smallest change that passes. The
   PostToolUse hook lints each file you write; fix what it reports immediately.
5. **Verify**: `harness/verify.sh fast` after each step, `full` before a commit. The Stop hook will not let a
   turn end on changed, unverified code.
6. **Checkpoint** (`/checkpoint`): update the feature's `status` with evidence, prepend a progress entry,
   commit. Do this before the context fills up, not after.

## Definition of done

- The feature's acceptance criteria hold and its checks ran green **in this session**.
- `harness/verify.sh full` passes; no test was deleted, skipped or weakened to get there.
- New behaviour has a test that fails without the change.
- Reviewers ran for the touched area (`/review`): code-reviewer always, offline-auditor for the timekeeper,
  design-reviewer for UI. No open blockers.
- `features.json` and `progress.md` updated; one focused Conventional Commit in English.

## Guardrails

Enforced by `.claude/settings.json` (permissions) and `.claude/hooks/guard_bash.py`
(rules in `guard-rules.json`, tested by `harness/tests/run.sh`). Other agents: treat them as binding too.

**Never**
- Touch production: its compose file, deploy/backup/sync scripts, servers over SSH, its database.
- Run tests or queries against a shared database. The shared test environment holds a **copy of production
  data, including personal data of children** — never copy names, birth dates or contacts into code,
  fixtures, logs, commits or reports.
- Read secrets (`secret/`, `.env`), print the environment, or commit credentials. Use `*.example` files.
- Force-push, push to `main`, rewrite published history, or bypass git hooks.
- Weaken a check to make it pass: delete tests, add skips, loosen assertions, raise style baselines.

**Ask first**
- Database schema changes (new migration), auth/role rules, public URLs, the offline sync protocol.
- New dependencies (npm, pip, Docker images).
- Changes to the harness guards themselves (`.claude/settings.json`, `.claude/hooks/`, `harness/lib/`).
- Anything that would change production data or behaviour on race day.

## Where knowledge lives

- The nested AGENTS.md files — architecture, decisions and their reasons, next to the code they govern.
  When you make a decision a future agent could undo, write the rule and its reason there.
- `.claude/rules/` — code style: `code-style.md` (all code), `python.md`, `react.md`, `tests.md`.
  Claude Code loads them by path; other agents read them before editing.
- `frontend/src/styles/ms/tokens.css` and the kit catalogue `/__ms` (dev) — the design system in code.
- `deploy/` — how the test and production environments are set up (human-operated).
- `CLAUDE.local.md` (gitignored, per machine) — server names, URLs and local quirks. Never commit them here.

Keep this file short. Add a rule here only if an agent got it wrong without it; put everything else where
it is needed (nested AGENTS.md, docs, ADRs).
