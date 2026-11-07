import Dexie from 'dexie';

export const timekeeperDb = new Dexie('JMLPTimekeeperDB');

const TABLES_V1 = {
  races: 'id, datum, updated_at',
  startList: 'id, race_id, start_number, updated_at',
  cache: '&key, updated_at',
  syncQueue: '++id, status, created_at, next_retry_at, method, endpoint',
  settings: '&key, updated_at',
};

const TABLES_V2 = {
  ...TABLES_V1,
  conflicts: '++id, queue_item_id, status_code, created_at, resolved',
};

const TABLES_V3 = {
  ...TABLES_V2,
  bridgeInbox: '++id, race_id, status, created_at, op_key',
};

// Dexie potřebuje historii verzí, aby uměl upgradovat databázi, kterou už má
// prohlížeč založenou z dřívější návštěvy.
timekeeperDb.version(1).stores(TABLES_V1);
timekeeperDb.version(2).stores(TABLES_V2);
timekeeperDb.version(3).stores(TABLES_V3);

export const DB_STATE_EVENT = 'timekeeper-db-state-changed';

/**
 * Když IndexedDB nejde otevřít, časoměřič sice dál vypadá funkčně, ale nic
 * neukládá. To je za závodu to nejhorší, co může nastat, takže se ten stav
 * hlásí nahlas a doslova.
 */
export const DB_STATE_TEXT = {
  blocked:
    'Lokální databázi blokuje jiná otevřená karta Časoměřiče. Zavřete ostatní karty a obnovte stránku – do té doby se naměřené časy NEUKLÁDAJÍ.',
  closed:
    'Lokální databáze byla uzavřena jinou kartou (nová verze aplikace). Obnovte stránku – do té doby se naměřené časy NEUKLÁDAJÍ.',
};

let dbState = 'ok';
let recoveryTimer = null;

export const getDbState = () => dbState;

const setDbState = (state) => {
  if (dbState === state) return;
  dbState = state;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DB_STATE_EVENT, { detail: { state } }));
  }
};

/**
 * 'blocked' se umí sám spravit - stačí, aby uživatel zavřel druhou kartu.
 * Dexie o tom ale žádnou událost nepošle, takže se na to musíme doptat.
 */
const watchForUnblock = () => {
  if (recoveryTimer || typeof window === 'undefined') return;
  recoveryTimer = window.setInterval(() => {
    if (dbState !== 'blocked') {
      window.clearInterval(recoveryTimer);
      recoveryTimer = null;
      return;
    }
    if (timekeeperDb.isOpen()) {
      window.clearInterval(recoveryTimer);
      recoveryTimer = null;
      setDbState('ok');
    }
  }, 2000);
};

timekeeperDb.on('blocked', () => {
  setDbState('blocked');
  watchForUnblock();
});

// Jiná karta nasadila novou verzi schématu. Držet otevřené spojení by jí
// upgrade zablokovalo, takže uhneme a řekneme si o obnovení stránky.
timekeeperDb.on('versionchange', () => {
  try {
    timekeeperDb.close();
  } catch {
    // Zavřít nejde jen u už zavřené databáze - to je přesně stav, který chceme.
  }
  setDbState('closed');
});

timekeeperDb.on('close', () => setDbState('closed'));
