// Durable inbox of timing-device events.
//
// An event that arrived from the časomíra but has not been confirmed to a bib
// yet is a measured time nobody has written down. It used to live in React
// state on the timing screen only, so a reload, a jump to another timekeeper
// screen, a logout or a tab crash threw it away. It lives in IndexedDB now and
// is only ever removed when the operator explicitly clears it - never on sync,
// never on a timer.
//
// Events are NOT attributed to a race when they arrive. The device feed is
// global: it knows nothing about which race the operator happens to have
// selected on some other screen, and reading that selection at arrival time
// used to file measured times into buckets no screen could ever display. A row
// gets its `race_id` at exactly one moment - when the operator confirms it to a
// bib, which implies the race.

import { timekeeperDb } from './db.js';

/** Dispatched on window after every insert/update/delete, so the UI can refresh without polling. */
export const INBOX_EVENT = 'timekeeper-bridge-inbox-changed';

/**
 * Bumped in localStorage on every change. `window.dispatchEvent` does not cross
 * tabs, and two timekeeper tabs are an explicitly supported setup: without this
 * the tab holding the timing write lock never learns that the tab holding the
 * serial port has just stored an impulse.
 */
export const INBOX_REV_KEY = 'timekeeper_bridge_inbox_rev';

/** A row left in 'saving' longer than this was orphaned by a reload or a crash. */
export const SAVING_STALE_MS = 60000;

const nowIso = () => new Date().toISOString();

const randomId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Races are positive numeric ids; `null` means "not attributed to a race yet".
 * IndexedDB does not index null, which is fine: unassigned rows are found by a
 * scan (see listInboxEvents) and are always shown, never filtered away.
 */
export const normalizeRaceId = (raceId) => {
  const value = Number(raceId);
  return Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * Row statuses.
 *
 *   pending      - stored, not confirmed to a bib yet
 *   warning      - stored, something is wrong with it (unparsed line, bib not in
 *                  the start list, duplicate impulse, ...). STILL an unrecorded
 *                  measured time.
 *   saving       - a write to the server is in flight
 *   queued       - the write went into the offline sync queue and has not
 *                  reached the server yet
 *   saved        - written to the server (queue op done, or written online)
 *   save_failed  - the write failed / the queued op died
 *   rejected     - the operator explicitly threw it away
 */
export const INBOX_STATUS = Object.freeze({
  PENDING: 'pending',
  WARNING: 'warning',
  SAVING: 'saving',
  QUEUED: 'queued',
  SAVED: 'saved',
  SAVE_FAILED: 'save_failed',
  REJECTED: 'rejected',
});

/**
 * Is this row finished with, so that "Smazat vyřízené" may delete it?
 *
 * Deliberately narrow: a row is resolved ONLY when the operator threw it away,
 * or when it was written AND the write actually reached the server. Everything
 * else - pending, warning, saving, queued, save_failed - is a measured time
 * that exists nowhere else and must survive a bulk delete.
 */
export const isResolvedInboxEvent = (row) => {
  if (!row) return false;
  if (row.status === INBOX_STATUS.REJECTED) return true;
  if (row.status !== INBOX_STATUS.SAVED) return false;
  // A 'saved' row still carrying a queue op has not landed on the server yet.
  return !row.sync_op_id && !row.sync_queue_id;
};

/** Anything that is not resolved: never trimmed, never bulk-deleted. */
export const isLiveInboxEvent = (row) => !isResolvedInboxEvent(row);

/**
 * Stable identity of one physical impulse.
 *
 * The LIP device numbers every line it emits, so `seq|bib|time` survives a
 * reconnect that replays the tail of the device buffer. There is deliberately
 * no race id in the key any more - the feed is global. Without a sequence
 * number (the `TIME;DRES;MM:SS.hh` simulator form, and every unparsed line)
 * there is nothing to dedup on and a random suffix keeps two genuinely separate
 * impulses apart - dropping a real second run would be far worse than showing
 * one duplicate.
 */
export const buildOpKey = (event = {}) => {
  const seq = event.seq;
  const bib = event.bib ?? '';
  const time = event.time ?? '';
  if (seq === null || seq === undefined || seq === '') {
    return `|${bib}|${time}|${randomId()}`;
  }
  return `${seq}|${bib}|${time}`;
};

const notifyInboxChanged = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(INBOX_REV_KEY, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  } catch {
    // private mode / quota - the same-tab event below still works
  }
  window.dispatchEvent(new CustomEvent(INBOX_EVENT));
};

/**
 * Store one device event, unassigned to any race.
 *
 * Deduplicated on `op_key`, so replaying the same impulse after a reconnect
 * returns the row that is already there (with whatever status the operator has
 * given it) instead of resurrecting it.
 *
 * Throws when IndexedDB is unavailable - the caller must surface that, never
 * swallow it: a swallowed write here is a lost measured time.
 *
 * @param {Object} event
 * @returns {Promise<Object>} the stored row
 */
export const appendInboxEvent = async (event = {}) => {
  const op_key = event.op_key || buildOpKey(event);
  const timestamp = nowIso();
  let inserted = false;

  const row = await timekeeperDb.transaction('rw', timekeeperDb.bridgeInbox, async () => {
    const existing = await timekeeperDb.bridgeInbox.where('op_key').equals(op_key).first();
    if (existing) return existing;

    const draft = {
      // null until the operator confirms the row to a bib.
      race_id: normalizeRaceId(event.race_id),
      op_key,
      status: event.status || INBOX_STATUS.PENDING,
      level: event.level || 'info',
      type: event.type || 'UNKNOWN',
      bib: event.bib ?? null,
      time: event.time ?? null,
      seq: event.seq ?? null,
      raw: event.raw ?? null,
      targetRound: event.targetRound ?? null,
      // null means "not matched against a start list yet"; an array means matched.
      // A no-hit row keeps null on purpose, so the matcher can try again once the
      // bib finally appears in the start list.
      candidateEntryIds: event.candidateEntryIds ?? null,
      selectedEntryId: event.selectedEntryId ?? null,
      racer: event.racer ?? null,
      reason: event.reason ?? null,
      // Set while a write is in flight, so a crash can be detected on reload.
      saving_started_at: null,
      saving_writer_id: null,
      // Set while the write is waiting in the offline sync queue.
      sync_op_id: null,
      sync_queue_id: null,
      ts: event.ts || timestamp,
      created_at: timestamp,
      updated_at: timestamp,
    };

    const id = await timekeeperDb.bridgeInbox.add(draft);
    inserted = true;
    return { ...draft, id };
  });

  if (inserted) notifyInboxChanged();
  return row;
};

/**
 * Everything the timing screen must show for one race: rows already stamped
 * with that race plus every row that is still unassigned. Newest first.
 *
 * Sorted on the auto-increment key: insertion order is the arrival order, and
 * unlike `created_at` it cannot tie when two impulses land in the same ms.
 *
 * One cursor scan rather than an index lookup, because IndexedDB cannot index
 * the `null` that marks an unassigned row. The table holds one race day of
 * events at most, and the callers coalesce their refreshes.
 */
export const listInboxEvents = async (raceId) => {
  const race_id = normalizeRaceId(raceId);
  const rows = await timekeeperDb.bridgeInbox
    .filter((row) => row.race_id == null || Number(row.race_id) === race_id)
    .toArray();
  return rows.sort((a, b) => b.id - a.id);
};

/** How many stored rows are not attributed to any race yet. */
export const countUnassignedInboxEvents = async () =>
  timekeeperDb.bridgeInbox.filter((row) => row.race_id == null).count();

/** Patch one row (status, chosen candidate, race stamp, ...). Returns the merged row. */
export const updateInboxEvent = async (id, patch = {}) => {
  const next = await timekeeperDb.transaction('rw', timekeeperDb.bridgeInbox, async () => {
    const row = await timekeeperDb.bridgeInbox.get(id);
    if (!row) return null;
    const merged = { ...row, ...patch, id: row.id, updated_at: nowIso() };
    await timekeeperDb.bridgeInbox.put(merged);
    return merged;
  });
  if (next) notifyInboxChanged();
  return next;
};

/**
 * Apply a whole batch of background bib-matching results.
 *
 * Two rules, both non-negotiable:
 *  - one `rw` transaction and one notification for the whole batch, so matching
 *    forty rows does not fire forty full re-reads of the table;
 *  - the row is re-read inside the transaction and skipped whenever the operator
 *    has already touched it. The matcher may only fill in fields that are still
 *    unset; it must never move a candidate the operator picked, because that
 *    silently writes a measured time to the wrong racer.
 *
 * @param {Array<{id: number}>} patches
 * @returns {Promise<number>} how many rows were actually changed
 */
export const applyMatchPatches = async (patches = []) => {
  if (!Array.isArray(patches) || patches.length === 0) return 0;
  let changed = 0;

  await timekeeperDb.transaction('rw', timekeeperDb.bridgeInbox, async () => {
    for (const patch of patches) {
      if (!patch || patch.id == null) continue;
      const row = await timekeeperDb.bridgeInbox.get(patch.id);
      if (!row) continue;
      // Operator intent wins, always.
      if (row.selectedEntryId != null) continue;
      if (Array.isArray(row.candidateEntryIds)) continue;
      const parked = row.status === INBOX_STATUS.WARNING && row.reason === 'bib_not_found';
      if (row.status !== INBOX_STATUS.PENDING && !parked) continue;

      const { id, ...fields } = patch;
      await timekeeperDb.bridgeInbox.put({ ...row, ...fields, id: row.id, updated_at: nowIso() });
      changed += 1;
    }
  });

  if (changed) notifyInboxChanged();
  return changed;
};

/**
 * Return rows abandoned mid-write (the tab died between "saving" and the
 * response) to 'pending'.
 *
 * Without this the row is frozen forever: BridgeEventRow disables both buttons
 * on a 'saving' row and it is live, so it cannot be bulk-cleared either, and
 * confirmBridgeEvent early-returns on it. Re-running the confirm is safe - it
 * writes the same value and the mutation carries an idempotency key.
 *
 * MUST be re-run periodically, not only on mount: a row that is two seconds old
 * when the screen opens is a minute old a minute later, and the operator will
 * not reload again to trigger a mount-only recovery.
 *
 * @param {Object} [options]
 * @param {number} [options.orphanBefore] epoch ms of this tab's own session
 *   start. A write that began before this tab existed cannot possibly be in
 *   flight here, so it is orphaned regardless of age - that is what makes a
 *   reload two seconds into a confirm recover immediately instead of after the
 *   60 s floor.
 * @param {Set<string>} [options.liveWriters] writer ids of tabs that are alive
 *   right now. The session-start shortcut above is only sound for a write
 *   nobody is still running: a second tab opening mid-confirm used to demote
 *   the FIRST tab's genuinely in-flight row to 'pending' and announce an
 *   interrupted save that had not been interrupted. A row claimed by a live
 *   writer is only ever recovered by the plain age cutoff.
 * @returns {Promise<number>} how many rows were unfrozen
 */
export const recoverStaleSavingEvents = async ({
  orphanBefore = null,
  liveWriters = null,
} = {}) => {
  const rows = await timekeeperDb.bridgeInbox.where('status').equals(INBOX_STATUS.SAVING).toArray();
  const cutoff = Date.now() - SAVING_STALE_MS;
  const orphanCutoff = Number.isFinite(Number(orphanBefore)) ? Number(orphanBefore) : null;

  const isOrphan = (row) => {
    const started = Date.parse(row.saving_started_at || row.updated_at || '');
    if (Number.isNaN(started)) return true;
    if (started <= cutoff) return true;
    if (orphanCutoff == null || started >= orphanCutoff) return false;
    // Older than this tab's session - but is the tab that claimed it still alive?
    return !(row.saving_writer_id && liveWriters && liveWriters.has(row.saving_writer_id));
  };

  const stale = rows.filter(isOrphan);
  if (stale.length === 0) return 0;

  let unfrozen = 0;
  await timekeeperDb.transaction('rw', timekeeperDb.bridgeInbox, async () => {
    for (const row of stale) {
      // Re-read inside the transaction: an in-flight confirm may have finished
      // between the scan and here, and demoting a written row back to 'pending'
      // would invite a second write of the same time.
      const current = await timekeeperDb.bridgeInbox.get(row.id);
      if (!current || current.status !== INBOX_STATUS.SAVING) continue;
      if (current.saving_started_at !== row.saving_started_at) continue;
      await timekeeperDb.bridgeInbox.put({
        ...current,
        status: INBOX_STATUS.PENDING,
        level: 'warning',
        reason: 'saving_interrupted',
        saving_started_at: null,
        saving_writer_id: null,
        updated_at: nowIso(),
      });
      unfrozen += 1;
    }
  });

  if (unfrozen > 0) notifyInboxChanged();
  return unfrozen;
};

/**
 * Claim one inbox row for writing - compare-and-set, inside one transaction.
 *
 * Two timekeeper tabs on DIFFERENT races both hold a (per-race) write lock and
 * both render every unassigned row, so both can press the confirm button on the same physical
 * impulse. Without this the in-memory duplicate guard misses it entirely and one
 * impulse becomes two recorded results on two racers, leaving no trace.
 *
 * The race stamp is applied here, at the start of the confirmation, so the other
 * tab's list drops the row instead of offering it again.
 *
 * @returns {Promise<{ok: boolean, reason: string|null, row: Object|null}>}
 *   reason 'taken' means another tab (or this one) is already writing it.
 */
export const beginInboxEventSave = async (
  id,
  { raceId = null, selectedEntryId = null, writerId = null } = {},
) => {
  const stamp = normalizeRaceId(raceId);

  const outcome = await timekeeperDb.transaction('rw', timekeeperDb.bridgeInbox, async () => {
    const row = await timekeeperDb.bridgeInbox.get(id);
    if (!row) return { ok: false, reason: 'missing', row: null };
    if (
      row.status === INBOX_STATUS.SAVING ||
      row.status === INBOX_STATUS.QUEUED ||
      row.status === INBOX_STATUS.SAVED
    ) {
      return { ok: false, reason: 'taken', row };
    }
    if (row.race_id != null && stamp != null && Number(row.race_id) !== stamp) {
      return { ok: false, reason: 'other_race', row };
    }

    const timestamp = nowIso();
    const merged = {
      ...row,
      status: INBOX_STATUS.SAVING,
      level: 'info',
      race_id: stamp ?? row.race_id ?? null,
      selectedEntryId: selectedEntryId ?? row.selectedEntryId ?? null,
      saving_started_at: timestamp,
      // Which tab is doing the writing. A recovery pass in another tab uses it
      // to tell "abandoned by a dead tab" from "in flight somewhere else".
      saving_writer_id: writerId ?? null,
      updated_at: timestamp,
    };
    await timekeeperDb.bridgeInbox.put(merged);
    return { ok: true, reason: null, row: merged };
  });

  if (outcome.ok) notifyInboxChanged();
  return outcome;
};

const QUEUE_FAILED_STATUSES = new Set(['dead', 'conflict', 'dropped']);
// The operator wrote this entry again and that write landed, so this op was
// retired. The row is NOT an error, but it is not proof of what is on the
// server either, so it stays live rather than becoming bulk-deletable.
const QUEUE_SUPERSEDED = 'superseded';

/**
 * Derive an inbox row's state from the sync-queue op it is waiting on.
 * Returns null when nothing about the row should change.
 */
const deriveFromQueueOp = (row, op) => {
  if (!op) {
    // The queue row is gone. A 'saved' row already cleared its ids, so only a
    // row still pointing at a vanished op gets here: we cannot prove it ever
    // reached the server, so it must not become deletable as "vyřízené".
    if (row.status === INBOX_STATUS.SAVED) return null;
    return {
      status: INBOX_STATUS.SAVE_FAILED,
      level: 'danger',
      reason: 'sync_unknown',
      sync_op_id: null,
      sync_queue_id: null,
    };
  }
  if (op.status === 'done') {
    return {
      status: INBOX_STATUS.SAVED,
      level: 'success',
      reason: null,
      sync_op_id: null,
      sync_queue_id: null,
    };
  }
  if (op.status === QUEUE_SUPERSEDED) {
    return {
      status: INBOX_STATUS.SAVE_FAILED,
      level: 'warning',
      reason: 'sync_superseded',
      sync_op_id: null,
      sync_queue_id: null,
    };
  }
  if (QUEUE_FAILED_STATUSES.has(op.status)) {
    return {
      status: INBOX_STATUS.SAVE_FAILED,
      level: 'danger',
      reason: op.status === 'conflict' ? 'sync_conflict' : 'sync_failed',
    };
  }
  // pending / processing / failed-with-retries-left: still on its way. This is
  // also the path that resurrects a row after the operator retried a dead op in
  // the Sync Center - it goes back to 'queued' and can then reach 'saved'.
  return {
    status: INBOX_STATUS.QUEUED,
    level: 'info',
    reason: 'queued_offline',
  };
};

/**
 * Reconcile rows that were confirmed while offline against the sync queue.
 *
 * A confirmation that only reached the queue is NOT written down anywhere the
 * server can see, so it stays 'queued' (and therefore live and undeletable)
 * until its op reports `done`. If the op dies or conflicts, the row goes to
 * save_failed and keeps the bib, the raw line and the device sequence number -
 * everything needed to re-enter the time by hand.
 *
 * Selection is by OP IDENTITY, not by inbox status. Selecting only 'queued'
 * rows meant a row parked as save_failed could never be looked at again, so an
 * op the operator successfully retried in the Sync Center left the inbox
 * insisting the write had failed and telling them to enter the time by hand -
 * against a record that was already correct.
 *
 * @returns {Promise<{promoted: number, failed: number}>} counts of ACTUAL
 *   transitions, so a steady state reports zero and nothing is re-announced.
 */
export const reconcileQueuedInboxEvents = async () => {
  const tracked = await timekeeperDb.bridgeInbox
    .filter((row) => row.sync_queue_id != null || row.status === INBOX_STATUS.QUEUED)
    .toArray();
  if (tracked.length === 0) return { promoted: 0, failed: 0 };

  let promoted = 0;
  let failed = 0;
  let touched = 0;

  for (const row of tracked) {
    const op =
      row.sync_queue_id != null ? await timekeeperDb.syncQueue.get(row.sync_queue_id) : null;
    const patch = deriveFromQueueOp(row, op);
    if (!patch) continue;

    const changed = Object.keys(patch).some((key) => row[key] !== patch[key]);
    if (!changed) continue;

    if (patch.status === INBOX_STATUS.SAVED && row.status !== INBOX_STATUS.SAVED) promoted += 1;
    if (patch.status === INBOX_STATUS.SAVE_FAILED && row.status !== INBOX_STATUS.SAVE_FAILED)
      failed += 1;

    await timekeeperDb.bridgeInbox.put({ ...row, ...patch, updated_at: nowIso() });
    touched += 1;
  }

  if (touched > 0) notifyInboxChanged();
  return { promoted, failed };
};

/**
 * Mark every unrecognised device line as rejected, in one go.
 *
 * Unparsed lines are stored on purpose (a device with a slightly different
 * printout must never be invisible), but a misconfigured device produces them
 * by the hundred and they are warnings, so "Smazat vyřízené" cannot touch them.
 * This is the operator saying "yes, I have seen these, they are not times" -
 * after which they become resolved and clearable like anything else.
 *
 * @returns {Promise<number>} how many rows were dismissed
 */
export const rejectUnparsedInboxEvents = async (raceId) => {
  const rows = await listInboxEvents(raceId);
  const doomed = rows.filter(
    (row) => row.reason === 'unparsed' && row.status === INBOX_STATUS.WARNING,
  );
  if (doomed.length === 0) return 0;

  await timekeeperDb.transaction('rw', timekeeperDb.bridgeInbox, async () => {
    for (const row of doomed) {
      await timekeeperDb.bridgeInbox.put({
        ...row,
        status: INBOX_STATUS.REJECTED,
        level: 'secondary',
        race_id: normalizeRaceId(raceId) ?? row.race_id ?? null,
        updated_at: nowIso(),
      });
    }
  });

  notifyInboxChanged();
  return doomed.length;
};

/**
 * Explicit operator action only.
 *
 * Operates on exactly what the timing screen shows for that race: rows stamped
 * with it plus the unassigned ones.
 *
 * @param {number|string} raceId
 * @param {{onlyResolved?: boolean}} options - onlyResolved keeps every row that
 *   is not provably written to the server (see isResolvedInboxEvent)
 * @returns {Promise<number>} how many rows were removed
 */
export const clearInboxEvents = async (raceId, { onlyResolved = false } = {}) => {
  const rows = await listInboxEvents(raceId);
  const doomed = onlyResolved ? rows.filter(isResolvedInboxEvent) : rows;
  if (doomed.length === 0) return 0;
  await timekeeperDb.bridgeInbox.bulkDelete(doomed.map((row) => row.id));
  notifyInboxChanged();
  return doomed.length;
};
