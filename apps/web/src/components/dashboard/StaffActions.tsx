'use client';

import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { ConfirmAction } from './InviteStaffForm';

export function RemoveStaffButton({ membershipId }: { membershipId: string }) {
  const t = useTranslations('dashboard.staff');
  return (
    <ConfirmAction
      label={t('remove')}
      confirm={t('removeConfirm')}
      cancel={t('cancel')}
      action={() => createClient().rpc('remove_staff', { p_membership_id: membershipId })}
    />
  );
}

export function DeleteInviteButton({ inviteId }: { inviteId: string }) {
  const t = useTranslations('dashboard.staff');
  return (
    <ConfirmAction
      label={t('deleteInvite')}
      confirm={t('deleteInvite')}
      cancel={t('cancel')}
      action={() => createClient().from('staff_invites').delete().eq('id', inviteId)}
    />
  );
}
