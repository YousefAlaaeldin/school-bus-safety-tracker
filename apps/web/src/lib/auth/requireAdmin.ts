import { cookies } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Server-side guard for the dashboard: the user must be an admin of at least one school.
 * The current school is the `school_id` cookie when valid, else the first admin membership.
 */
export async function requireAdmin(locale: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: '/dashboard/login', locale });

  const { data: memberships } = await supabase
    .from('memberships')
    .select('school_id')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .order('created_at');
  const schoolIds = (memberships ?? []).map((m) => m.school_id);
  if (schoolIds.length === 0) return redirect({ href: '/dashboard/no-access', locale });

  const cookieStore = await cookies();
  const wanted = cookieStore.get('school_id')?.value;
  const schoolId = wanted && schoolIds.includes(wanted) ? wanted : (schoolIds[0] as string);
  return { user, schoolId };
}
