@AGENTS.md

# Claude Code specifics

Everything in AGENTS.md applies. This part covers what only Claude Code provides here.

## What runs automatically (`.claude/settings.json`)

| Hook | What it does | When it bites |
|---|---|---|
| SessionStart → `stop_verify.py start` | Prints the session briefing (`harness/init.sh --brief`), remembers the starting tree | every session, also after `/clear` and compaction |
| PreToolUse Bash → `guard_bash.py` | Blocks production, shared-data, secret and history-destroying commands (rules: `.claude/hooks/guard-rules.json`) | the reason is shown to you; do not work around it, ask |
| PostToolUse Edit/Write → `post_edit.py` | Syntax check (Python), eslint (JS/JSX), style rules (CSS/JSX) for the file just written | fix the reported problem before the next step |
| Stop → `stop_verify.py stop` | Refuses to end a turn on changed code that has not passed `harness/verify.sh` | run verify, or state clearly why it cannot run |

Permissions: harness scripts, git read/commit, eslint and vitest are pre-approved; push, installs,
`docker exec/run` and edits to the guards ask; secrets and the production compose file are denied.

## Workflow skills

- `/next [feature|task]` — briefing → pick one feature → plan with a verification per step.
- `/checkpoint [fast|full]` — verify → reviewers → update features.json + progress.md → commit.
- `/review [range]` — run the reviewer agents in parallel, confirm findings, one ranked list.
- Model-invoked skills: `karpathy-guidelines` (coding discipline), `frontend-design` (subordinate to Modrá stopa).

## Subagents (`.claude/agents/`)

| Agent | Use for | Tools |
|---|---|---|
| `code-reviewer` | every code change before a checkpoint | read-only + git |
| `offline-auditor` | anything touching `src/offline`, `config/api.js`, `components/timekeeper`, `routers/timekeeper` | read-only + git |
| `design-reviewer` | `.jsx` / `.module.css` changes | read-only + style check |
| `browser-verifier` | a feature's `e2e` steps or a UI bug, in a real headless browser | Playwright MCP, never production |

Delegate broad exploration to a subagent and keep its summary; keep the main context for decisions and edits.
Run independent reviewers in parallel.

## Context and long sessions

- The files are the memory: `harness/features.json` (what), `harness/progress.md` (where we are), git (how).
  Before a long task risks compaction, `/checkpoint` — a summary loses detail, these files do not.
- After compaction or `/clear`, re-read the briefing and the top progress entry before continuing.
- Prefer `npx vitest related` and `backend-tests.sh -k …` over full suites while iterating; full suites before commit.

## MCP

`.mcp.json` provides `playwright` (headless Chromium via `.playwright/mcp.config.json`; production origin
blocked; artefacts in `.playwright/output/`, gitignored). Use it through the `browser-verifier` agent.

## Local notes

Machine-specific facts (server names, environment URLs, container names, local quirks) live in
`CLAUDE.local.md`, which is gitignored and loaded automatically when present. Never move them into tracked files.
