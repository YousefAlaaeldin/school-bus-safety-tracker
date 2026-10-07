// Expo push client. No Deno-only APIs, so vitest can run it with an injected fetch.

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, string | null>;
  sound: 'default';
  priority: 'high';
  channelId: 'safety';
  interruptionLevel?: 'time-sensitive';
};
export type Ticket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };
export type Receipt = { status: 'ok' } | { status: 'error'; details?: { error?: string } };

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const SEND_URL = 'https://exp.host/--/api/v2/push/send';
const RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const SEND_CHUNK = 100;
const RECEIPTS_CHUNK = 300;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function headers(accessToken?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  if (accessToken) h.Authorization = `Bearer ${accessToken}`;
  return h;
}

/** POSTs up to 100 messages at a time; returns tickets in the same order as `messages`. */
export async function sendPush(
  messages: PushMessage[],
  fetchImpl: FetchLike,
  accessToken?: string,
): Promise<Ticket[]> {
  const tickets: Ticket[] = [];
  for (const part of chunk(messages, SEND_CHUNK)) {
    const res = await fetchImpl(SEND_URL, {
      method: 'POST',
      headers: headers(accessToken),
      body: JSON.stringify(part),
    });
    if (!res.ok) throw new Error(`EXPO_HTTP_${res.status}`);
    const json = (await res.json()) as { data?: Ticket[] };
    tickets.push(...(json.data ?? []));
  }
  return tickets;
}

/** POSTs up to 300 ids at a time; returns a merged map of id → receipt. */
export async function getReceipts(
  ids: string[],
  fetchImpl: FetchLike,
  accessToken?: string,
): Promise<Record<string, Receipt>> {
  const merged: Record<string, Receipt> = {};
  for (const part of chunk(ids, RECEIPTS_CHUNK)) {
    const res = await fetchImpl(RECEIPTS_URL, {
      method: 'POST',
      headers: headers(accessToken),
      body: JSON.stringify({ ids: part }),
    });
    if (!res.ok) throw new Error(`EXPO_HTTP_${res.status}`);
    const json = (await res.json()) as { data?: Record<string, Receipt> };
    Object.assign(merged, json.data ?? {});
  }
  return merged;
}
