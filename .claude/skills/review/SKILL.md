---
name: review
description: Review the current change with the project's reviewer agents in parallel and merge their findings into one ranked list.
disable-model-invocation: true
argument-hint: "[git range or paths] (default: origin/main...HEAD + uncommitted)"
---

Review `$ARGUMENTS` (default: everything on this branch since `origin/main`, plus uncommitted changes).

1. `git diff --stat` for the range to see which areas changed.
2. Launch in parallel, each with the range and the list of changed files:
   - `code-reviewer` — always, for code changes.
   - `offline-auditor` — if anything under `frontend/src/offline/`, `frontend/src/config/api.js`, `frontend/src/components/timekeeper/` or `backend/app/routers/timekeeper/` changed.
   - `design-reviewer` — if `.jsx` or `.module.css` under `frontend/src/` changed.
3. Verify before reporting: for each blocker or major, open the cited lines yourself and confirm the failure scenario is real. Drop findings you cannot confirm, or mark them `unconfirmed`.
4. Output one list ranked by severity (`[severity] path:line — problem — fix — source agent`), then the combined verdict. Do not fix anything unless asked.
