---
paths:
  - "backend/**/*.py"
---

# Code style — Python (backend)

Python 3.11. Formatting and linting: Ruff, line length 100, rule sets `E, F, I, B, UP, SIM`.
Project rules (raw SQL, MyISAM, seasons, migrations) are in `backend/AGENTS.md`; this file is style.

## Types

- Every new or changed **public** function (no leading `_`) in `app/` has types for all parameters
  and the return value. Private helpers: when it helps the reader.
- Modern syntax: `list[int]`, `dict[str, Any]`, `X | None`; no `typing.List`, `Optional`.
- Request and response bodies are Pydantic models in `app/schemas.py`, not loose dicts.

## Structure

- **Router** = HTTP only: parse input, check role, call a service, choose the status code.
  **Service** (`app/services/`) = domain logic, no FastAPI imports, testable without HTTP.
- `HTTPException` is raised only in routers. Services raise `ValueError` or a domain exception the
  router maps to a status code.
- No `print`; use `logger = logging.getLogger(__name__)`.

## SQL

- `text()` with bound parameters only. A dynamic identifier (table, column, ORDER BY) comes from a
  constant allow-list in the same module, never from input.
- Name the columns you need; no `SELECT *`.
- Multi-line SQL in a triple-quoted string, keywords uppercase, one clause per line.

## Naming

- `snake_case` functions and variables, `PascalCase` classes, `UPPER_SNAKE` module constants,
  leading `_` for module-private helpers.
- Dates as `date` / `datetime` objects inside the code; strings only at the edges (JSON, SQL params).

## Errors

- No bare `except:`. `except Exception` only at a boundary, with `logger.exception(...)` and a
  meaningful response.
- Do not return `None` to signal an error; raise.

## Docstrings

- Czech, for public functions whose contract or reason is not obvious from the name and types.
  First line: one sentence; then the why, the edge cases, the units.
