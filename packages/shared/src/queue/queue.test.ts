import { describe, expect, it } from 'vitest';
import { MemoryStore } from './memoryStore';
import { buildAction, drain, type RpcCaller } from './queue';

const mk = (id: string, iso: string) =>
  buildAction('set_boarded', { p_trip_id: 't1' }, { id, now: new Date(iso), lat: null, lng: null });

describe('buildAction', () => {
  it('adds the common arguments', () => {
    const a = buildAction(
      'start_trip',
      { p_trip_id: 't1' },
      { id: 'a1', now: new Date('2030-01-07T05:00:00Z'), lat: 25.1, lng: 55.2 },
    );
    expect(a).toMatchObject({
      id: 'a1',
      rpc: 'start_trip',
      createdAt: '2030-01-07T05:00:00.000Z',
      attempts: 0,
      state: 'pending',
    });
    expect(a.args).toEqual({
      p_trip_id: 't1',
      p_client_action_id: 'a1',
      p_device_time: '2030-01-07T05:00:00.000Z',
      p_lat: 25.1,
      p_lng: 55.2,
    });
  });
});

describe('drain', () => {
  it('returns zeros for an empty queue', async () => {
    const call: RpcCaller = async () => ({ error: null });
    expect(await drain(new MemoryStore(), call)).toEqual({
      sent: 0,
      failed: 0,
      stoppedOnNetwork: false,
    });
  });

  it('sends FIFO by createdAt even when inserted out of order', async () => {
    const store = new MemoryStore();
    await store.put(mk('c', '2030-01-07T05:00:03Z'));
    await store.put(mk('a', '2030-01-07T05:00:01Z'));
    await store.put(mk('b', '2030-01-07T05:00:02Z'));
    const order: string[] = [];
    const call: RpcCaller = async (_rpc, args) => {
      order.push(String(args.p_client_action_id));
      return { error: null };
    };
    const res = await drain(store, call);
    expect(order).toEqual(['a', 'b', 'c']);
    expect(res).toEqual({ sent: 3, failed: 0, stoppedOnNetwork: false });
    expect(await store.list()).toEqual([]);
  });

  it('marks a business error failed and continues', async () => {
    const store = new MemoryStore();
    await store.put(mk('a', '2030-01-07T05:00:01Z'));
    await store.put(mk('b', '2030-01-07T05:00:02Z'));
    const call: RpcCaller = async (_rpc, args) =>
      args.p_client_action_id === 'a' ? { error: { message: 'INVALID_STATE' } } : { error: null };
    const res = await drain(store, call);
    expect(res).toEqual({ sent: 1, failed: 1, stoppedOnNetwork: false });
    const left = await store.list();
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ id: 'a', state: 'failed', error: 'INVALID_STATE' });
  });

  it('stops on a thrown error, increments attempts and leaves later actions untouched', async () => {
    const store = new MemoryStore();
    await store.put(mk('a', '2030-01-07T05:00:01Z'));
    await store.put(mk('b', '2030-01-07T05:00:02Z'));
    let calls = 0;
    const call: RpcCaller = async () => {
      calls += 1;
      throw new Error('Network request failed');
    };
    const res = await drain(store, call);
    expect(calls).toBe(1);
    expect(res).toEqual({ sent: 0, failed: 0, stoppedOnNetwork: true });
    const byId = Object.fromEntries((await store.list()).map((x) => [x.id, x]));
    expect(byId.a).toMatchObject({ attempts: 1, state: 'pending' });
    expect(byId.b).toMatchObject({ attempts: 0, state: 'pending' });
  });

  it('treats an unknown error message as network', async () => {
    const store = new MemoryStore();
    await store.put(mk('a', '2030-01-07T05:00:01Z'));
    const call: RpcCaller = async () => ({ error: { message: 'fetch failed' } });
    const res = await drain(store, call);
    expect(res).toEqual({ sent: 0, failed: 0, stoppedOnNetwork: true });
    expect((await store.list())[0]).toMatchObject({ attempts: 1, state: 'pending' });
  });

  it('skips actions already marked failed', async () => {
    const store = new MemoryStore();
    await store.put({ ...mk('a', '2030-01-07T05:00:01Z'), state: 'failed', error: 'NOT_FOUND' });
    let calls = 0;
    const call: RpcCaller = async () => {
      calls += 1;
      return { error: null };
    };
    await drain(store, call);
    expect(calls).toBe(0);
  });
});
