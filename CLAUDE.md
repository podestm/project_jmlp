# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JMLP (Jihomoravský lyžařský pohár) — management system for a Czech series of alpine ski races. Handles race scheduling, participant registration, race timing with offline support, and results tracking.

**Production URL**: https://jmlp.cz (server 178.105.133.222, code in `/opt/jmlp`)
**Test URL**: https://podm12.com — test replica (clone) of production, code and data; server 178.105.130.22, this checkout `/opt/jmlp_web_v1`

## Stack

- **Frontend**: React 18 + Vite 5, React Router 6, Bootstrap 5
- **Backend**: FastAPI 0.110 + SQLAlchemy 2.0 (raw SQL preferred over ORM queries)
- **Database**: MySQL 8.0 with MyISAM engine (legacy compatibility — no FK constraints)
- **Infrastructure**: Docker Compose, Nginx with TLS

## Development Commands

```bash
# Start full stack (dev)
docker compose up --build

# Rebuild individual services
./rebuild.sh frontend    # Frontend only
./rebuild.sh backend     # Backend only
./rebuild.sh db          # Database only (DESTRUCTIVE — wipes data)
./rebuild.sh             # All services

# Dev URLs
# Frontend:  http://localhost:3000
# API docs:  http://localhost:8000/docs
# Admin UI:  http://localhost:3000/admin
# MySQL:     localhost:3307
```

```bash
# Production deployment
docker compose -f docker-compose.server.yml build
docker compose -f docker-compose.server.yml up -d
```

The `.env` file is a symlink to `secret/.env` (created automatically by `rebuild.sh`). Create `secret/.env` from the required vars before first run.

## Architecture

### Services

```
Frontend (React + Nginx)  ←→  Backend (FastAPI)  ←→  MySQL 8.0
   :3000 / :8080              :8000                    :3307
                                   ↓
                          /app/uploads/documents/
                          (Docker volume: documents_data)
```

### Backend structure (`/backend/app/`)

- `main.py` — App init, router registration
- `models.py` — 12 SQLAlchemy models (MyISAM, BitBoolean custom type for BIT(1) columns)
- `schemas.py` — Pydantic request/response models
- `auth.py` — JWT creation/verification + password hashing (werkzeug/bcrypt)
- `utils.py` — Season logic, `fix_encoding()` for legacy double-encoded Czech strings
- `routers/admin/` — 12 sub-routers for admin features (JWT protected)
- `routers/timekeeper/` — 7 sub-routers for race timing (separate JWT)
- `routers/public/` — Unauthenticated public endpoints

### Frontend structure (`/frontend/src/`)

- `Router.jsx` — All route definitions (public, admin, timekeeper)
- `config/api.js` — Three API clients: `API` (public), `AdminAPI` (JWT), `TimekeeperAPI` (offline-first JWT)
- `config/AuthContext.jsx` — Admin auth context
- `config/TimekeeperAuthContext.jsx` — Timekeeper auth context
- `offline/` — IndexedDB offline support via Dexie.js
- `components/` — Organized by page/feature area

### Key architectural patterns

**One shared login for admin and timekeeper** (since 2026-10-03): both login endpoints (`/api/admin/auth/login` accepts role `admin` only, `/api/timekeeper/auth/login` accepts `admin` and `timekeeper`) issue the same JWT, and the frontend keeps it under one `localStorage` key (`auth_token`, see `frontend/src/config/session.js`). A login in either section covers both, and logout clears both. Role is enforced by the backend (`require_role("admin")` on every admin sub-router) and by the admin auth context, which refuses timekeeper-role accounts without logging them out of the timekeeper. Token lifetime is `ACCESS_TOKEN_EXPIRE_MINUTES` (720 = 12 h in production).

**Raw SQL over ORM**: Most backend routers use `db.execute(text(...))` directly rather than SQLAlchemy ORM queries. This was intentional for performance and to avoid encoding issues with Czech characters.

**MyISAM + no FK constraints**: All tables use MyISAM engine. Do not add `ForeignKey` constraints to models — they won't be enforced and can cause migration issues.

**Season logic**: Seasons run Aug 1 – Jul 31. Use `get_current_season_id(date)` from `utils.py`. `season_id` is the season's **starting** year: if date >= Aug 1, season = current_year; otherwise season = current_year - 1 (e.g. season 2025 = 1. 8. 2025 – 31. 7. 2026). Season metadata (edition, name) lives in `fuj_jmlp_season`.

**`fix_encoding()` utility**: Legacy data may have double-encoded UTF-8. Use this helper when reading racer names, club names, etc. from older records.

**BitBoolean**: Custom SQLAlchemy type in `models.py` for MySQL `BIT(1)` columns. Use it (not `Boolean`) for any boolean field in models.

### Offline-first Timekeeper module

The timekeeper feature is designed for race-day use with unreliable connectivity:

- `TimekeeperAPI` (in `config/api.js`) queues mutations when offline using IndexedDB (Dexie)
- Offline queue retries with exponential backoff, max 8 retries, 10s sync interval
- Each mutation carries an `X-Idempotency-Key` header — backend must de-duplicate
- Cached data: race lists, start list entries, timing data per race

### File uploads

Files stored on `documents_data` Docker volume at `/app/uploads/documents/`. UUID filenames are used. Metadata tracked in `fuj_jmlp_files` table with `file_type` enum: `document`, `image`, `propozice`, `vysledky`, `posty`, `neprirazene`.

## Database Table Naming

All tables are prefixed `fuj_jmlp_`. Key tables:
- `fuj_jmlp_racer`, `fuj_jmlp_club`, `fuj_jmlp_category`, `fuj_jmlp_areal`
- `fuj_jmlp_race`, `fuj_jmlp_race_registration`
- `fuj_jmlp_admin` (role: `admin` or `timekeeper`)
- `fuj_jmlp_start_list` (timing: time1, time2, dnf, dns, dsq flags)
- `fuj_jmlp_race_numbers` (bib numbers with set_color)
- `fuj_jmlp_posts`, `fuj_jmlp_files`, `fuj_jmlp_season_results`

## Environment Variables

Key variables in `secret/.env`:

```
DATABASE_URL=mysql+pymysql://app:app@db:3306/jmlpcz?charset=utf8mb4
SECRET_KEY=<min 32 chars>
CORS_ORIGINS=http://localhost:3000,...
ACCESS_TOKEN_EXPIRE_MINUTES=720
MYSQL_ROOT_PASSWORD=<min 16 chars>
MYSQL_PASSWORD=<min 16 chars>
VITE_API_BASE=http://localhost:8000
```

## Vite Dev Proxy

In dev, Vite proxies `/api/*` and public resource paths (`/races`, `/racers`, `/clubs`, etc.) to `http://backend:8000`. See `vite.config.js` for the full proxy map.