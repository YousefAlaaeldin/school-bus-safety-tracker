import { describe, expect, it } from 'vitest';
import { getReceipts, sendPush, type FetchLike, type PushMessage } from './expoPush';

const msg = (i: number): PushMessage => ({
  to: `ExponentPushToken[${i}]`,
  title: 't',
  body: 'b',
  data: { type: 'boarded', trip_id: null },
  sound: 'default',
  priority: 'high',
  channelId: 'safety',
});

describe('sendPush', () => {
  it('chunks 250 messages into 3 POSTs and keeps ticket order', async () => {
    const sizes: number[] = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      const batch = JSON.parse(init.body) as PushMessage[];
      sizes.push(batch.length);
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: batch.map((m) => ({ status: 'ok', id: `id-${m.to}` })) }),
      };
    };
    const messages = Array.from({ length: 250 }, (_, i) => msg(i));
    const tickets = await sendPush(messages, fetchImpl);
    expect(sizes).toEqual([100, 100, 50]);
    expect(tickets).toHaveLength(250);
    expect(tickets[0]).toEqual({ status: 'ok', id: 'id-ExponentPushToken[0]' });
    expect(tickets[249]).toEqual({ status: 'ok', id: 'id-ExponentPushToken[249]' });
  });

  it('sends gzip and bearer headers', async () => {
    let seen: Record<string, string> = {};
    const fetchImpl: FetchLike = async (_url, init) => {
      seen = init.headers;
      return { ok: true, status: 200, json: async () => ({ data: [] }) };
    };
    await sendPush([msg(1)], fetchImpl, 'secret');
    expect(seen['Accept-Encoding']).toContain('gzip');
    expect(seen.Authorization).toBe('Bearer secret');
  });

  it('omits Authorization without a token', async () => {
    let seen: Record<string, string> = {};
    const fetchImpl: FetchLike = async (_url, init) => {
      seen = init.headers;
      return { ok: true, status: 200, json: async () => ({ data: [] }) };
    };
    await sendPush([msg(1)], fetchImpl);
    expect(seen.Authorization).toBeUndefined();
  });

  it('throws EXPO_HTTP_500 on a server error', async () => {
    const fetchImpl: FetchLike = async () => ({ ok: false, status: 500, json: async () => ({}) });
    await expect(sendPush([msg(1)], fetchImpl)).rejects.toThrow('EXPO_HTTP_500');
  });
});

describe('getReceipts', () => {
  it('merges chunks of 300', async () => {
    const sizes: number[] = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      const { ids } = JSON.parse(init.body) as { ids: string[] };
      sizes.push(ids.length);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: Object.fromEntries(
            ids.map((id) => [
              id,
              id === 'id-350'
                ? { status: 'error', details: { error: 'DeviceNotRegistered' } }
                : { status: 'ok' },
            ]),
          ),
        }),
      };
    };
    const ids = Array.from({ length: 400 }, (_, i) => `id-${i}`);
    const receipts = await getReceipts(ids, fetchImpl);
    expect(sizes).toEqual([300, 100]);
    expect(Object.keys(receipts)).toHaveLength(400);
    expect(receipts['id-350']).toEqual({ status: 'error', details: { error: 'DeviceNotRegistered' } });
    expect(receipts['id-0']).toEqual({ status: 'ok' });
  });

  it('throws on HTTP errors', async () => {
    const fetchImpl: FetchLike = async () => ({ ok: false, status: 503, json: async () => ({}) });
    await expect(getReceipts(['a'], fetchImpl)).rejects.toThrow('EXPO_HTTP_503');
  });
});
