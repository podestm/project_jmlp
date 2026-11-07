# frontend/src/offline/AGENTS.md

The timekeeper runs on race day on a hill with weak signal, a hotspot without data, or timing Wi-Fi without
internet. A lost or duplicated time is a wrong result for a child's race. Changes here are reviewed by the
`offline-auditor` agent and need approval when they change the sync protocol.

## Invariants (non-negotiable)

1. All core functionality works offline: race detail, start list, entering times, late entries, results.
2. Online ↔ offline transitions are seamless; the operator never has to do anything.
3. No data loss: a typed or measured time survives reload, tab crash, logout and screen switch.
4. Auto-sync when the server is reachable; queued changes replay in order, exactly once.
5. Manual backup: export/import of all local data, including unconfirmed timing-device events.

## How the layer is built

| Module | Responsibility |
|---|---|
| `db.js` | Dexie database. Schema changes add `version(N)`; never edit an existing version. |
| `../config/api.js` (`TimekeeperAPI`) | Reads: network → cache in IndexedDB; offline: from cache. Every mutation goes through the queue. |
| `syncQueue.js`, `sync.js` | Ordered queue, exponential backoff, max 8 retries, 10 s interval, orphaned `processing` items recovered after reload. Each item carries an `X-Idempotency-Key`. |
| `connectivity.js` | Online = the server is actually reachable, not `navigator.onLine`. |
| `localEdits.js`, `entryTargets.js` | Start-list rows have revisions; writes send `base_revision`; a stale write gets 409 and is parked as a conflict. `entryTargets.js` is the single place that says which rows a mutation touches. |
| `offlineEntries.js` | Late entries added offline get a temporary negative id (`client_temp_id`), remapped after sync. |
| `racerRegistry.js` | Compact local copy of the racer registry for offline search. |
| `racePreload.js` | Caches everything for the selected race right after selection, not on first screen visit. |
| `timingDrafts.js` | Values typed but not yet blurred, per race. |
| `bridgeInbox.js` | Durable inbox of timing-device events until they are confirmed to a bib. |
| `backup.js` | Export/import. **Every new table holding race data must be added here.** |
| `useSyncStatus.js` | Sync status for the UI. |

App shell caching: `public/sw.js` — bump `CACHE_NAME` when the shell changes.

## Working here

- Write the failure-path test first (server unreachable, 409, retry exhausted, reload mid-sync), then the change.
  `fake-indexeddb` is available in tests.
- Keep state that must survive in IndexedDB, never only in React state.
- Run `npx vitest related --run src/offline/<file>.js` while working; `harness/verify.sh full` before a commit.
- Browser-level offline scenarios are not automated yet (feature HAR-04); until then describe the manual
  DevTools check you performed in the progress entry.
