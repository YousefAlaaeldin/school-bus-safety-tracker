import { describe, expect, it } from 'vitest';
import {
  availableRoles,
  intentToRole,
  resolveDestination,
  type AppRole,
  type Intent,
  type MyContext,
} from './routing';

const S = '00000000-0000-0000-0000-000000000001';
const ctx = (p: Partial<MyContext> = {}): MyContext => ({
  memberships: [],
  approved_links: 0,
  pending_links: 0,
  ...p,
});
const helper = { school_id: S, role: 'helper' as const };
const admin = { school_id: S, role: 'admin' as const };

function resolve(intent: Intent | null, c: MyContext, last: AppRole | null = null) {
  return resolveDestination(intent, c, last);
}

describe('intentToRole', () => {
  it('maps staff to admin', () => {
    expect(intentToRole('parent')).toBe('parent');
    expect(intentToRole('helper')).toBe('helper');
    expect(intentToRole('staff')).toBe('admin');
  });
});

describe('availableRoles', () => {
  it('orders parent, helper, admin', () => {
    expect(availableRoles(ctx({ approved_links: 1, memberships: [admin, helper] }))).toEqual([
      'parent',
      'helper',
      'admin',
    ]);
  });
  it('is empty with pending links only', () => {
    expect(availableRoles(ctx({ pending_links: 2 }))).toEqual([]);
  });
});

describe('resolveDestination', () => {
  const both = ctx({ approved_links: 1, memberships: [helper] });

  it('2+ roles: lastRole wins', () => {
    expect(resolve('parent', both, 'helper')).toEqual({
      destination: { kind: 'helperHome' },
      mismatch: false,
    });
  });
  it('2+ roles: intent used when no lastRole', () => {
    expect(resolve('parent', both)).toEqual({
      destination: { kind: 'parentHome' },
      mismatch: false,
    });
  });
  it('2+ roles: chooseRole when no lastRole and no intent', () => {
    expect(resolve(null, both)).toEqual({ destination: { kind: 'chooseRole' }, mismatch: false });
  });
  it('2+ roles: lastRole not in roles falls back to intent', () => {
    expect(resolve('helper', both, 'admin').destination).toEqual({ kind: 'helperHome' });
  });
  it('2+ roles: intent not in roles gives chooseRole', () => {
    expect(resolve('staff', both).destination).toEqual({ kind: 'chooseRole' });
  });
  it('1 role: mismatch when intent differs', () => {
    expect(resolve('helper', ctx({ approved_links: 1 }))).toEqual({
      destination: { kind: 'parentHome' },
      mismatch: true,
    });
  });
  it('1 role: no mismatch when intent is null', () => {
    expect(resolve(null, ctx({ memberships: [helper] }))).toEqual({
      destination: { kind: 'helperHome' },
      mismatch: false,
    });
  });
  it('admin only with staff intent', () => {
    expect(resolve('staff', ctx({ memberships: [admin] }))).toEqual({
      destination: { kind: 'adminHome' },
      mismatch: false,
    });
  });
  it('admin + helper with staff intent', () => {
    expect(resolve('staff', ctx({ memberships: [admin, helper] }))).toEqual({
      destination: { kind: 'adminHome' },
      mismatch: false,
    });
  });
  it('no roles, pending link', () => {
    expect(resolve('parent', ctx({ pending_links: 1 }))).toEqual({
      destination: { kind: 'pending' },
      mismatch: false,
    });
  });
  it('no roles, parent intent', () => {
    expect(resolve('parent', ctx())).toEqual({
      destination: { kind: 'invite' },
      mismatch: false,
    });
  });
  it('no roles, helper intent', () => {
    expect(resolve('helper', ctx())).toEqual({
      destination: { kind: 'notRegistered' },
      mismatch: false,
    });
  });
  it('no roles, staff or no intent', () => {
    expect(resolve('staff', ctx()).destination).toEqual({ kind: 'notRegistered' });
    expect(resolve(null, ctx()).destination).toEqual({ kind: 'notRegistered' });
  });
});
