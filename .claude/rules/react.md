---
paths:
  - "frontend/**/*.js"
  - "frontend/**/*.jsx"
---

# Code style — JavaScript and React (frontend)

Formatting: Prettier (`singleQuote`, `semi`, `printWidth: 100`, `trailingComma: "all"`).
Correctness: ESLint (`npx eslint`). UI and design-system rules are in `frontend/AGENTS.md`; this file is
code style.

## Modules

- **Named exports only**: `export function RaceRow()`, `export const formatTime = …`. Default export
  only where a tool requires it (`React.lazy`, config files).
- One exported component per file; the file is named after it (`RaceRow.jsx`), in its own folder
  with `RaceRow.module.css` and `RaceRow.test.jsx`.
- Import order: packages, then project modules, then styles; no unused imports.

## Components

- Function components. Props are destructured in the signature, with defaults there:
  `function Badge({ tone = 'neutral', children })`.
- A component renders; decisions (filters, formatting, rules) live in pure functions in `utils/`,
  the page's own module (`raceCalendar.js`) or a hook — and are tested there.
- Props passed through more than two levels → a hook or context instead.
- Event handler props are `onX` (`onSelect`); the functions passed to them are `handleX`.

## State and effects

- Keep the minimum state; anything computable from props or state is computed during render
  (`useMemo` only when measurably expensive).
- `useEffect` is for synchronising with something outside React (network, storage, timers, DOM APIs),
  never for deriving state. Every effect cleans up what it starts.
- Server data goes through the API clients in `config/api.js`; timekeeper data through
  `TimekeeperAPI` (offline rules in `src/offline/AGENTS.md`).

## Naming

- `camelCase` variables and functions, `PascalCase` components, `UPPER_SNAKE` constants,
  hooks start with `use`.
- UI strings are Czech and complete sentences in one template literal — no sentence assembled from
  fragments (`` `Na sněhu ${n} závodů` ``, not `'Na sněhu ' + n + ' závodů'`).

## Documentation

- JSDoc (Czech) on exported utilities and hooks whose parameters or return value are not obvious from
  the names: units, allowed values, what `null` means.
