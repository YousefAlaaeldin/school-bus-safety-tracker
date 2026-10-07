export type Intent = 'parent' | 'helper' | 'staff';
export type AppRole = 'parent' | 'helper' | 'admin';
export type MyContext = {
  memberships: { school_id: string; role: 'admin' | 'helper' }[];
  approved_links: number;
  pending_links: number;
};
export type Destination =
  | { kind: 'parentHome' }
  | { kind: 'helperHome' }
  | { kind: 'adminHome' }
  | { kind: 'invite' }
  | { kind: 'pending' }
  | { kind: 'notRegistered' }
  | { kind: 'chooseRole' };

export function intentToRole(intent: Intent): AppRole {
  if (intent === 'staff') return 'admin';
  return intent;
}

export function availableRoles(ctx: MyContext): AppRole[] {
  const roles: AppRole[] = [];
  if (ctx.approved_links > 0) roles.push('parent');
  if (ctx.memberships.some((m) => m.role === 'helper')) roles.push('helper');
  if (ctx.memberships.some((m) => m.role === 'admin')) roles.push('admin');
  return roles;
}

function homeFor(role: AppRole): Destination {
  if (role === 'parent') return { kind: 'parentHome' };
  if (role === 'helper') return { kind: 'helperHome' };
  return { kind: 'adminHome' };
}

export function resolveDestination(
  intent: Intent | null,
  ctx: MyContext,
  lastRole: AppRole | null,
): { destination: Destination; mismatch: boolean } {
  const roles = availableRoles(ctx);

  if (roles.length >= 2) {
    if (lastRole && roles.includes(lastRole)) {
      return { destination: homeFor(lastRole), mismatch: false };
    }
    if (intent !== null && roles.includes(intentToRole(intent))) {
      return { destination: homeFor(intentToRole(intent)), mismatch: false };
    }
    return { destination: { kind: 'chooseRole' }, mismatch: false };
  }

  const only = roles[0];
  if (only !== undefined) {
    return {
      destination: homeFor(only),
      mismatch: intent !== null && intentToRole(intent) !== only,
    };
  }

  if (ctx.pending_links > 0) return { destination: { kind: 'pending' }, mismatch: false };
  if (intent === 'parent') return { destination: { kind: 'invite' }, mismatch: false };
  return { destination: { kind: 'notRegistered' }, mismatch: false };
}
