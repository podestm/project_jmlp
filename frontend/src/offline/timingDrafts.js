// Per-race drafts of times the operator has typed but not blurred yet.
//
// A blurred value is already durable (it goes through TimekeeperAPI into the
// sync queue). The remaining hole is the value still sitting in the input when
// the tablet reloads. These drafts close it, and they are deliberately kept in
// the existing `settings` store: one small row per race, no schema change.
//
// Draft shape, per entry id:
//
//   {
//     time1, time2, dnf, dns, dsq,     // what the operator typed
//     base: { time1, time2, dnf, dns, dsq }   // the SERVER values it was typed against
//   }
//
// `base` is a value snapshot, not a revision string, and that is the whole
// point: the GET and the PUT format the revision differently ("...45" vs
// "...45Z"), so comparing revisions here threw away typed times. Comparing
// values is immune to that. On restore the draft is kept when the reloaded row
// still carries exactly `base`; if it does not, somebody else wrote a newer
// value and the server wins.
//
// A successful save moves the baseline, so the writer MUST rewrite the draft
// row afterwards (TimingEntry.saveEntry / saveAllTimes do). Otherwise the
// stored `base` still describes the pre-save server state and the next reload
// reports a typed time as "discarded, the record changed on the server" about a
// time that is in fact saved.

import { timekeeperDb } from './db.js';

const DRAFT_KEY_PREFIX = 'timing_drafts_';

const draftKey = (raceId) => `${DRAFT_KEY_PREFIX}${Number(raceId) || 0}`;

/**
 * Write the whole draft set for one race. An empty set removes the row.
 *
 * CALLER CONTRACT: only ever call this once the race's start list has loaded
 * successfully. An empty set derived from a failed load looks identical to
 * "the operator has nothing outstanding", and would delete real drafts.
 *
 * @param {number|string} raceId
 * @param {Object} drafts - entryId -> {time1, time2, dnf, dns, dsq, base}
 */
export const saveTimingDrafts = async (raceId, drafts) => {
  const key = draftKey(raceId);
  if (!drafts || Object.keys(drafts).length === 0) {
    await timekeeperDb.settings.delete(key);
    return;
  }
  await timekeeperDb.settings.put({
    key,
    value: drafts,
    updated_at: new Date().toISOString(),
  });
};

export const loadTimingDrafts = async (raceId) => {
  const row = await timekeeperDb.settings.get(draftKey(raceId));
  return row && row.value && typeof row.value === 'object' ? row.value : {};
};

export const clearTimingDrafts = async (raceId) => {
  await timekeeperDb.settings.delete(draftKey(raceId));
};
