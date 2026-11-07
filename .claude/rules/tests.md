---
paths:
  - "backend/app/tests/**/*.py"
  - "frontend/**/*.test.js"
  - "frontend/**/*.test.jsx"
---

# Code style — tests

## Names

- English sentences that state the behaviour, readable as a specification:
  - Python: `test_closed_registration_rejects_a_new_racer`
  - JS: `it('rejects a new racer when registration is closed')`, inside `describe('<unit>')`.
- Existing Czech test names stay until that test is changed for another reason; no mass renaming.

## Shape

- One behaviour per test, Arrange → Act → Assert, separated by a blank line when longer than a few lines.
- Test through the public interface: HTTP endpoints (backend), roles and visible text with Testing
  Library (frontend). Not private functions, CSS classes or component internals.
- Every bug fix starts with a test that fails without the fix.
- New endpoint: happy path, auth (401/403), validation (422), not found (404).

## Data

- Only invented data: `example.com` / `test.cz` addresses, made-up names. Never copy real racers,
  clubs' contacts or results from the test environment.
- Build data with the fixtures and small factory helpers in the test module; no shared mutable state
  between tests.

## Reliability

- No `sleep` and no real time: freeze or fake time (`vi.useFakeTimers()`, a fixed `date` argument).
- No network; backend tests use the throwaway MySQL (`harness/lib/backend-tests.sh`), frontend tests
  mock `fetch`.
- Never weaken a test to make it pass. Changing an assertion needs a changed requirement, named in the
  commit message.
