import Dexie from 'dexie';

export const timekeeperDb = new Dexie('JMLPTimekeeperDB');

timekeeperDb.version(1).stores({
  races: 'id, datum, updated_at',
  startList: 'id, race_id, start_number, updated_at',
  cache: '&key, updated_at',
  syncQueue: '++id, status, created_at, next_retry_at, method, endpoint',
  settings: '&key, updated_at'
});

timekeeperDb.version(2).stores({
  races: 'id, datum, updated_at',
  startList: 'id, race_id, start_number, updated_at',
  cache: '&key, updated_at',
  syncQueue: '++id, status, created_at, next_retry_at, method, endpoint',
  settings: '&key, updated_at',
  conflicts: '++id, queue_item_id, status_code, created_at, resolved'
});
