---
name: checkpoint
description: Close a unit of work — run the verification loop, update features.json and progress.md with evidence, and commit. Use at the end of a feature, before a context window fills up, or before handing off.
disable-model-invocation: true
argument-hint: "[fast|full] (default: full)"
---

Close the current unit of work so the next session (or context window) can continue from facts, not memory.

1. `git status --porcelain` and `git diff --stat`. Make sure every change belongs to the current feature; anything unrelated goes into a separate commit or is reverted after asking.
2. Run `harness/verify.sh ${ARGUMENTS:-full}`. On failure: fix and rerun. Never edit or skip a test to get green; if a failing test looks wrong, stop and explain why.
3. If the change touched the offline layer or timekeeper, run the `offline-auditor` agent; if it touched UI, the `design-reviewer`; always the `code-reviewer` for code changes. Fix blockers and majors, list minors in the progress note.
4. Update `harness/features.json` for the feature(s) worked on: `status` (only `passing` if its checks ran green in this session), `verified.at` (today) and `verified.by` (the command). Add or update checks paths if you added tests.
5. Prepend an entry to `harness/progress.md` using its template: done, verified (command → result), next, blocked/decisions. Keep it under 10 lines.
6. Commit with a Conventional Commit message in English (`feat(timekeeper): …`, `fix(api): …`, `chore(harness): …`), body = why, not what; end with the attribution trailer configured for this environment. Do not push unless asked.
7. Report: commit hash, verify result, review verdicts, and the next feature from the briefing.
