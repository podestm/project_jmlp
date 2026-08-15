import { timekeeperDb } from './db.js';

const BACKUP_VERSION = 1;

// bridgeInbox tu musí být: schránka impulzů z časomíry drží naměřená data,
// která ještě nikdo nepřepsal do startovky. Bez ní záloha vypadá kompletně,
// ale závodní den v ní chybí.
const TABLES = ['races', 'startList', 'cache', 'syncQueue', 'settings', 'conflicts', 'bridgeInbox'];

// Tabulky s autoinkrementovaným id. Shodu s už uloženým řádkem nepozná id
// (to si každé zařízení přiděluje samo), ale tenhle přirozený klíč.
const DEDUPE_KEYS = {
  bridgeInbox: 'op_key',
  syncQueue: 'op_id',
  conflicts: 'op_id'
};

// Tabulky s vlastním primárním klíčem - ten znamená totéž na každém zařízení.
const OWN_KEYS = {
  startList: 'id',
  cache: 'key',
  settings: 'key'
};

// Odkazy na řádek fronty; po přidělení nových id se musí přepsat.
const QUEUE_REFERENCES = {
  bridgeInbox: 'sync_queue_id',
  conflicts: 'queue_item_id'
};

// syncQueue jde první schválně: bridgeInbox a conflicts na ni odkazují, takže
// mapa "staré id -> nové id" musí být hotová dřív, než na ně přijde řada.
const IMPORT_ORDER = ['syncQueue', 'races', 'startList', 'cache', 'settings', 'conflicts', 'bridgeInbox'];

const pickExistingTables = () => TABLES.filter((name) => Boolean(timekeeperDb.tables.find((table) => table.name === name)));

/**
 * Přepíše odkaz na frontu na id, které řádek dostal při tomhle importu.
 *
 * Kdyby se odkaz nechal původní, ukazoval by importovaný impulz na cizí
 * položku fronty a UI by u něj hlásilo stav úplně jiného zápisu.
 */
const remapQueueReference = (tableName, row, idMap) => {
  const field = QUEUE_REFERENCES[tableName];
  if (!field || row[field] == null) return row;
  const mapped = idMap.get(row[field]);
  return { ...row, [field]: mapped ?? null };
};

/**
 * Import tabulky s autoinkrementovaným id.
 *
 * Řádky se nesmí uložit na původní id - to už v zařízení patří něčemu jinému
 * a záloha by cizí (často novější) data přepsala. Přidávají se proto pod novým
 * id a co tu podle přirozeného klíče už je, se přeskočí.
 *
 * @returns {{added: number, skipped: number}}
 */
const importWithNewIds = async (tableName, keyField, rows, idMap) => {
  const table = timekeeperDb.table(tableName);
  const existing = await table.toArray();

  const knownKeys = new Map();
  existing.forEach((row) => {
    const key = row?.[keyField];
    if (key != null && !knownKeys.has(key)) knownKeys.set(key, row.id);
  });

  const toAdd = [];
  const originalIds = [];
  let skipped = 0;

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;

    const key = row[keyField];
    if (key != null && knownKeys.has(key)) {
      skipped += 1;
      // Odkazy z ostatních tabulek musí ukázat na ten řádek, který tu už je.
      if (tableName === 'syncQueue' && row.id != null) idMap.set(row.id, knownKeys.get(key));
      continue;
    }

    // Zapamatovat i klíč právě přidávaného řádku - záloha může tentýž impulz
    // obsahovat dvakrát a druhý výskyt je taky duplicita.
    if (key != null) knownKeys.set(key, null);

    const { id, ...rest } = row;
    toAdd.push(remapQueueReference(tableName, rest, idMap));
    originalIds.push(id);
  }

  if (toAdd.length > 0) {
    const newIds = await table.bulkAdd(toAdd, { allKeys: true });
    if (tableName === 'syncQueue' && Array.isArray(newIds)) {
      newIds.forEach((newId, index) => {
        const oldId = originalIds[index];
        if (oldId != null) idMap.set(oldId, newId);
      });
    }
  }

  return { added: toAdd.length, skipped };
};

/**
 * Import tabulky s vlastním primárním klíčem.
 *
 * Co v zařízení je, vzniklo později než záloha - přepsat to zpátky by zahodilo
 * rozdělanou práci, takže se existující klíče jen přeskočí.
 *
 * @returns {{added: number, skipped: number}}
 */
const importWithOwnKeys = async (tableName, keyField, rows) => {
  const table = timekeeperDb.table(tableName);
  const existingKeys = new Set(await table.toCollection().primaryKeys());

  const toAdd = rows.filter((row) => (
    row && typeof row === 'object' && row[keyField] != null && !existingKeys.has(row[keyField])
  ));

  if (toAdd.length > 0) await table.bulkPut(toAdd);
  return { added: toAdd.length, skipped: rows.length - toAdd.length };
};

export const createBackupSnapshot = async () => {
  const tables = pickExistingTables();
  const data = {};

  await Promise.all(tables.map(async (tableName) => {
    data[tableName] = await timekeeperDb.table(tableName).toArray();
  }));

  return {
    meta: {
      version: BACKUP_VERSION,
      exported_at: new Date().toISOString(),
      app: 'JMLP-Timekeeper'
    },
    data
  };
};

export const downloadBackup = async () => {
  const snapshot = await createBackupSnapshot();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.href = url;
  link.download = `timekeeper-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/**
 * Nahraje zálohu do lokální databáze.
 *
 * Záloha se typicky obnovuje na zařízení, které samo něco naměřilo - proto se
 * slučuje, nikoli přepisuje. Kolik řádků se přeskočilo, se vrací zvlášť, aby
 * to Centrum synchronizace mohlo říct nahlas; tiché "import dokončen" u zálohy,
 * ze které se ve skutečnosti nic nepřidalo, je horší než žádná hláška.
 *
 * @returns {{importedAt: string, tableCounts: Object, skippedCounts: Object, skippedTotal: number}}
 */
export const importBackupPayload = async (rawText) => {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('Soubor zálohy není validní JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
    throw new Error('Soubor zálohy má neplatnou strukturu.');
  }

  const tables = pickExistingTables();
  const ordered = [
    ...IMPORT_ORDER.filter((name) => tables.includes(name)),
    ...tables.filter((name) => !IMPORT_ORDER.includes(name))
  ];

  const tableCounts = {};
  const skippedCounts = {};
  const idMap = new Map();

  await timekeeperDb.transaction('rw', tables.map((name) => timekeeperDb.table(name)), async () => {
    // Sekvenčně, ne Promise.all - pořadí tabulek je tu nosné kvůli idMap.
    for (const tableName of ordered) {
      const rows = Array.isArray(parsed.data[tableName]) ? parsed.data[tableName] : [];
      tableCounts[tableName] = 0;
      skippedCounts[tableName] = 0;
      if (!rows.length) continue;

      const dedupeKey = DEDUPE_KEYS[tableName];
      if (dedupeKey) {
        const { added, skipped } = await importWithNewIds(tableName, dedupeKey, rows, idMap);
        tableCounts[tableName] = added;
        skippedCounts[tableName] = skipped;
        continue;
      }

      const ownKey = OWN_KEYS[tableName];
      if (ownKey) {
        const { added, skipped } = await importWithOwnKeys(tableName, ownKey, rows);
        tableCounts[tableName] = added;
        skippedCounts[tableName] = skipped;
        continue;
      }

      await timekeeperDb.table(tableName).bulkPut(rows);
      tableCounts[tableName] = rows.length;
    }
  });

  return {
    importedAt: new Date().toISOString(),
    tableCounts,
    skippedCounts,
    skippedTotal: Object.values(skippedCounts).reduce((acc, count) => acc + count, 0)
  };
};
