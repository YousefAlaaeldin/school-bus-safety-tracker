import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { InviteStaffForm } from '@/components/dashboard/InviteStaffForm';
import { DeleteInviteButton, RemoveStaffButton } from '@/components/dashboard/StaffActions';
import { Table } from '@/components/ui/Table';
import { routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient } from '@/lib/supabase/server';

export default async function StaffPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('dashboard.staff');
  const { schoolId, user } = await requireAdmin(locale);

  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from('memberships')
    .select('id, user_id, role, profiles(display_name, phone, email)')
    .eq('school_id', schoolId)
    .order('created_at');
  const { data: invites } = await supabase
    .from('staff_invites')
    .select('id, role, phone, email, display_name, created_at')
    .eq('school_id', schoolId)
    .is('claimed_by', null)
    .order('created_at');

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">{t('members')}</h2>
        <Table
          rows={memberships ?? []}
          rowKey={(m) => m.id}
          empty={t('emptyMembers')}
          columns={[
            { key: 'name', header: t('name'), render: (m) => m.profiles?.display_name ?? '' },
            {
              key: 'contact',
              header: t('contact'),
              render: (m) => <span dir="ltr">{m.profiles?.phone ?? m.profiles?.email ?? ''}</span>,
            },
            { key: 'role', header: t('role'), render: (m) => t(`roles.${m.role}`) },
            {
              key: 'remove',
              header: '',
              render: (m) => (m.user_id === user.id ? null : <RemoveStaffButton membershipId={m.id} />),
            },
          ]}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">{t('invites')}</h2>
        <Table
          rows={invites ?? []}
          rowKey={(i) => i.id}
          empty={t('emptyInvites')}
          columns={[
            { key: 'name', header: t('name'), render: (i) => i.display_name ?? '' },
            {
              key: 'contact',
              header: t('contact'),
              render: (i) => <span dir="ltr">{i.phone ?? i.email ?? ''}</span>,
            },
            { key: 'role', header: t('role'), render: (i) => t(`roles.${i.role}`) },
            {
              key: 'created',
              header: t('created'),
              render: (i) => new Date(i.created_at).toLocaleDateString(locale === 'ar' ? 'ar-AE-u-nu-latn' : 'en-AE'),
            },
            { key: 'delete', header: '', render: (i) => <DeleteInviteButton inviteId={i.id} /> },
          ]}
        />
      </section>

      <InviteStaffForm schoolId={schoolId} />
    </div>
  );
}
