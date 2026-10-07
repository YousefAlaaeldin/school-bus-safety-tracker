// Edge Function: sends due notification_outbox rows through Expo push.
// Called every 10 s by pg_cron (see the cron migration). Uses the service-role key.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildMessages, type DueNotification } from '../_shared/dispatch.ts';
import { sendPush, type Ticket } from '../_shared/expoPush.ts';
import ar from '../_shared/i18n/ar.json' with { type: 'json' };
import en from '../_shared/i18n/en.json' with { type: 'json' };

const MAX_ROUNDS = 5;
const BATCH = 100;

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const mock = Deno.env.get('PUSH_MOCK') === '1';
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN') || undefined;
  let processed = 0;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { data, error } = await supabase.rpc('claim_due_notifications', { p_limit: BATCH });
    if (error) {
      console.error({ fn: 'notify-dispatch', event: 'claim_failed', message: error.message });
      break;
    }
    const rows = (data ?? []) as DueNotification[];
    if (rows.length === 0) break;

    const built = buildMessages(rows, { en, ar });

    // Rows with no device cannot be delivered.
    for (const id of built.noTokens) {
      await supabase.rpc('complete_notification', {
        p_id: id, p_status: 'failed', p_ticket_ids: [], p_tokens: [], p_error: 'NO_TOKENS',
      });
    }

    let tickets: Ticket[] = [];
    let httpError: string | null = null;
    if (built.messages.length > 0) {
      if (mock) {
        tickets = built.messages.map(() => ({ status: 'ok', id: `mock-${crypto.randomUUID()}` }));
        console.log(`PUSH_MOCK: pretending to send ${built.messages.length} message(s)`);
      } else {
        try {
          tickets = await sendPush(built.messages, fetch, accessToken);
        } catch (e) {
          httpError = e instanceof Error ? e.message : 'EXPO_ERROR';
          console.error({ fn: 'notify-dispatch', event: 'send_failed', message: httpError });
        }
      }
    }

    // Group the per-message results back onto their rows.
    const byRow = new Map<string, { ticketIds: string[]; tokens: string[]; errors: string[] }>();
    built.rowIds.forEach((rowId, i) => {
      const entry = byRow.get(rowId) ?? { ticketIds: [], tokens: [], errors: [] };
      const ticket = tickets[i];
      if (ticket?.status === 'ok') {
        entry.ticketIds.push(ticket.id);
        entry.tokens.push(built.tokens[i]!);
      } else if (ticket?.status === 'error') {
        entry.errors.push(ticket.details?.error ?? ticket.message);
        if (ticket.details?.error === 'DeviceNotRegistered') {
          void supabase.from('push_tokens').delete().eq('expo_token', built.tokens[i]!);
        }
      }
      byRow.set(rowId, entry);
    });

    for (const [rowId, entry] of byRow) {
      if (httpError) {
        await supabase.rpc('complete_notification', {
          p_id: rowId, p_status: 'pending', p_ticket_ids: [], p_tokens: [], p_error: httpError,
        });
      } else if (entry.ticketIds.length > 0) {
        await supabase.rpc('complete_notification', {
          p_id: rowId, p_status: 'sent', p_ticket_ids: entry.ticketIds, p_tokens: entry.tokens, p_error: '',
        });
      } else {
        await supabase.rpc('complete_notification', {
          p_id: rowId, p_status: 'failed', p_ticket_ids: [], p_tokens: [], p_error: entry.errors.join(',') || 'NO_TICKET',
        });
      }
    }

    processed += rows.length;
    if (rows.length < BATCH) break;
  }

  return new Response(JSON.stringify({ processed }), { headers: { 'Content-Type': 'application/json' } });
});
