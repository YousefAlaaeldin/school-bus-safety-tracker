# Phase 1b — App and web foundation (landing pages, sign-in, dashboard CRUD)

Goal:
- **Mobile:** a user picks "parent / helper / school staff" on the landing screen, signs in with a test OTP, and lands on the right (still empty) home screen.
- **Web:** the public landing page works, and a school admin can manage students, guardians, buses, stops, routes, staff and calendar.

Rules for every screen task:
- All text comes from i18n keys. Add them to `en.json` **and** `ar.json` under the namespace named in the task. `pnpm test` (parity) must pass.
- **RTL:** use logical properties only (`CLAUDE.md`).
- **Every mobile screen** handles three states: loading (spinner), error (`Banner` with the `errors.*` message and a Retry button), and empty (`EmptyState`).
- `pnpm typecheck` must pass at the end of every task.

---

## Mobile

### T1.30 — Supabase client (mobile)
- **Depends:** T1.25, T0.10
- **Read:** `docs/contracts/app-routes-env.md` §6
- **Files:** `apps/mobile/src/lib/supabase.ts`, `apps/mobile/.env.example`
- **Steps:**
  1. Install `npx expo install @supabase/supabase-js`.
  2. Open Supabase's current **Expo React Native quickstart** and follow its client setup: AsyncStorage storage, `detectSessionInUrl: false`, and AppState auto-refresh start/stop. If it requires `react-native-url-polyfill`, install it (allowed).
  3. Type the client: `createClient<Database>(...)`, with `Database` from `@sst/shared`.
  4. Export `supabase`, and a helper `rpcError(e: unknown): RpcErrorCode | 'NETWORK' | 'UNKNOWN'` that maps `error.message` to a known code.
- **Done when:** `pnpm typecheck` passes.

### T1.31 — Providers in the root layout
- **Depends:** T1.30
- **Files:** `apps/mobile/src/providers/AppProviders.tsx`, `apps/mobile/app/_layout.tsx`
- **Steps:**
  1. Install `npx expo install @tanstack/react-query zustand`.
  2. `AppProviders` wraps children in `QueryClientProvider` (retry 1, `staleTime` 15 s), `I18nextProvider` and `SafeAreaProvider`.
  3. The root layout renders `<AppProviders><Slot/></AppProviders>` after fonts and i18n are ready.
- **Done when:** `pnpm typecheck` passes and the app still opens.

### T1.32 — UI kit part 1: tokens, Screen, Button, Card
- **Depends:** T1.31, T0.11
- **Files:** `apps/mobile/src/ui/tokens.ts`, `apps/mobile/src/ui/Screen.tsx`, `apps/mobile/src/ui/Button.tsx`, `apps/mobile/src/ui/Card.tsx`
- **Steps:**
  1. `tokens.ts`:
     - colors (`primary #0B6E4F`, `danger #C62828`, `warning #ED6C02`, `success #2E7D32`, `bg #F7F7F5`, `surface #FFFFFF`, `text #1A1A1A`, `muted #6B6B6B`, `border #E2E2DE`)
     - spacing scale `[0,4,8,12,16,24,32]`
     - radius 12
     - Dark mode is not needed yet.
  2. `Screen`: SafeAreaView with `bg` and 16 px horizontal padding, with an optional `scroll` prop.
  3. `Button`: variants `primary | secondary | danger`, `loading` and `disabled` props, min height **56** (a big touch target for helpers on a moving bus), and an `accessibilityLabel` prop.
  4. `Card`: a surface with radius and border, and an optional `onPress`.
- **Done when:** `pnpm typecheck` passes.

### T1.33 — UI kit part 2: TextField, PhoneField, Banner, EmptyState, Spinner
- **Depends:** T1.32
- **Files:** `apps/mobile/src/ui/TextField.tsx`, `apps/mobile/src/ui/PhoneField.tsx`, `apps/mobile/src/ui/Banner.tsx`, `apps/mobile/src/ui/EmptyState.tsx`
- **Steps:**
  1. `PhoneField`: a fixed `+971` prefix shown LTR (`writingDirection: 'ltr'`) even in Arabic, a numeric keyboard, and an `onChangeE164(value | null)` callback that uses `normalizeUaePhone` + `isUaeMobile` from `@sst/shared`.
  2. `Banner`: `kind: 'error' | 'warning' | 'info' | 'success'`, a message, and an optional action button.
  3. Export `Spinner` from `EmptyState.tsx` (a centered ActivityIndicator).
- **Done when:** `pnpm typecheck` passes.

### T1.34 — Role resolution logic (pure + tests)
- **Depends:** T0.06
- **Read:** `docs/contracts/app-routes-env.md` §5
- **Files:** `packages/shared/src/routing.ts`, `packages/shared/src/routing.test.ts`, `packages/shared/src/index.ts`
- **Tests:** one per rule in §5. For example:
  - helper + parent with `lastRole` helper → helperHome
  - helper + parent, no lastRole, intent parent → parentHome
  - helper + parent, no lastRole, no intent → chooseRole
  - parent only, with intent helper → parentHome with `mismatch: true`
  - admin only, with intent staff → adminHome with `mismatch: false`
  - admin + helper, intent staff → adminHome
  - nothing, but `pending_links: 1` → pending
  - nothing, with intent parent → invite
  - nothing, with intent helper → notRegistered
- **Done when:** `pnpm test` passes.

### T1.35 — Welcome (landing) screen
- **Depends:** T1.33
- **Read:** `IMPLEMENTATION_PLAN.md` §7.0 (the mobile box), app-routes-env §3, §5
- **Files:** `apps/mobile/app/(public)/_layout.tsx`, `apps/mobile/app/(public)/welcome.tsx`, `apps/mobile/src/state/session.ts`
- **Steps:**
  1. `session.ts`: a zustand store persisted to AsyncStorage with `intent: Intent | null`, `lastRole: AppRole | null`, and their setters.
  2. Layout, top to bottom:
     - a language toggle row (`العربية | English`) at the top end, calling `setLanguage`
     - the app name and a tagline
     - three `Card`s with icon, title and subtitle, for parent, helper and staff
  3. The parent and helper cards set `intent` and navigate to `/(public)/phone?intent=…`.
  4. The staff card navigates to `/(public)/staff` (built in T1.42).
  5. i18n keys: `welcome.tagline`, `welcome.parentTitle`, `welcome.parentSubtitle`, `welcome.helperTitle`, `welcome.helperSubtitle`, `welcome.staffTitle`, `welcome.staffSubtitle`.
- **Done when:** `pnpm typecheck` passes. 📱 device check: the landing screen looks right in both languages.

### T1.36 — Phone entry screen
- **Depends:** T1.35
- **Files:** `apps/mobile/app/(public)/phone.tsx`
- **Steps:**
  1. Title, explainer, a `PhoneField`, and a Continue button (disabled until the number is valid).
  2. On press: `supabase.auth.signInWithOtp({ phone })`, then navigate to `/(public)/otp?phone=…&intent=…`.
  3. Map errors to a `Banner`.
  4. i18n keys: `auth.phoneTitle`, `auth.phoneHelp`, `auth.continue`, `auth.invalidPhone`.
- **Done when:** `pnpm typecheck` passes.

### T1.37 — OTP screen
- **Depends:** T1.36
- **Files:** `apps/mobile/app/(public)/otp.tsx`
- **Steps:**
  1. A 6-digit input (LTR, `textContentType="oneTimeCode"`, `autoComplete="sms-otp"`).
  2. It auto-submits at 6 digits: `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`.
  3. A resend button with a 30 s countdown.
  4. On success, do nothing else; the AuthGate (T1.38) routes the user.
  5. i18n keys: `auth.otpTitle`, `auth.otpHelp` (with `{{phone}}`), `auth.resend`, `auth.resendIn` (with `{{seconds}}`), `auth.wrongCode`.
- **Done when:** `pnpm typecheck` passes. 📱 device check: signing in with `+971500000003` / `123456` works against local Supabase.

### T1.38 — AuthGate: routing after sign-in ⚠ hard
- **Depends:** T1.37, T1.34, T1.20
- **Read:** app-routes-env §3, §5
- **Files:** `apps/mobile/src/auth/AuthGate.tsx`, `apps/mobile/src/auth/useMyContext.ts`, `apps/mobile/app/_layout.tsx`
- **Steps:**
  1. `useMyContext()` is a react-query hook, key `['my-context']`, that calls `rpc('get_my_context')`. It is enabled only when a session exists.
  2. `AuthGate` listens to `supabase.auth.onAuthStateChange` and:
     - **no session** → `router.replace('/(public)/welcome')` unless already in `(public)` or on `invite/[code]`
     - **session** → wait for the context, then compute `resolveDestination(intent, ctx, lastRole)` and `router.replace(...)`:

       | destination | route |
       |---|---|
       | parentHome | `/(parent)` |
       | helperHome | `/(helper)` |
       | invite | `/(onboarding)/invite` |
       | pending | `/(onboarding)/pending` |
       | notRegistered | `/(onboarding)/not-registered` |
       | chooseRole | `/(onboarding)/choose-role` |
       | adminHome | `/(admin)` |
  3. If `mismatch` is true, show a one-time toast/Banner with `onboarding.roleMismatch` (with `{{role}}`).
  4. Sync language: if `ctx.profile.locale` differs from the app language, call `rpc('set_my_locale', { p_locale: appLanguage })`. The device choice wins.
  5. Create placeholder `app/(parent)/index.tsx`, `app/(helper)/index.tsx` and `app/(admin)/index.tsx` that show their titles via i18n keys `parent.home.title`, `helper.home.title` and `admin.home.title`. Add the minimal `_layout.tsx` files for all three groups (add these 6 files to this task's files).
- **Done when:** `pnpm typecheck` passes. 📱 device check:
  - +971500000003 → parent home
  - +971500000002 → helper home
  - +971500000005 → pending
  - +971500000006 → whichever role was picked on the landing screen
  - admin-a@example.com via the staff screen (after T1.42) → admin home

### T1.39 — Onboarding screens
- **Depends:** T1.38, T1.21
- **Files:** `apps/mobile/app/(onboarding)/_layout.tsx`, `apps/mobile/app/(onboarding)/invite.tsx`, `apps/mobile/app/(onboarding)/pending.tsx`, `apps/mobile/app/(onboarding)/not-registered.tsx`, `apps/mobile/app/(onboarding)/choose-role.tsx`
- **Steps:**
  1. **invite:** a code input (uppercase, 8 chars, LTR). Submit calls `redeem_invite`. On success, invalidate `['my-context']` (the gate re-routes). Map errors `INVITE_*`.
  2. **pending:** explains that the school must approve, with a button "I have an invite code" → invite, plus a "Check again" button that refetches the context.
  3. **not-registered:** explains "Ask your school to add your number", shows the number in use, and has a sign-out button.
  4. **choose-role:** two Cards (parent / helper). Picking one sets `lastRole` and routes.
  5. Every screen has a sign-out link.
  6. Keys go under `onboarding.*`.
- **Done when:** `pnpm typecheck` passes.

### T1.40 — Settings screen (shared)
- **Depends:** T1.39
- **Files:** `apps/mobile/src/screens/SettingsScreen.tsx`, `apps/mobile/app/(parent)/settings.tsx`, `apps/mobile/app/(helper)/settings.tsx`
- **Steps:**
  1. Sections:
     - language (two radio rows)
     - "Switch role": one row per other role in `availableRoles` (only if there are 2 or more). It sets `lastRole` and routes to that home.
     - the signed-in phone or email
     - sign out
  2. Sign out clears `lastRole`, calls `unregister_push_token` (wrap in try; that RPC may not exist until T3.08), then `signOut()`.
  3. Keys go under `settings.*`.
- **Done when:** `pnpm typecheck` passes.

### T1.41 — Invite deep link route
- **Depends:** T1.39
- **Files:** `apps/mobile/app/invite/[code].tsx`, `apps/mobile/src/state/session.ts`
- **Steps:**
  1. Add `pendingInviteCode` to the session store.
  2. The route saves the code. If there's no session, it sets `intent = 'parent'` and goes to phone. If there's a session, it goes to `/(onboarding)/invite?code=…`.
  3. `invite.tsx` prefills from the param or the store, then clears the store.
- **Done when:** `pnpm typecheck` passes. Check with `npx uri-scheme open saferide://invite/ABCD2345 --android` (📱 device check).

### T1.42 — Staff screen: web dashboard + sign in for alerts
- **Depends:** T1.38
- **Read:** app-routes-env §3 (`(public)/staff.tsx` and "Why admins have a mobile mode"), §5
- **Files:** `apps/mobile/app/(public)/staff.tsx`
- **Steps:**
  1. Install `npx expo install expo-web-browser`.
  2. **Top:** an explainer and an **Open web dashboard** button → `WebBrowser.openBrowserAsync(`${EXPO_PUBLIC_WEB_URL}/${locale}/dashboard`)`. This button does not sign in or change `intent`.
  3. **Below:** "Get school alerts on this phone", with email and password fields and a Sign in button. It sets `intent = 'staff'`, then calls `supabase.auth.signInWithPassword`. The AuthGate routes to `/(admin)`.
  4. Map errors to a Banner.
  5. Keys go under `auth.staff.*`.
- **Done when:** `pnpm typecheck` passes.

---

## Web

### T1.50 — Supabase clients for Next.js
- **Depends:** T0.13, T1.25
- **Files:** `apps/web/src/lib/supabase/client.ts`, `apps/web/src/lib/supabase/server.ts`, `apps/web/src/middleware.ts`
- **Steps:**
  1. `pnpm --filter @sst/web add @supabase/ssr @supabase/supabase-js`.
  2. Follow Supabase's current **"Server-Side Auth for Next.js"** guide: a browser client, a server client (cookies), and session refresh in middleware.
  3. **Combine** that middleware with the next-intl middleware from T0.13 (run next-intl, then refresh the Supabase session on the same response).
  4. Type both clients with `Database`.
- **Done when:** `pnpm --filter @sst/web build` succeeds.
- **Stop if:** the guide's middleware pattern can't be combined with next-intl. Describe the conflict.

### T1.51 — Web landing page
- **Depends:** T1.50
- **Read:** `IMPLEMENTATION_PLAN.md` §7.0 (the website table)
- **Files:** `apps/web/src/app/[locale]/page.tsx`, `apps/web/src/components/LocaleSwitch.tsx`, `apps/web/src/components/StoreButtons.tsx`
- **Steps:**
  1. **Header:** logo text and `LocaleSwitch` (links to the same path in the other locale).
  2. **Hero:** headline and subline.
  3. **Three cards in a responsive grid** (1 column on mobile, 3 on desktop):
     - **Parents:** short benefit list + `StoreButtons` (from the `NEXT_PUBLIC_*_STORE_URL` env).
     - **Bus helpers:** benefits + `StoreButtons` + the note "your school registers your number".
     - **Schools:** benefits + a primary button "Sign in to dashboard" → `/{locale}/dashboard/login`, and a secondary "Request a demo" → `mailto:` (`landing.demoEmail` key, placeholder `hello@saferide.example`).
  4. **"How it works":** 4 steps.
  5. **Footer:** links to privacy, terms, support.
  6. Use Tailwind logical classes only. Keys go under `landing.*`.
- **Done when:** `pnpm --filter @sst/web build` succeeds. Check both `/ar` and `/en` at 375 px and 1280 px wide (dev server).

### T1.52 — Privacy, terms, support pages
- **Depends:** T1.51
- **Files:** `apps/web/src/app/[locale]/privacy/page.tsx`, `apps/web/src/app/[locale]/terms/page.tsx`, `apps/web/src/app/[locale]/support/page.tsx`
- **Steps:**
  1. Each page has the structured headings and placeholder paragraphs from keys `legal.privacy.*`, `legal.terms.*` and `legal.support.*`.
  2. Privacy must have sections for: what we collect (names, phone numbers, bus location during trips only), who sees it, retention, children's data, contact, and the governing law placeholder.
  3. Add a visible banner on each page: `legal.draftNotice` ("Draft — pending legal review").
- **Done when:** the build succeeds.

### T1.53 — Invite link page
- **Depends:** T1.51
- **Files:** `apps/web/src/app/[locale]/invite/[code]/page.tsx`, `apps/web/src/app/[locale]/invite/[code]/OpenApp.tsx`
- **Steps:**
  1. A client component tries `window.location.href = 'saferide://invite/{code}'` on mount.
  2. After 1.5 s it shows: the code in large LTR monospace, "Install the app, then enter this code", and `StoreButtons`.
  3. Keys go under `landing.invite.*`.
- **Done when:** the build succeeds.

### T1.54 — Dashboard login and access guard
- **Depends:** T1.50, T1.16
- **Files:** `apps/web/src/app/[locale]/dashboard/login/page.tsx`, `apps/web/src/app/[locale]/dashboard/no-access/page.tsx`, `apps/web/src/lib/auth/requireAdmin.ts`
- **Steps:**
  1. **Login page:** an email + password form. It calls `signInWithPassword`, then redirects to `/{locale}/dashboard`. Show an error banner on failure.
  2. **`requireAdmin()` (server):** gets the user, then queries `memberships` for role `admin`.
     - no user → redirect to login
     - no admin membership → redirect to no-access
     - otherwise returns `{ user, schoolId }`, choosing the school from cookie `school_id` if valid, else the first one
  3. **No-access page:** a message and a sign-out button.
  4. Keys go under `dashboard.auth.*`.
- **Done when:** the build succeeds. Manually: `admin-a@example.com` / `password123` logs in.
- **Stop if:** the seeded admin can't log in. Check the `auth.identities` note in T1.16.

### T1.55 — Dashboard shell layout
- **Depends:** T1.54
- **Files:** `apps/web/src/app/[locale]/dashboard/(app)/layout.tsx`, `apps/web/src/components/dashboard/Sidebar.tsx`, `apps/web/src/app/[locale]/dashboard/(app)/page.tsx`
- **Steps:**
  1. The layout calls `requireAdmin()` and renders a sidebar on the **start** side, collapsing to a top menu under 768 px.
  2. Nav items, in this order: Live board, Alerts, Today's trips, Students, Import, Buses, Stops, Routes, Staff, Calendar, Settings.
  3. The top bar shows the school name (in the current locale), `LocaleSwitch` and sign out.
  4. `page.tsx` is a placeholder "Live board" (built in T4.08).
  5. Keys go under `dashboard.nav.*`.
- **Done when:** the build succeeds.

### T1.56 — Dashboard UI kit
- **Depends:** T1.55
- **Files:** `apps/web/src/components/ui/Button.tsx`, `apps/web/src/components/ui/Input.tsx`, `apps/web/src/components/ui/Table.tsx`, `apps/web/src/components/ui/Dialog.tsx`, `apps/web/src/components/ui/Badge.tsx`
- **Steps:**
  1. Minimal Tailwind components:
     - `Button` with variants
     - `Input` with label and error
     - `Table` with header and rows, plus empty-state support
     - `Dialog` using the native `<dialog>` element
     - `Badge` with a color per status
  2. Export a `statusBadgeColor(status)` mapping for all `student_trip_status` and `trip_status` values.
- **Done when:** the build succeeds.

> **Pattern for T1.57–T1.68.**
> - **Reads:** server components read via the server client.
> - **Writes:** client components write via the browser client (direct table writes are allowed for admins by RLS), or via the named RPC.
> - **After a write:** call `router.refresh()`.
> - **Errors:** show them in a banner using `errors.*` keys.
> - **Keys:** under `dashboard.<page>.*`.

### T1.57 — Students list
- **Depends:** T1.56
- **Files:** `apps/web/src/app/[locale]/dashboard/(app)/students/page.tsx`
- **Steps:**
  1. A table with name (in the current locale), grade, guardian count with pending count, an active badge, and an edit link.
  2. Search by name (`?q=`, `ilike` on both name columns).
  3. A "New student" button.
- **Done when:** the build succeeds; manually, 5 students are shown for ADMIN_A.

### T1.58 — Student create/edit + photo upload
- **Depends:** T1.57
- **Files:** `apps/web/src/app/[locale]/dashboard/(app)/students/new/page.tsx`, `apps/web/src/app/[locale]/dashboard/(app)/students/[studentId]/page.tsx`, `apps/web/src/components/dashboard/StudentForm.tsx`
- **Steps:**
  1. Fields: `name_en`, `name_ar` (`dir="rtl"` input), grade, active.
  2. Validate with zod (both names required).
  3. Photo: a file input that uploads to `student-photos/{school_id}/{student_id}.jpg` (upsert), then sets `photo_path`.
  4. Show the current photo via a signed URL.
- **Done when:** the build succeeds.

### T1.59 — Guardians panel
- **Depends:** T1.58, T1.21
- **Files:** `apps/web/src/components/dashboard/GuardiansPanel.tsx`, `apps/web/src/app/[locale]/dashboard/(app)/students/[studentId]/page.tsx`
- **Steps:** on the student page, list the student's guardian_links with phone (LTR), relationship, a status badge, "signed up?" (`guardian_user_id` not null), and `can_track`. Actions:
  - **Add guardian:** phone + relationship → insert.
  - **Approve:** only if signed up and pending → `approve_guardian_link`.
  - **Create invite code:** `create_invite` → a dialog showing the code large, the link `{SITE_URL}/{locale}/invite/{code}`, and a Print button (`window.print`).
  - **Toggle can_track:** update.
  - **Revoke:** a confirm dialog, then `revoke_guardian_link`.
- **Done when:** the build succeeds.

### T1.60 — Roster CSV import
- **Depends:** T1.57, T1.24
- **Files:** `apps/web/src/app/[locale]/dashboard/(app)/import/page.tsx`, `apps/web/src/components/dashboard/RosterImport.tsx`, `apps/web/public/roster-template.csv`
- **Steps:**
  1. Template header: `name_en,name_ar,grade,guardian_phone,relationship,guardian2_phone,relationship2`, plus 2 example rows.
  2. Parse with papaparse (header mode, UTF-8; Arabic must survive).
  3. Show a preview table.
  4. Import calls `import_roster`. If `errors` come back, highlight those rows with the `dashboard.import.errors.<CODE>` message.
- **Done when:** the build succeeds.

### T1.61 — Buses page
- **Depends:** T1.56
- **Files:** `apps/web/src/app/[locale]/dashboard/(app)/buses/page.tsx`, `apps/web/src/components/dashboard/BusForm.tsx`
- **Steps:** a list plus a create/edit dialog with `label_en`, `label_ar`, plate and capacity. Delete only if the bus has no routes (catch the FK error → a friendly message).
- **Done when:** the build succeeds.

### T1.62 — Stops page with map pin picker
- **Depends:** T1.56, H0.3 (Maps JavaScript API key)
- **Files:** `apps/web/src/app/[locale]/dashboard/(app)/stops/page.tsx`, `apps/web/src/components/dashboard/StopForm.tsx`, `apps/web/src/components/maps/PinPicker.tsx`
- **Steps:**
  1. `PinPicker` uses `@vis.gl/react-google-maps`:
     - a map centered on the school stop, or Dubai `25.2048, 55.2708`
     - a click sets a draggable marker
     - outputs `{lat, lng}`
  2. The form has `label_en`, `label_ar`, area, building, `makani_number` (10 digits, optional), landmark notes, `is_school` and the pin.
  3. Save: insert/update with `location` as WKT `POINT(lng lat)` (PostgREST accepts `'SRID=4326;POINT(lng lat)'`).
  4. The list shows labels and area.
- **Done when:** the build succeeds.
- **Stop if:** PostgREST rejects the WKT string for geography. Ask whether to add a small `upsert_stop` RPC instead.

### T1.63 — Routes list and create
- **Depends:** T1.61, T1.62
- **Files:** `apps/web/src/app/[locale]/dashboard/(app)/routes/page.tsx`, `apps/web/src/components/dashboard/RouteForm.tsx`
- **Steps:**
  1. List columns: name, direction badge (Morning/Afternoon), bus, default helper and active.
  2. The create form has `name_en`, `name_ar`, direction, bus (select), default helper (select from helper memberships + profiles) and active.
- **Done when:** the build succeeds.

### T1.64 — Route detail: stop order and weekly schedule
- **Depends:** T1.63
- **Files:** `apps/web/src/app/[locale]/dashboard/(app)/routes/[routeId]/page.tsx`, `apps/web/src/components/dashboard/RouteStopsEditor.tsx`, `apps/web/src/components/dashboard/RouteScheduleEditor.tsx`
- **Steps:**
  1. **Stops editor:**
     - Add a stop from a select and remove a stop.
     - Drag to reorder with `@dnd-kit/sortable`.
     - Save rewrites `route_stops`. To avoid unique conflicts on `(route_id, sequence)`, delete all of the route's rows, then insert with `sequence` 1…n.
     - Warn if a from_school route doesn't start at an `is_school` stop, or a to_school route doesn't end at one.
  2. **Schedule editor:** 7 rows (Sun–Sat, localized) with a checkbox and a time input. Save upserts or deletes `route_schedules`.
- **Done when:** the build succeeds.

### T1.65 — Assignments on route detail
- **Depends:** T1.64
- **Files:** `apps/web/src/components/dashboard/RouteAssignments.tsx`, `apps/web/src/app/[locale]/dashboard/(app)/routes/[routeId]/page.tsx`
- **Steps:**
  1. A table of assigned students with their stop and weekday chips.
  2. "Assign student": student select, stop select (only this route's stops), weekday checkboxes (default Mon–Fri), and `valid_from`.
  3. Edit and remove.
  4. Show the trigger error `INVALID_INPUT` as "stop is not on this route".
- **Done when:** the build succeeds.

### T1.66 — Staff page
- **Depends:** T1.56, T1.21
- **Files:** `apps/web/src/app/[locale]/dashboard/(app)/staff/page.tsx`, `apps/web/src/components/dashboard/InviteStaffForm.tsx`
- **Steps:**
  1. Two tables:
     - members (name, phone/email, role, remove → `remove_staff`)
     - pending invites (phone/email, role, created; delete)
  2. Invite form: role select. Helper needs a phone (UAE), admin needs an email. It calls `invite_staff`.
- **Done when:** the build succeeds.

### T1.67 — Calendar page
- **Depends:** T1.56
- **Files:** `apps/web/src/app/[locale]/dashboard/(app)/calendar/page.tsx`, `apps/web/src/components/dashboard/CalendarDayForm.tsx`
- **Steps:**
  1. List upcoming `school_calendar` rows.
  2. The add/edit form has date, type, note and the two optional override times (shown only for `early_dismissal` / `ramadan_hours`).
  3. Show the school's weekend days (read-only here; they're edited in Settings).
- **Done when:** the build succeeds.

### T1.68 — School settings page
- **Depends:** T1.56
- **Files:** `apps/web/src/app/[locale]/dashboard/(app)/settings/page.tsx`, `apps/web/src/components/dashboard/SchoolSettingsForm.tsx`
- **Steps:**
  1. Fields: `name_ar`, `name_en`, emirate (select), weekend days (7 checkboxes), `notify_parent_on_missing`, `eta_alert_minutes` (1–60), `absence_cutoff_minutes`, `location_retention_days` (1–365) and `drop_distance_warning_m`.
  2. Validate with zod using the same bounds as the DB checks.
- **Done when:** the build succeeds.
