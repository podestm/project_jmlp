# Code style — all code

Binding for new and changed code. Existing code is not rewritten just to match; when you change a
unit (function, component), bring that unit in line.

## Language

- **Identifiers are English**: variables, functions, classes, files, folders, test names, branch names.
- **Czech** only where people read it as Czech: UI copy, user-facing error messages, comments, docstrings.
- Domain terms use one English word each, everywhere: race, season, edition (ročník), round (kolo),
  category (kategorie), racer, club, registration, start list (startovka), run (1./2. kolo), bib
  (startovní číslo), timekeeper (časomíra), race notice (propozice), results, standings.
  Database names (`fuj_jmlp_*`, legacy columns) stay as they are; translate at the boundary.

## Names

- A name says what the thing is or does, not how: `registeredRacers`, not `list2`; `closeRegistration()`,
  not `handle()`.
- Functions start with a verb (`computeStandings`, `load_start_list`); booleans read as a question
  (`isOpen`, `has_results`, `canEdit`).
- No abbreviations except universal ones (`id`, `url`, `db`, `api`, `pdf`). Units in the name when not
  obvious: `timeoutMs`, `size_bytes`.

## Comments

- Czech. A comment explains **why**: a constraint, a non-obvious decision, the bug that made the code
  necessary. The code says what; never restate it.
- No commented-out code, no change logs in comments (git has them).
- `TODO` only with a feature id from `harness/features.json`: `# TODO(HAR-04): …`.

## Functions and modules

- One job per function. Prefer early returns over nesting; more than 3 levels of nesting is a signal
  to split.
- Pure where possible: same input → same output, side effects at the edges (HTTP, DB, storage, DOM).
- More than 3 parameters → an options object (JS) or keyword-only arguments (Python).
- No speculative abstraction: no option, layer or helper "for later". Three similar lines beat a
  premature helper.
- Delete what your change made unused (imports, functions, CSS, files). Do not delete unrelated dead
  code; mention it.

## Errors

- Never swallow an error. Catch only where you can handle it; otherwise let it reach the boundary
  (router, error boundary, sync queue) that turns it into a response or a message.
- User-facing messages are Czech and say what happened and what to do („Vyplňte rok narození ve tvaru 2015.“).
- Logs carry context (ids, counts), never personal data (names, birth dates, e-mails, phone numbers).

## Formatting

- Formatting is the tools' job (Prettier for the frontend, Ruff for the backend); do not hand-format
  or argue about whitespace. Line length 100.
- Never mix reformatting with logic changes in one commit.

## Commits

- Conventional Commits in English: `type(scope): summary` (`feat`, `fix`, `refactor`, `test`, `docs`,
  `chore`, `ci`). The body explains why, not what.
- One logical change per commit; each commit passes `harness/verify.sh fast`.
