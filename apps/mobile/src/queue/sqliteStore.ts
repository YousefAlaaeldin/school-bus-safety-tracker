import type { QueuedAction, QueueStore } from '@sst/shared';
import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= SQLite.openDatabaseAsync('queue.db').then(async (db) => {
    await db.execAsync('create table if not exists actions (id text primary key, json text not null)');
    return db;
  });
  return dbPromise;
}

/** The offline action queue, persisted in SQLite so it survives app restarts. */
export const sqliteStore: QueueStore = {
  async list() {
    const db = await getDb();
    const rows = await db.getAllAsync<{ json: string }>('select json from actions');
    return rows.map((r) => JSON.parse(r.json) as QueuedAction);
  },
  async put(a) {
    const db = await getDb();
    await db.runAsync('insert or replace into actions (id, json) values (?, ?)', a.id, JSON.stringify(a));
  },
  async remove(id) {
    const db = await getDb();
    await db.runAsync('delete from actions where id = ?', id);
  },
};
