# Contract: App routes, packages, env vars, routing logic

## §1 App identity (placeholders; the human changes them in H6.1)

| item | value |
|---|---|
| Display name | en `SafeRide`, ar `رحلة آمنة` |
| URL scheme | `saferide` |
| iOS bundle id / Android package | `ae.saferide.app` |
| Web domain | `saferide.example` (env `EXPO_PUBLIC_WEB_URL` / `NEXT_PUBLIC_SITE_URL`) |

These live in exactly two places: `packages/shared/src/app.ts` (`APP = {...}`) and `apps/mobile/app.config.ts`.

## §2 Packages (use these, nothing else without asking)

| where | packages |
|---|---|
| root | `typescript`, `typescript-eslint`, `vitest`, `eslint`, `prettier`, `@types/node`, `tsx` |
| packages/shared | `zod` |
| packages/i18n | (none) |
| apps/mobile | `expo-router`, `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `@tanstack/react-query`, `zustand`, `i18next`, `react-i18next`, `expo-localization`, `expo-sqlite`, `expo-location`, `expo-task-manager`, `expo-notifications`, `expo-device`, `expo-crypto`, `expo-image`, `expo-font`, `@expo-google-fonts/ibm-plex-sans-arabic`, `expo-web-browser`, `expo-linking`, `expo-updates`, `expo-intent-launcher`, `expo-constants`, `expo-splash-screen`, `react-native-safe-area-context`, `react-native-url-polyfill` (only if Supabase's Expo guide requires it), `@react-native-community/netinfo`, `react-native-maps` |
| apps/web | `next`, `react`, `react-dom`, `next-intl`, `@supabase/ssr`, `@supabase/supabase-js`, `tailwindcss`, `@vis.gl/react-google-maps`, `@dnd-kit/core`, `@dnd-kit/sortable`, `papaparse`, `@types/papaparse`, `zod` |
| tools/gps-replay, tools/scenario | `@supabase/supabase-js`, `vitest`, `tsx` |
| later (Phase 5) | `@sentry/react-native`, `@sentry/nextjs` |

Install with `npx expo install <pkg>` inside `apps/mobile` (this picks compatible versions), and `pnpm add` elsewhere.

## §3 Mobile routes (`apps/mobile/app/`, expo-router)

```
_layout.tsx                         Root: providers + AuthGate (§5)
(public)/_layout.tsx                Stack, no header
(public)/welcome.tsx                Landing: language toggle + 3 role cards
(public)/phone.tsx                  ?intent=parent|helper
(public)/otp.tsx                    ?intent=…&phone=+9715…
(public)/staff.tsx                  "Open web dashboard" button + email/password sign-in for alerts on this phone
(onboarding)/_layout.tsx
(onboarding)/invite.tsx             ?code= (optional prefill)
(onboarding)/pending.tsx            Waiting for school approval (+ "I have a code" button)
(onboarding)/not-registered.tsx
(onboarding)/choose-role.tsx
(parent)/_layout.tsx                Tabs: index, history, settings
(parent)/index.tsx                  Children cards
(parent)/history.tsx
(parent)/settings.tsx               Renders <SettingsScreen/>
(parent)/track/[tripId].tsx         Live map (stack screen above the tabs)
(parent)/absence.tsx                ?studentId=
(helper)/_layout.tsx                Stack
(helper)/index.tsx                  Today's trips
(helper)/settings.tsx               Renders <SettingsScreen/>
(helper)/permissions.tsx            Location permission explainer
(helper)/trip/[tripId]/index.tsx    Router: picks the right screen by direction and status
(helper)/trip/[tripId]/roll-call.tsx
(helper)/trip/[tripId]/drop.tsx
(helper)/trip/[tripId]/pickup.tsx
(helper)/trip/[tripId]/map.tsx
(admin)/_layout.tsx                 Tabs: index, settings
(admin)/index.tsx                   School alerts list (realtime) + acknowledge + "Open dashboard" button
(admin)/settings.tsx                Renders <SettingsScreen/>
invite/[code].tsx                   Deep link → stores code → goes to auth or onboarding/invite
```

**Notification tap routing** (data from `i18n.md` §6):
- Types `boarded`, `picked_up`, `eta_dropoff`, `eta_pickup` → `/(parent)/track/{trip_id}`
- Every other parent type → `/(parent)`
- Admin types (`roll_call_missing`, `trip_forced_end`, `lost_contact`, `stationary`, `overdue_trip`) → `/(admin)`

**Why admins have a mobile mode:** school alerts such as a missing child are delivered as push notifications. Push needs a device token, so school admins sign in on a phone (by email) and land on a simple alerts screen. Full management stays on the web dashboard.

## §4 Web routes (`apps/web/src/app/[locale]/`, locale ∈ `ar`, `en`; default `ar`)

```
page.tsx                            Landing (3 cards)
privacy/page.tsx  terms/page.tsx  support/page.tsx
invite/[code]/page.tsx              Try app deep link, else store buttons + code
dashboard/login/page.tsx            Email + password
dashboard/no-access/page.tsx
dashboard/(app)/layout.tsx          Guard (admin of ≥1 school) + shell
dashboard/(app)/page.tsx            Live board
dashboard/(app)/alerts/page.tsx
dashboard/(app)/trips/page.tsx                 Today's trips
dashboard/(app)/trips/[tripId]/page.tsx        Trip detail + audit timeline
dashboard/(app)/students/page.tsx
dashboard/(app)/students/new/page.tsx
dashboard/(app)/students/[studentId]/page.tsx  Edit + guardians panel
dashboard/(app)/import/page.tsx
dashboard/(app)/buses/page.tsx
dashboard/(app)/stops/page.tsx
dashboard/(app)/routes/page.tsx
dashboard/(app)/routes/[routeId]/page.tsx      Stops order, schedule, assignments
dashboard/(app)/staff/page.tsx
dashboard/(app)/calendar/page.tsx
dashboard/(app)/settings/page.tsx
```

Static files in `apps/web/public/.well-known/`: `apple-app-site-association`, `assetlinks.json` (T6.02).

**Current school:** the dashboard uses the first school where the user is admin. Store it in a cookie `school_id` if there is more than one; a switcher comes later.

## §5 Role resolution (`packages/shared/src/routing.ts`)

```ts
export type Intent = 'parent' | 'helper' | 'staff';
export type AppRole = 'parent' | 'helper' | 'admin';
export type MyContext = {
  memberships: { school_id: string; role: 'admin' | 'helper' }[];
  approved_links: number;
  pending_links: number;
};
export type Destination =
  | { kind: 'parentHome' } | { kind: 'helperHome' } | { kind: 'adminHome' }
  | { kind: 'invite' } | { kind: 'pending' } | { kind: 'notRegistered' }
  | { kind: 'chooseRole' };

export function intentToRole(intent: Intent): AppRole;   // parent→parent, helper→helper, staff→admin

export function availableRoles(ctx: MyContext): AppRole[];
// parent if approved_links > 0; helper if any membership.role === 'helper'; admin if any membership.role === 'admin'.
// Order: ['parent','helper','admin'].

export function resolveDestination(
  intent: Intent | null, ctx: MyContext, lastRole: AppRole | null
): { destination: Destination; mismatch: boolean };
```

Rules, checked in order:
1. roles = `availableRoles(ctx)`.
2. roles has 2 or more:
   - `lastRole` in roles → that role's home.
   - else `intent` is set and `intentToRole(intent)` is in roles → that home.
   - else `chooseRole`.
   - `mismatch: false` in all three cases.
3. roles has 1 → that role's home. `mismatch = intent !== null && intentToRole(intent) !== roles[0]`.
4. roles is empty:
   - `pending_links > 0` → `pending`
   - else `intent === 'parent'` → `invite`
   - else → `notRegistered`

   `mismatch: false` in all three cases.

Homes: `parentHome` → `/(parent)`, `helperHome` → `/(helper)`, `adminHome` → `/(admin)`.

The welcome screen stores `intent` in zustand, persisted to AsyncStorage as `intent`. `lastRole` is persisted as `lastRole` whenever a home screen mounts. The staff card's "Open web dashboard" button opens the browser and does not sign in.

## §6 Environment variables

| name | where | notes |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | apps/mobile/.env | From `supabase status` (API URL). On the Android emulator use `http://10.0.2.2:54321` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | apps/mobile/.env | The anon / publishable key from `supabase status` |
| `EXPO_PUBLIC_WEB_URL` | apps/mobile/.env | e.g. `http://localhost:3000` |
| `GOOGLE_MAPS_ANDROID_API_KEY` | EAS secret / local env at build time | Read in `app.config.ts` |
| `NEXT_PUBLIC_SUPABASE_URL` | apps/web/.env.local | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | apps/web/.env.local | |
| `NEXT_PUBLIC_SITE_URL` | apps/web/.env.local | |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | apps/web/.env.local | Maps JavaScript API |
| `NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_PLAY_STORE_URL` | apps/web/.env.local | `#` until published |
| `GOOGLE_ROUTES_API_KEY` | supabase/functions/.env | Routes API |
| `ROUTES_MOCK` | supabase/functions/.env | `1` = always use the straight-line fallback (local dev and tests) |
| `EXPO_ACCESS_TOKEN` | supabase/functions/.env | Optional (Expo push security) |
| `PUSH_MOCK` | supabase/functions/.env | `1` = don't call Expo; log and mark sent with fake ticket ids |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Edge runtime | Provided automatically by Supabase |
| `EXPO_PUBLIC_SENTRY_DSN` | apps/mobile/.env | Phase 5 |
| `NEXT_PUBLIC_SENTRY_DSN` | apps/web/.env.local | Phase 5 |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | tools/.env (local only) | Used by gps-replay and the scenario test. Local values from `supabase status` |

Every app has a committed `.env.example` listing its variables with dummy values. The real `.env*` files are in `.gitignore`.
