// Edge Function: checks Expo push receipts for sent notifications and removes dead device tokens.
// Called every 15 minutes by pg_cron. Does nothing when PUSH_MOCK=1.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getReceipts } from '../_shared/expoPush.ts';

type Unchecked = { id: string; ticket_ids: string[]; tokens: string[] };

Deno.serve(async () => {
  if (Deno.env.get('PUSH_MOCK') === '1') {
    return new Response(JSON.stringify({ checked: 0, mock: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN') || undefined;

  const { data, error } = await supabase.rpc('get_unchecked_receipts', { p_limit: 300 });
  if (error) {
    console.error('get_unchecked_receipts failed', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  const rows = (data ?? []) as Unchecked[];
  if (rows.length === 0) {
    return new Response(JSON.stringify({ checked: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }

  const ticketIds = rows.flatMap((r) => r.ticket_ids);
  let receipts: Awaited<ReturnType<typeof getReceipts>> = {};
  try {
    receipts = await getReceipts(ticketIds, fetch, accessToken);
  } catch (e) {
    // Try again at the next run; nothing is marked as checked.
    console.error('getReceipts failed', e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ checked: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }

  // sent_tokens has the same order as expo_ticket_ids, so a ticket maps to its token by index.
  const dead = new Set<string>();
  for (const row of rows) {
    row.ticket_ids.forEach((ticketId, i) => {
      const receipt = receipts[ticketId];
      if (receipt?.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
        const token = row.tokens[i];
        if (token) dead.add(token);
      }
    });
  }

  const { error: markError } = await supabase.rpc('mark_receipts_checked', {
    p_ids: rows.map((r) => r.id),
    p_dead_tokens: [...dead],
  });
  if (markError) console.error('mark_receipts_checked failed', markError.message);

  return new Response(JSON.stringify({ checked: rows.length, dead_tokens: dead.size }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
