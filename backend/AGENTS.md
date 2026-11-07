# backend/AGENTS.md

FastAPI app in `app/`. Read the root [AGENTS.md](../AGENTS.md) first; this file adds backend rules.

## Layout

- `app/main.py` — app init, router registration, runs migrations on startup.
- `app/routers/` — public endpoints at the top level (`races.py`, `registration.py`, `posts.py`, …);
  `admin/` (every sub-router depends on `require_role("admin")`, see `admin/__init__.py`);
  `timekeeper/` (accepts roles `admin` and `timekeeper`; mutations are idempotent, see `idempotency.py`).
- `app/services/` — domain logic shared by routers (seasons, standings, start list, naming, files, SLČR/FIS export).
  Put new logic here, not in routers.
- `app/models.py` — SQLAlchemy models (mostly for typing and a few ORM uses), `app/schemas.py` — Pydantic models.
- `app/migrations.py` — idempotent startup migrations. `app/utils.py` — season helpers, `fix_encoding()`.
- `app/tests/` — pytest against real MySQL; `schema.sql` is the production schema without data.

## Rules

- **Raw SQL with bound parameters.** Routers use `db.execute(text("… WHERE id = :id"), {"id": …})`.
  Never build SQL with f-strings or `%` from request data. Identifiers that must be dynamic come from a
  fixed allow-list in code.
- **MyISAM: no foreign keys, no transactions.** Do not add `ForeignKey(...)`; multi-row invariants are kept
  by single statements (e.g. `UPDATE … SET is_current = (id = :id)`) or by ordering writes so a partial
  failure is harmless.
- **Booleans** in models use `BitBoolean` (MySQL `BIT(1)`), never `Boolean`.
- **Legacy text**: old rows may be double-encoded UTF-8; read them through `fix_encoding()`. New text
  columns are explicitly `utf8mb4` and are read without it.
- **Seasons**: a season runs 1 Aug – 31 Jul and its id is the **starting** year. "The current season" is
  `services/seasons.current_season_id(db)` (flagged season, date fallback). `get_current_season_id(date)`
  is only for converting a date.
- **Schema changes** (ask first): add an idempotent `_m_<name>(conn)` to `migrations.py` that checks
  `INFORMATION_SCHEMA` before acting, append it to the migration list, and update `app/tests/schema.sql`
  so the tests see the same schema. Migrations run in every worker under a MySQL named lock.
- **Auth**: one JWT for admin and timekeeper. Every new
  admin route lives under `routers/admin/` so it inherits the role check; public routes must filter
  unpublished records (posts, attachments): a draft must not be reachable by id. Add a test for it.
- **Timekeeper mutations** accept `X-Idempotency-Key` and must return the stored response on replay;
  start-list writes carry `base_revision` and answer 409 on a stale revision. Never drop either.

## Tests

- Run: `harness/lib/backend-tests.sh` (all) or with pytest args, e.g. `-k start_list -x`.
- The fixture refuses to run unless the database name starts with `jmlpcz_test` — do not change that guard.
- Test names and docstrings are Czech by convention; keep the style of the file you edit.
- New endpoint → at least: happy path, auth (401/403), validation (422), and the not-found case.
  Use the `client`, `db`, `admin_headers` and `timekeeper_headers` fixtures from `conftest.py`.
