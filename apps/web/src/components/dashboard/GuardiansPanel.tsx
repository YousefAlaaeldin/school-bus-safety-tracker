'use client';

import { normalizeUaePhone } from '@sst/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge, type BadgeColor } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Table } from '@/components/ui/Table';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

export type GuardianLink = {
  id: string;
  guardian_phone: string;
  guardian_user_id: string | null;
  relationship: string;
  status: 'pending' | 'approved' | 'revoked';
  can_track: boolean;
};

const STATUS_COLOR: Record<GuardianLink['status'], BadgeColor> = {
  pending: 'amber',
  approved: 'green',
  revoked: 'gray',
};

const RELATIONSHIPS = ['mother', 'father', 'guardian', 'other'] as const;

type Props = { studentId: string; schoolId: string; links: GuardianLink[] };

export function GuardiansPanel({ studentId, schoolId, links }: Props) {
  const t = useTranslations('dashboard.guardians');
  const errorsT = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const supabase = createClient();

  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState<(typeof RELATIONSHIPS)[number]>('guardian');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState<{ code: string } | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const showError = (e: unknown) => {
    const message = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : '';
    const known = ['NOT_AUTHORIZED', 'NOT_FOUND', 'INVALID_STATE', 'INVALID_INPUT'];
    setError(errorsT(known.includes(message) ? message : 'UNKNOWN'));
  };

  const run = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await fn();
      if (err) {
        showError(err);
        return false;
      }
      router.refresh();
      return true;
    } catch (e) {
      showError(e);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const normalized = normalizeUaePhone(phone);
    if (!normalized) {
      setPhoneError(t('invalidPhone'));
      return;
    }
    setPhoneError(null);
    const ok = await run(() =>
      supabase.from('guardian_links').insert({
        student_id: studentId,
        school_id: schoolId,
        guardian_phone: normalized,
        relationship,
      }),
    );
    if (ok) setPhone('');
  };

  const createInvite = async (linkId: string) => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc('create_invite', { p_guardian_link_id: linkId });
      if (err) {
        showError(err);
        return;
      }
      setInvite({ code: (data as unknown as { code: string }).code });
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">{t('title')}</h2>

      {error ? (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <Table
        rows={links}
        rowKey={(l) => l.id}
        empty={t('empty')}
        columns={[
          {
            key: 'phone',
            header: t('phone'),
            render: (l) => <span dir="ltr">{l.guardian_phone}</span>,
          },
          { key: 'rel', header: t('relationship'), render: (l) => t(`relationships.${l.relationship}`) },
          {
            key: 'status',
            header: t('status'),
            render: (l) => <Badge color={STATUS_COLOR[l.status]}>{t(`statuses.${l.status}`)}</Badge>,
          },
          { key: 'signed', header: t('signedUp'), render: (l) => (l.guardian_user_id ? t('yes') : t('no')) },
          {
            key: 'track',
            header: t('canTrack'),
            render: (l) => (
              <input
                type="checkbox"
                checked={l.can_track}
                disabled={busy}
                aria-label={t('canTrack')}
                className="size-4"
                onChange={(e) =>
                  void run(() =>
                    supabase.from('guardian_links').update({ can_track: e.target.checked }).eq('id', l.id),
                  )
                }
              />
            ),
          },
          {
            key: 'actions',
            header: '',
            render: (l) =>
              l.status === 'revoked' ? null : (
                <div className="flex flex-wrap gap-2">
                  {l.status === 'pending' && l.guardian_user_id ? (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void run(() => supabase.rpc('approve_guardian_link', { p_link_id: l.id }))}
                    >
                      {t('approve')}
                    </Button>
                  ) : null}
                  <Button variant="secondary" disabled={busy} onClick={() => void createInvite(l.id)}>
                    {t('invite')}
                  </Button>
                  <Button variant="danger" disabled={busy} onClick={() => setRevokeId(l.id)}>
                    {t('revoke')}
                  </Button>
                </div>
              ),
          },
        ]}
      />

      <div className="flex max-w-xl flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <h3 className="font-semibold">{t('add')}</h3>
        <Input
          label={t('phone')}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          dir="ltr"
          inputMode="tel"
          placeholder="05X XXX XXXX"
          error={phoneError}
        />
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('relationship')}
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value as (typeof RELATIONSHIPS)[number])}
            className="min-h-10 rounded-lg border border-neutral-300 px-3 py-2 text-base"
          >
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {t(`relationships.${r}`)}
              </option>
            ))}
          </select>
        </label>
        <div>
          <Button onClick={() => void add()} loading={busy}>
            {t('add')}
          </Button>
        </div>
      </div>

      <Dialog open={invite !== null} onClose={() => setInvite(null)} title={t('inviteTitle')}>
        {invite ? (
          <div className="flex flex-col gap-3">
            <p dir="ltr" className="rounded-xl bg-neutral-100 px-6 py-4 text-center font-mono text-4xl font-bold tracking-widest">
              {invite.code}
            </p>
            <p className="text-sm text-neutral-600">{t('inviteLink')}</p>
            <p dir="ltr" className="break-all text-sm">{`${siteUrl}/${locale}/invite/${invite.code}`}</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => window.print()}>
                {t('print')}
              </Button>
              <Button variant="ghost" onClick={() => setInvite(null)}>
                {t('close')}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog open={revokeId !== null} onClose={() => setRevokeId(null)} title={t('revoke')}>
        <p>{t('revokeConfirm')}</p>
        <div className="flex gap-2">
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              const id = revokeId;
              if (!id) return;
              const ok = await run(() => supabase.rpc('revoke_guardian_link', { p_link_id: id }));
              if (ok) setRevokeId(null);
            }}
          >
            {t('revoke')}
          </Button>
          <Button variant="ghost" onClick={() => setRevokeId(null)}>
            {t('cancel')}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
