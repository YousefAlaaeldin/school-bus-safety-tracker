# CLAUDE.md — School Bus Safety Tracker

Read this whole file before doing anything. It is short on purpose.

## What this project is
A UAE school-bus safety app. Bus helpers do roll call and tick children on and off the bus. Parents get notifications and live tracking. Schools get alerts.
- Mobile: Expo (React Native) app with helper + parent modes.
- Web: Next.js landing page + school dashboard.
- Backend: Supabase.
- Languages: **Arabic (RTL) and English** everywhere.

## Sources of truth, in priority order
1. `docs/contracts/*.md`: **exact** names of tables, columns, enums, RPCs, routes, i18n keys and env vars. Never rename or invent anything these define.
2. The task file you are executing (`tasks/phase-*.md`).
3. `IMPLEMENTATION_PLAN.md`: the background "why". If it disagrees with a contract, **the contract wins**.

## How to work: one task at a time
Follow `tasks/README.md`. Short version:
1. Open `tasks/STATUS.md` and pick the **first** unchecked `T` task whose dependencies are all checked. Skip `H` tasks, which are for the human.
2. Read **only** the files the task lists under "Read".
3. Do exactly the steps, and touch only the files listed.
4. Run the "Done when" command. It must pass.
5. Tick the task in `tasks/STATUS.md`, then commit: `git commit -m "T1.05: <task title>"`.
6. If a "Stop if" condition happens, or anything is unclear, **do not guess**. Write it in `tasks/BLOCKED.md` and stop.

## Repo layout
```
apps/mobile/            Expo app (expo-router). Screens in app/, logic in src/
apps/web/               Next.js App Router. Pages in src/app/[locale]/
packages/shared/        Pure TS: enums, DB types, phone utils, routing logic, offline queue, reducers
packages/i18n/          ar.json, en.json, notification renderer, time formatting
supabase/migrations/    SQL migrations (file names are fixed by the tasks)
supabase/tests/         pgTAP tests (*.test.sql)
supabase/functions/     Edge Functions (Deno). Pure helpers in _shared/
tools/                  Dev scripts (gps-replay, scenario tests)
```

## Commands (run from the repo root)
| Command | Does |
|---|---|
| `pnpm install` | Install everything |
| `pnpm typecheck` | TypeScript check across all packages |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (packages + supabase/functions/_shared) |
| `pnpm db:reset` | Recreate the local DB from migrations + seed |
| `pnpm db:test` | Run pgTAP tests (`supabase test db`) |
| `pnpm gen:types` | Regenerate `packages/shared/src/db.types.ts` |
| `pnpm i18n:sync` | Copy i18n files into `supabase/functions/_shared/i18n/` |

The local Supabase stack needs Docker Desktop running: `supabase start`.

## Coding rules
- **TypeScript strict** everywhere. No `any` unless a comment says why.
- **SQL**:
  - lowercase keywords are fine
  - every table has RLS enabled
  - every `security definer` function has `set search_path = ''` and fully-qualified names (`public.trips`, `auth.uid()`)
  - copy the RPC template in `docs/contracts/skeletons.md`
- **Never edit an existing migration** after its task is ticked. Add a new migration instead.
- **State changes go through RPCs**, never direct table updates from clients. This applies to trip/student status, invites and absences. Admin CRUD on roster tables may use direct table access (RLS allows it).
- **Errors from RPCs** are the codes in `docs/contracts/rpc.md` §Errors. Clients map them to `errors.<CODE>` i18n keys.
- **Text:**
  - **No hard-coded user-facing text.** Every string is an i18n key, added to **both** `packages/i18n/src/en.json` and `ar.json` in the same task. Write the Arabic yourself; a human reviews it later (task H5.1).
  - Arabic must be **gender-neutral** about the child: use passive/verbal-noun forms, e.g. "تم اصطحاب {{child}}".
- **RTL layout:**
  - **Mobile:** use `marginStart/End`, `paddingStart/End`, `start/end`, never `Left/Right`.
  - **Web:** use Tailwind logical classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`).
  - Mirror direction arrows. **Never mirror maps.**
- **Times:**
  - Store UTC (`timestamptz`). Display in `Asia/Dubai` using `formatTime` / `formatDate` from `packages/i18n`.
  - Digits are always Western (0–9). Times use 12-hour format (ص/م in Arabic, AM/PM in English).
- **Phones:** store E.164 (`+9715XXXXXXXX`). Use `normalizeUaePhone` (TS) / `private.normalize_phone` (SQL).
- **Weekdays:** `0 = Sunday … 6 = Saturday` everywhere, the same as Postgres `extract(dow)` and JS `getDay()`.
- **Pure logic goes in `packages/shared` or `packages/i18n`** with vitest tests. Screens stay thin.
- **No new dependencies** beyond the ones a task names. If you think you need one, write it in BLOCKED.md.
- **Secrets:** never commit a secret, and never put the service-role key in `apps/*`.

## Fixture IDs (from seed, used by tests)
See `docs/contracts/data-model.md` §Seed fixtures. Tests must use those exact UUIDs.
