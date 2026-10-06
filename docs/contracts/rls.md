# Contract: Row-Level Security

Who can do what on every table. Implement with the helper functions in §1 so policies stay short. **Anything not listed is denied.** Clients never get `insert`, `update` or `delete` unless a row below says so; state changes go through RPCs (`rpc.md`), which are `security definer`.

## §1 Helper functions (schema `private`)

All of these are `language sql stable security definer set search_path = ''`, and `grant execute ... to authenticated`.

| function | returns | true when |
|---|---|---|
| `private.is_school_admin(p_school_id uuid)` | boolean | A `memberships` row exists for `auth.uid()`, that school, role `admin` |
| `private.is_school_helper(p_school_id uuid)` | boolean | The same, with role `helper` |
| `private.is_school_staff(p_school_id uuid)` | boolean | admin **or** helper |
| `private.my_student_ids()` | setof uuid | `student_id` from `guardian_links` where `guardian_user_id = auth.uid()` and `status = 'approved'` |
| `private.my_tracking_student_ids()` | setof uuid | The same, plus `can_track = true` |
| `private.is_guardian_in_school(p_school_id uuid)` | boolean | Any of my approved students belongs to that school |
| `private.is_trip_helper(p_trip_id uuid)` | boolean | `trips.helper_id = auth.uid()` |
| `private.trip_school_id(p_trip_id uuid)` | uuid | `trips.school_id` |
| `private.can_view_bus(p_trip_id uuid)` | boolean | See §2 |
| `private.helper_student_ids()` | setof uuid | `student_id` from `trip_students` joined to `trips` where `trips.helper_id = auth.uid()` |
| `private.helper_stop_ids()` | setof uuid | `stop_id` from `trip_students`/`trips` where helper is me, **union** `route_stops.stop_id` for routes whose `default_helper_id = auth.uid()` |
| `private.guardian_stop_ids()` | setof uuid | `stop_id` from `student_assignments` and `trip_students` of `my_student_ids()`, **union** stops with `is_school = true` in those students' schools |

## §2 Who can see the live bus (`private.can_view_bus`)

```
true if ANY of:
  a) private.is_school_admin(private.trip_school_id(trip))
  b) private.is_trip_helper(trip)
  c) exists trip_students ts join trips t on t.id = ts.trip_id
       where ts.trip_id = trip
         and ts.student_id in (select private.my_tracking_student_ids())
         and t.status in ('roll_call', 'in_progress')
         and ( ts.status = 'boarded'
               or (t.direction = 'to_school' and t.status = 'in_progress' and ts.status = 'expected') )
```

In plain words:
- **Afternoon:** a parent sees the bus only while their child is on board.
- **Morning:** a parent sees the bus while it is coming for their child, and while their child is on board.
- After `dropped`, `missing` (no-show), `absent_reported` or the trip ending, the parent loses access.

## §3 Table policies

`admin(x)` = `private.is_school_admin(x)`, `staff(x)` = `private.is_school_staff(x)`.

| table | select | insert | update | delete |
|---|---|---|---|---|
| schools | `staff(id)` or `private.is_guardian_in_school(id)` | — | `admin(id)` | — |
| school_calendar | `staff(school_id)` or `is_guardian_in_school(school_id)` | `admin(school_id)` | `admin(school_id)` | `admin(school_id)` |
| profiles | `id = auth.uid()`, or the caller is an admin of a school where this profile has a membership or a guardian link (see note 1) | — | `id = auth.uid()`, columns `display_name, locale` only (note 2) | — |
| memberships | `user_id = auth.uid()` or `admin(school_id)` | — | — | `admin(school_id) and user_id <> auth.uid()` |
| staff_invites | `admin(school_id)` | — | — | `admin(school_id)` |
| students | `admin(school_id)` or `id in helper_student_ids()` or `id in my_student_ids()` | `admin(school_id)` | `admin(school_id)` | — |
| guardian_links | `admin(school_id)` or `guardian_user_id = auth.uid()` | `admin(school_id)` | `admin(school_id)`, columns `relationship, can_track, guardian_phone` only (note 2) | `admin(school_id)` |
| invite_codes | admin of the link's school | — | — | — |
| buses | `staff(school_id)` or `is_guardian_in_school(school_id)` | `admin(school_id)` | `admin(school_id)` | `admin(school_id)` |
| stops | `admin(school_id)` or `id in helper_stop_ids()` or `id in guardian_stop_ids()` | `admin(school_id)` | `admin(school_id)` | `admin(school_id)` |
| routes | `staff(school_id)` or route has an assignment of `my_student_ids()` | `admin(school_id)` | `admin(school_id)` | `admin(school_id)` |
| route_schedules | same as the parent route (via `exists` on routes) | admin of the route's school | the same | the same |
| route_stops | same as the parent route | admin of the route's school | the same | the same |
| student_assignments | admin of the student's school, `staff`, or `student_id in my_student_ids()` | admin of the student's school | the same | the same |
| trips | `admin(school_id)` or `helper_id = auth.uid()` or exists `trip_students` row of `my_student_ids()` | — | `admin(school_id)`, column `helper_id` only (note 2) | — |
| trip_students | admin of the trip's school, `is_trip_helper(trip_id)`, or `student_id in my_student_ids()` | — | — | — |
| trip_events | admin of the trip's school or `is_trip_helper(trip_id)` | — | — | — |
| client_actions | — (no policies; RPCs only) | — | — | — |
| bus_positions | `private.can_view_bus(trip_id)` | — | — | — |
| location_pings | admin of the trip's school | — | — | — |
| absence_reports | admin of the student's school or `student_id in my_student_ids()` | — | — | — |
| push_tokens | `user_id = auth.uid()` | — | — | `user_id = auth.uid()` |
| notification_outbox | `recipient_user_id = auth.uid()` | — | — | — |
| alerts | `admin(school_id)` | — | — | — |

**Note 1, profiles visible to admins.** Implement as a security-definer function `private.admin_can_see_profile(p_profile_id uuid)`. It is true if the caller is an admin of any school where `p_profile_id` has a membership, or is the `guardian_user_id` of a link in that school.

**Note 2, column-limited updates.**
- Revoke table-level `update` from `authenticated`, then grant update on only the listed columns: `grant update (display_name, locale) on public.profiles to authenticated;`.
- Do the same for `guardian_links` and `trips`.

**Storage (`student-photos` bucket)** policies on `storage.objects`:
- select: `admin` of the first path segment, or the second segment (`{student_id}.jpg` without the extension) is in `helper_student_ids()` or `my_student_ids()`.
- insert / update / delete: `admin` of the first path segment.

## §4 Grants

- `revoke all on all tables in schema public from anon;`. The `anon` role gets nothing.
- `revoke update, delete on public.trip_events from authenticated;`
- Service-only RPCs (listed in `rpc.md` §5): `revoke execute ... from public, anon, authenticated; grant execute ... to service_role;`
