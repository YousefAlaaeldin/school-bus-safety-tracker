import type { ReactNode } from 'react';

export type BadgeColor = 'gray' | 'green' | 'blue' | 'amber' | 'red';

const COLORS: Record<BadgeColor, string> = {
  gray: 'bg-neutral-100 text-neutral-800',
  green: 'bg-emerald-100 text-emerald-900',
  blue: 'bg-sky-100 text-sky-900',
  amber: 'bg-amber-100 text-amber-900',
  red: 'bg-red-100 text-red-900',
};

/** Badge color per student_trip_status and trip_status value. */
export function statusBadgeColor(status: string): BadgeColor {
  switch (status) {
    case 'expected':
    case 'scheduled':
      return 'gray';
    case 'absent_reported':
    case 'cancelled':
      return 'amber';
    case 'boarded':
    case 'roll_call':
    case 'in_progress':
      return 'blue';
    case 'dropped':
    case 'completed':
      return 'green';
    case 'missing':
    case 'returned_to_school':
      return 'red';
    default:
      return 'gray';
  }
}

export function Badge({ color = 'gray', children }: { color?: BadgeColor; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${COLORS[color]}`}>
      {children}
    </span>
  );
}
