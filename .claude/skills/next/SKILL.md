---
name: next
description: Start a unit of work — read the session state, pick one feature from harness/features.json (or the one given), and produce a short verified plan before writing code.
disable-model-invocation: true
argument-hint: "[feature id or task description]"
---

Start a unit of work. Argument: `$ARGUMENTS` (a feature id like `TK-03`, a task description, or empty).

1. Run `harness/init.sh` and read its briefing. If the tree is dirty with work that is not yours, stop and ask what to do with it.
2. Choose the work:
   - Feature id given → that feature.
   - Task description given → find the feature it belongs to; if none fits, propose a new entry (id, area, title, acceptance, checks) and ask before adding it.
   - Nothing given → the first non-passing feature in briefing order (failing → unverified → todo).
3. Read the AGENTS.md files for the paths you will touch. For UI, the design rules in `frontend/AGENTS.md`. For the timekeeper, `frontend/src/offline/AGENTS.md`.
4. Explore only as much code as the plan needs. For broad searches, delegate to an Explore subagent and keep its summary, not the file dumps.
5. Write the plan in this form and show it:

```
Feature: <id> <title>
Goal: <one sentence, user-visible>
Assumptions: <what you are taking as given; ask if any is doubtful>
Steps:
1. <change> → verify: <test or command that proves it>
2. ...
Out of scope: <what you will not touch>
Risks: <data, offline, auth, production>
```

6. Wait for approval if the plan changes a database schema, an auth rule, the offline layer, a public URL, or anything listed under "Ask first" in AGENTS.md. Otherwise start with step 1, test first where behaviour changes.
