'use client';

import { normalizeUaePhone } from '@sst/shared';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

/** Invite form: a helper needs a UAE mobile number, an admin needs an email. */
export function InviteStaffForm({ schoolId }: { schoolId: string }) {
  const t = useTranslations('dashboard.staff.invite');
  const errorsT = useTranslations('errors');
  const router = useRouter();
  const [role, setRole] = useState<'helper' | 'admin'>('helper');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    let phoneValue: string | null = null;
    let emailValue: string | null = null;
    if (role === 'helper') {
      phoneValue = normalizeUaePhone(phone);
      if (!phoneValue) {
        setFieldError(t('invalidPhone'));
        return;
      }
    } else {
      const parsed = z.string().trim().email().safeParse(email);
      if (!parsed.success) {
        setFieldError(t('invalidEmail'));
        return;
      }
      emailValue = parsed.data;
    }
    setFieldError(null);

    setLoading(true);
    try {
      const { data, error: err } = await createClient().rpc('invite_staff', {
        p_school_id: schoolId,
        p_role: role,
        p_phone: phoneValue as string,
        p_email: emailValue as string,
        p_display_name: displayName.trim() as string,
      });
      if (err) {
        const known = ['NOT_AUTHORIZED', 'INVALID_INPUT'];
        setError(errorsT(known.includes(err.message) ? err.message : 'UNKNOWN'));
        return;
      }
      const created = (data as unknown as { membership_created: boolean }).membership_created;
      setMessage(created ? t('addedNow') : t('done'));
      setPhone('');
      setEmail('');
      setDisplayName('');
      router.refresh();
    } catch {
      setError(errorsT('NETWORK'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-bold">{t('title')}</h2>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {/* The role select reuses the roles labels */}
        <RoleSelect value={role} onChange={setRole} />
      </label>
      <Input label={t('displayName')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      {role === 'helper' ? (
        <Input label={t('phone')} value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" inputMode="tel" error={fieldError} />
      ) : (
        <Input label={t('email')} value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" type="email" error={fieldError} />
      )}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      <div>
        <Button type="submit" loading={loading}>{t('send')}</Button>
      </div>
    </form>
  );
}

function RoleSelect({ value, onChange }: { value: 'helper' | 'admin'; onChange: (v: 'helper' | 'admin') => void }) {
  const t = useTranslations('dashboard.staff');
  return (
    <>
      {t('role')}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as 'helper' | 'admin')}
        className="min-h-10 rounded-lg border border-neutral-300 px-3 py-2 text-base"
      >
        <option value="helper">{t('roles.helper')}</option>
        <option value="admin">{t('roles.admin')}</option>
      </select>
    </>
  );
}

/** Shared by the staff tables: a confirm dialog around a delete/RPC action. */
export function ConfirmAction({
  label,
  confirm,
  cancel,
  action,
}: {
  label: string;
  confirm: string;
  cancel: string;
  action: () => PromiseLike<{ error: { message: string } | null }>;
}) {
  const errorsT = useTranslations('errors');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await action();
      if (err) {
        const known = ['NOT_AUTHORIZED', 'NOT_FOUND', 'INVALID_INPUT'];
        setError(errorsT(known.includes(err.message) ? err.message : 'UNKNOWN'));
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError(errorsT('NETWORK'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>{label}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={label}>
        <p>{confirm}</p>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <div className="flex gap-2">
          <Button variant="danger" loading={loading} onClick={() => void run()}>{label}</Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>{cancel}</Button>
        </div>
      </Dialog>
    </>
  );
}
