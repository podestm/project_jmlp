import { timekeeperDb } from './db.js';

const BACKUP_VERSION = 1;

const TABLES = ['races', 'startList', 'cache', 'syncQueue', 'settings', 'conflicts'];

const pickExistingTables = () => TABLES.filter((name) => Boolean(timekeeperDb.tables.find((table) => table.name === name)));

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
  await timekeeperDb.transaction('rw', tables.map((name) => timekeeperDb.table(name)), async () => {
    await Promise.all(tables.map(async (tableName) => {
      const rows = Array.isArray(parsed.data[tableName]) ? parsed.data[tableName] : [];
      if (!rows.length) return;
      await timekeeperDb.table(tableName).bulkPut(rows);
    }));
  });

  return {
    importedAt: new Date().toISOString(),
    tableCounts: tables.reduce((acc, tableName) => {
      acc[tableName] = Array.isArray(parsed.data[tableName]) ? parsed.data[tableName].length : 0;
      return acc;
    }, {})
  };
};
