# Phase 0 — Setup

Goal: an empty monorepo where everything installs, type-checks and runs, with Arabic/English and RTL working from the first screen.

---

### H0.1 — Move the project to a path without spaces 👤
The current path `C:\Users\youse\R projects\school safety tracker` contains spaces. Spaces commonly break Android/Gradle builds and some CLI scripts.
- Move the folder to e.g. `C:\dev\school-safety-tracker`.
- Open the new folder in Claude Code from then on.

### H0.2 — Install tools on Windows 👤
Install these, then verify each in a new terminal:

| tool | verify with |
|---|---|
| Node.js LTS | `node -v` |
| pnpm (`npm i -g pnpm`) | `pnpm -v` |
| Git | `git --version` |
| Docker Desktop (with WSL2 backend), running | `docker ps` |
| Supabase CLI (via scoop: `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git` then `scoop install supabase`) | `supabase -v` |
| Android Studio + one emulator (Pixel, recent Android, Google Play image) | emulator boots |
| EAS CLI (`npm i -g eas-cli`) | `eas -v` |

On your iPhone, install nothing yet; development builds come in H0.4.

### H0.3 — Create accounts 👤
You can do these in parallel with Phase 0–2. They're needed by the phase shown.

| account | needed by |
|---|---|
| Expo account (free) | H0.4 |
| Google Cloud project. Enable *Maps SDK for Android*, *Maps JavaScript API*, *Routes API*, *Geocoding API*. Create API keys restricted per app. | T1.62, Phase 4 |
| Apple Developer Program (paid, annual) | H0.4 (iOS dev build) |
| Google Play Console (one-time fee) | Phase 6 |
| Supabase account (cloud project later) | Phase 6 |
| Twilio account (SMS OTP) | Phase 6. Local dev uses test OTPs |
| A domain name | T6.02 |
| Sentry account (free tier) | T5.03 |

Put API keys in the `.env` files described in `docs/contracts/app-routes-env.md` §6. **Never paste them into chat or commit them.**

---

### T0.01 — Git repo and root housekeeping files
- **Depends:** H0.1
- **Read:** `CLAUDE.md`
- **Files:** `.gitignore`, `.editorconfig`, `.gitattributes`, `README.md`
- **Steps:**
  1. Run `git init -b main` (skip if `.git` exists).
  2. `.gitignore` must include: `node_modules/`, `.env`, `.env.*` (but **not** `.env.example`; add the line `!.env.example`), `.expo/`, `dist/`, `.next/`, `ios/`, `android/`, `*.log`, `supabase/.temp/`, `supabase/.branches/`, `supabase/functions/.env`, `coverage/`.
  3. `.editorconfig`: utf-8, lf, 2 spaces, final newline.
  4. `.gitattributes`: `* text=auto eol=lf`.
  5. `README.md`: the project name, one paragraph, and "See IMPLEMENTATION_PLAN.md and tasks/README.md".
- **Done when:** `git status` lists these files.
- **Don't:** create package.json yet.

### T0.02 — pnpm workspace and root scripts
- **Depends:** T0.01
- **Read:** `CLAUDE.md` §Commands, `docs/contracts/app-routes-env.md` §2
- **Files:** `package.json`, `pnpm-workspace.yaml`, `.npmrc`
- **Steps:**
  1. `pnpm-workspace.yaml`: packages `apps/*`, `packages/*`, `tools/*`.
  2. Root `package.json`: `"private": true`, `"name": "school-safety-tracker"`, `"packageManager"` set to the installed pnpm version, and these scripts:
     ```
     "typecheck": "pnpm -r --if-present typecheck",
     "lint": "pnpm -r --if-present lint",
     "test": "vitest run",
     "db:reset": "supabase db reset",
     "db:test": "supabase test db",
     "gen:types": "supabase gen types typescript --local > packages/shared/src/db.types.ts",
     "i18n:sync": "tsx tools/scripts/i18n-sync.ts"
     ```
  3. Install root dev deps: `pnpm add -Dw typescript vitest eslint prettier @types/node tsx`.
  4. Open Expo's current **monorepo guide** (docs.expo.dev → "Work with monorepos") and set `.npmrc` as it recommends for pnpm. If the guide is unclear, use `node-linker=hoisted`.
- **Done when:** `pnpm install` succeeds.
- **Stop if:** the Expo guide says pnpm is unsupported.

### T0.03 — Shared TypeScript, ESLint and Prettier config
- **Depends:** T0.02
- **Files:** `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc`
- **Steps:**
  1. `tsconfig.base.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `target ES2022`, `module ESNext`, `moduleResolution Bundler`, `resolveJsonModule: true`, `skipLibCheck: true`, `esModuleInterop: true`.
  2. `eslint.config.mjs`: flat config using `typescript-eslint` recommended rules (`pnpm add -Dw typescript-eslint`). Ignore `**/dist`, `**/.next`, `**/.expo`, `supabase/functions/**`.
  3. `.prettierrc`: `{ "singleQuote": true, "printWidth": 100, "trailingComma": "all" }`.
- **Done when:** `pnpm exec eslint --version` works and `pnpm install` succeeds.

### T0.04 — `packages/shared` skeleton with enums
- **Depends:** T0.03
- **Read:** `docs/contracts/data-model.md` §1, `docs/contracts/app-routes-env.md` §1
- **Files:** `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`, `packages/shared/src/enums.ts`, `packages/shared/src/app.ts`
- **Steps:**
  1. `package.json`: name `@sst/shared`, `"main": "src/index.ts"`, `"types": "src/index.ts"`, script `"typecheck": "tsc --noEmit"`, dependency `zod`.
  2. `enums.ts`: for **every** enum in data-model §1, export a const array and a type with the exact values, e.g.:
     ```ts
     export const TRIP_DIRECTIONS = ['to_school', 'from_school'] as const;
     export type TripDirection = typeof TRIP_DIRECTIONS[number];
     ```
     Also export `RPC_ERROR_CODES` (the list from `rpc.md` §Errors) and the type `RpcErrorCode`.
  3. `app.ts`: `export const APP = { nameEn: 'SafeRide', nameAr: 'رحلة آمنة', scheme: 'saferide', bundleId: 'ae.saferide.app' } as const;`
  4. `index.ts` re-exports both.
- **Done when:** `pnpm typecheck` passes.

### T0.05 — `packages/i18n` skeleton with parity test
- **Depends:** T0.04
- **Read:** `docs/contracts/i18n.md` (all of it)
- **Files:** `packages/i18n/package.json`, `packages/i18n/tsconfig.json`, `packages/i18n/src/en.json`, `packages/i18n/src/ar.json`, `packages/i18n/src/index.ts`, `packages/i18n/src/parity.test.ts`
- **Steps:**
  1. `package.json`: name `@sst/i18n`, `main`/`types` → `src/index.ts`, script `typecheck`.
  2. `en.json` / `ar.json`: add the `common` keys listed in i18n §2, `common.appName` (SafeRide / رحلة آمنة), all `errors.*` keys (one per RPC error code, plus `NETWORK` and `UNKNOWN`), and **all `notif.*` templates exactly** as in i18n §4.
  3. `index.ts`: import both JSONs and export `resources = { en: { translation: en }, ar: { translation: ar } }` and `type Locale = 'ar' | 'en'`.
  4. `parity.test.ts` (vitest):
     - flatten both files to dotted keys
     - assert the key sets are equal
     - for each key, assert the set of `{{placeholders}}` is equal
- **Done when:** `pnpm test` passes. Then remove one key from `ar.json`, check the test fails, and put it back.

### T0.06 — Root vitest config
- **Depends:** T0.05
- **Files:** `vitest.config.ts`
- **Steps:** include `packages/**/src/**/*.test.ts`, `supabase/functions/_shared/**/*.test.ts` and `tools/scripts/**/*.test.ts`; environment `node`. Do **not** include `tools/scenario`; those tests need the local stack and run separately (T4.10).
- **Done when:** `pnpm test` runs the parity test and passes.

### T0.07 — Supabase init and local config
- **Depends:** T0.02, H0.2
- **Read:** `docs/contracts/data-model.md` §5 (Users table only)
- **Files:** `supabase/config.toml` (generated, then edited)
- **Steps:**
  1. `supabase init` (if asked about VS Code/Deno settings, answer no).
  2. In `config.toml`:
     - Set `project_id = "school-safety-tracker"`.
     - Under `[auth]`, set `site_url = "http://localhost:3000"`.
     - Under `[auth.email]`, set `enable_confirmations = false`.
     - Under `[auth.sms]`, set `enable_signup = true` and `enable_confirmations = false`.
  3. Add a test-OTP section mapping every phone in data-model §5 (without the `+`) to `"123456"`, e.g. `971500000003 = "123456"`.
  4. Run `supabase start`, then `supabase status`.
- **Done when:** `supabase status` shows the API URL and anon key.
- **Stop if:** the current Supabase docs/config template name the test-OTP section differently from `[auth.sms.test_otp]`, or phone sign-in locally requires an SMS provider. Follow the docs and note it in BLOCKED.md.

### T0.08 — Expo app scaffold
- **Depends:** T0.04, H0.2
- **Read:** `docs/contracts/app-routes-env.md` §2, §3
- **Files:** `apps/mobile/**` (generated)
- **Steps:**
  1. From `apps/`, run `npx create-expo-app@latest mobile --template default`. Use the TypeScript + expo-router template.
  2. Delete the example tabs/screens. Leave `app/_layout.tsx` (a Stack) and `app/index.tsx` showing the text "OK".
  3. In `apps/mobile/package.json`: name `@sst/mobile`, script `"typecheck": "tsc --noEmit"`, and add workspace deps `"@sst/shared": "workspace:*"` and `"@sst/i18n": "workspace:*"`.
  4. `tsconfig.json` extends `expo/tsconfig.base` and keeps `strict: true`.
  5. Follow Expo's monorepo guide for any Metro config needed.
  6. Run `pnpm install`, then `npx expo start` and press `a` to open the Android emulator in **Expo Go** (OK for now).
- **Done when:** `pnpm typecheck` passes and the emulator shows "OK". 📱 device check: the human confirms.
- **Stop if:** Metro can't resolve `@sst/shared`.

### T0.09 — App config, EAS profiles, env example
- **Depends:** T0.08
- **Read:** `docs/contracts/app-routes-env.md` §1, §6; `docs/contracts/skeletons.md` §5 (plugin entry only)
- **Files:** `apps/mobile/app.config.ts` (replace `app.json`), `apps/mobile/eas.json`, `apps/mobile/.env.example`
- **Steps:**
  1. Convert `app.json` to `app.config.ts`:
     - name `SafeRide`, slug `saferide`, scheme `saferide`
     - `ios.bundleIdentifier` and `android.package` = `ae.saferide.app`
     - `ios.supportsTablet: false`
     - `android.config.googleMaps.apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY`
     - plugins: `expo-router`, `expo-localization`, `expo-font`, the `expo-location` entry from skeletons §5, `expo-notifications`, `expo-task-manager`
     - `extra.supportsRTL: true`
  2. Install the plugin packages with `npx expo install expo-localization expo-font expo-location expo-notifications expo-task-manager expo-updates`.
  3. `eas.json` profiles:
     - `development`: `developmentClient: true`, `distribution: internal`
     - `preview`: `distribution: internal`
     - `production`
  4. `.env.example` with the `EXPO_PUBLIC_*` variables from §6.
- **Done when:** `npx expo config --type public` prints without errors, and `pnpm typecheck` passes.
- **Stop if:** the Expo docs say `extra.supportsRTL` is now configured differently (e.g. via the expo-localization plugin options). Use the documented way and note it.

### T0.10 — Mobile i18n + RTL bootstrap ⚠ hard
- **Depends:** T0.09, T0.05
- **Read:** `docs/contracts/i18n.md` §1–3, `CLAUDE.md` §Coding rules (RTL)
- **Files:** `apps/mobile/src/i18n/index.ts`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app/index.tsx`
- **Steps:**
  1. Install `npx expo install i18next react-i18next @react-native-async-storage/async-storage`.
  2. `src/i18n/index.ts`:
     - `initI18n()` reads AsyncStorage key `locale`. If none, use the device language (`getLocales()[0].languageCode === 'ar' ? 'ar' : 'en'`). Then init i18next with `resources` from `@sst/i18n`, `fallbackLng: 'en'`, `interpolation.escapeValue: false`.
     - If `I18nManager.isRTL !== (locale === 'ar')`, call `I18nManager.allowRTL`/`forceRTL` with the right value and reload once.
     - `setLanguage(locale)` saves to AsyncStorage, calls `changeLanguage`, and, if the direction changed, calls `forceRTL` and reloads.
     - **Reload:** use `Updates.reloadAsync()` from `expo-updates`, falling back to `DevSettings.reload()` when `__DEV__`.
  3. `_layout.tsx`: await `initI18n()` before rendering (show nothing until ready).
  4. `index.tsx`: show `t('common.appName')` and two buttons, العربية / English, that call `setLanguage`.
- **Done when:** `pnpm typecheck` passes. 📱 device check: tapping العربية reloads the app with Arabic text, right-aligned.
- **Stop if:** RTL doesn't flip after the reload in Expo Go. Note it, since this may only work in a development build (H0.4).

### T0.11 — Arabic font and base `Text` component
- **Depends:** T0.10
- **Files:** `apps/mobile/src/ui/Text.tsx`, `apps/mobile/src/ui/fonts.ts`, `apps/mobile/app/_layout.tsx`
- **Steps:**
  1. Install `npx expo install @expo-google-fonts/ibm-plex-sans-arabic`.
  2. Load the Regular, Medium and Bold weights in `_layout.tsx` (with `useFonts`) before rendering.
  3. `Text.tsx`: wraps RN `Text` with props `variant: 'title' | 'body' | 'caption' | 'button'` and `weight`. It uses IBM Plex Sans Arabic for **both** languages (it includes Latin glyphs) and `textAlign: 'auto'`.
  4. Replace the RN `Text` usage in `app/index.tsx` with this component.
- **Done when:** `pnpm typecheck` passes.

### T0.12 — Next.js scaffold with Tailwind
- **Depends:** T0.04
- **Files:** `apps/web/**` (generated)
- **Steps:**
  1. From `apps/`, run `pnpm create next-app@latest web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack`.
  2. Set name `@sst/web` and add workspace deps `@sst/shared` and `@sst/i18n`. Add scripts `typecheck: "tsc --noEmit"` and `lint`.
  3. Add `transpilePackages: ['@sst/shared', '@sst/i18n']` to `next.config`.
  4. `.env.example` with the `NEXT_PUBLIC_*` variables from app-routes-env §6.
- **Done when:** `pnpm --filter @sst/web build` succeeds.

### T0.13 — Web i18n routing (`ar` default, `en`), `dir` attribute
- **Depends:** T0.12, T0.05
- **Read:** `docs/contracts/app-routes-env.md` §4, `docs/contracts/i18n.md` §2
- **Files:** `apps/web/src/i18n/routing.ts`, `apps/web/src/i18n/request.ts`, `apps/web/src/middleware.ts`, `apps/web/src/app/[locale]/layout.tsx`, `apps/web/src/app/[locale]/page.tsx`
- **Steps:**
  1. `pnpm --filter @sst/web add next-intl`.
  2. Follow the current next-intl App Router guide: locales `['ar','en']`, `defaultLocale: 'ar'`. Messages come from `@sst/i18n` (en.json / ar.json).
  3. `layout.tsx`: `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>`. Load the IBM Plex Sans Arabic Google font via `next/font/google`.
  4. A temporary `page.tsx` showing `t('common.appName')` and a link to switch locale.
  5. Delete the default `src/app/page.tsx` / `layout.tsx` if next-intl's guide says to.
- **Done when:** `pnpm --filter @sst/web build` succeeds. `pnpm --filter @sst/web dev` serves `/ar` (RTL) and `/en` (LTR).

### T0.14 — CI workflow
- **Depends:** T0.06, T0.07
- **Files:** `.github/workflows/ci.yml`
- **Steps:** on push and pull_request, on ubuntu-latest:
  1. pnpm setup and Node LTS
  2. `pnpm install --frozen-lockfile`
  3. `pnpm typecheck`, `pnpm lint`, `pnpm test`
  4. `supabase/setup-cli` action, `supabase start`, `supabase test db`
- **Done when:** the YAML is valid (`pnpm dlx yaml-lint .github/workflows/ci.yml`, or skip if unavailable). It runs for real only once the human pushes to GitHub.

### H0.4 — First development builds on real devices 👤
1. `cd apps/mobile`, `eas login`, then `eas build:configure`.
2. Run `eas build --profile development --platform android`, and install the APK on the emulator or a phone.
3. Run `eas build --profile development --platform ios`. This needs the Apple Developer account; register your iPhone when prompted. Install it via the QR link.
4. `npx expo start --dev-client`. Both phones should open the app.
5. Re-check the T0.10 RTL toggle in the development build.
