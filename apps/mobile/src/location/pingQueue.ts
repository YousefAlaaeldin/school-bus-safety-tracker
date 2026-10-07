import { getDb } from '@/queue/sqliteStore';

export type Ping = {
  lat: number;
  lng: number;
  heading: number | null;
  speed_mps: number | null;
  accuracy_m: number | null;
  recorded_at: string;
};

export type QueuedPing = { id: number; tripId: string; ping: Ping };

const MAX_ROWS = 5000;

let ready: Promise<void> | null = null;
function init(): Promise<void> {
  ready ??= getDb().then((db) =>
    db.execAsync(
      'create table if not exists pings (id integer primary key autoincrement, trip_id text not null, json text not null)',
    ),
  );
  return ready;
}

/** GPS pings waiting to be uploaded. Survives app restarts; capped at 5000 rows (oldest dropped). */
export const pingQueue = {
  async add(tripId: string, pings: Ping[]): Promise<void> {
    if (pings.length === 0) return;
    await init();
    const db = await getDb();
    for (const ping of pings) {
      await db.runAsync('insert into pings (trip_id, json) values (?, ?)', tripId, JSON.stringify(ping));
    }
    await db.runAsync(
      'delete from pings where id <= (select id from pings order by id desc limit 1 offset ?)',
      MAX_ROWS,
    );
  },

  /** The oldest pings first. */
  async take(limit: number): Promise<QueuedPing[]> {
    await init();
    const db = await getDb();
    const rows = await db.getAllAsync<{ id: number; trip_id: string; json: string }>(
      'select id, trip_id, json from pings order by id limit ?',
      limit,
    );
    return rows.map((r) => ({ id: r.id, tripId: r.trip_id, ping: JSON.parse(r.json) as Ping }));
  },

  async remove(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await init();
    const db = await getDb();
    await db.runAsync(`delete from pings where id in (${ids.map(() => '?').join(',')})`, ...ids);
  },

  async count(): Promise<number> {
    await init();
    const db = await getDb();
    const row = await db.getFirstAsync<{ n: number }>('select count(*) as n from pings');
    return row?.n ?? 0;
  },
};
