# Phase 6 — Pilot and launch

Goal: one UAE school runs real trips, and the apps are in both stores.

The open business questions (who employs the helpers, which emirate, data residency) are settled here, in H6.1. **They do not block Phases 0–5.**

---

### H6.1 — Decisions 👤
Write the answers into `IMPLEMENTATION_PLAN.md` §11:
1. **Hosting:** is in-UAE data residency required by the pilot school or its regulator (KHDA / ADEK / SPEA / MoE)?
   - If yes: decide between a Supabase region that satisfies it, or self-hosting Supabase in a UAE cloud region.
   - Either way, the app code doesn't change; only T6.01 does.
2. **Pilot emirate and school.**
3. **Helpers:** employed by the school or a transport operator? If an operator, add an "operator" concept **after** the pilot. It is not needed to run the pilot.
4. **Final app name, bundle id and domain.** Then update `packages/shared/src/app.ts`, `apps/mobile/app.config.ts`, the env files and the i18n `common.appName`.
5. **Legal review** of the privacy policy and terms (UAE PDPL and the regulator's rules).

### H6.2 — Production SMS 👤
- In Twilio (or your chosen provider), register the UAE alphanumeric sender ID. Approval can take weeks, so start early.
- Optionally set up WhatsApp OTP.
- Enter the credentials in the Supabase project → Auth → Phone provider.

### T6.01 — Production deploy runbook
- **Depends:** H6.1
- **Files:** `docs/runbooks/deploy.md`
- **Steps:** write step-by-step commands for each of these:
  1. Create the Supabase project in the chosen region.
  2. `supabase link`, then `supabase db push`.
  3. `supabase functions deploy notify-dispatch push-receipts eta-tick`.
  4. `supabase secrets set GOOGLE_ROUTES_API_KEY=… EXPO_ACCESS_TOKEN=…` (no `ROUTES_MOCK`/`PUSH_MOCK` in production).
  5. Create the two Vault secrets by hand in the SQL editor (skeletons §4).
  6. Verify the cron jobs.
  7. Disable test OTPs, enable email confirmations, and set the site URL.
  8. Create the first admin: insert the school, then a `staff_invites` email row, then the admin signs up.
  9. Back up and restore settings.
  10. Rollback: how to revert a function deploy.

  For self-hosting, add a section with a pointer to the Supabase self-hosting docs. **Don't invent the details.**
- **Done when:** the file exists, and every command in it was checked against the current CLI help (`supabase <cmd> --help`).

### T6.02 — Universal links / App links
- **Depends:** H6.1 (domain), T1.53
- **Files:** `apps/web/public/.well-known/apple-app-site-association`, `apps/web/public/.well-known/assetlinks.json`, `apps/mobile/app.config.ts`
- **Steps:**
  1. **AASA:** `applinks` for the paths `/ar/invite/*` and `/en/invite/*`, with `appID` `<TEAMID>.ae.saferide.app`. Put `TEAMID` in as a placeholder and add a BLOCKED note for the human.
  2. **`assetlinks.json`:** package name + the SHA-256 fingerprint placeholder. The human gets it via `eas credentials`.
  3. **App config:** `ios.associatedDomains: ['applinks:<domain>']` and `android.intentFilters` with `autoVerify` for `https://<domain>/*/invite/*`.
  4. Serve the AASA with content type `application/json` (`next.config` headers).
  5. The mobile `invite/[code]` route must also handle the `https` path form. expo-router maps it if the paths match. Add `app/[locale]/invite/[code].tsx` that redirects to `invite/[code]`.
- **Done when:** the build succeeds and `npx expo config` shows the domains.

### T6.03 — Store listing metadata (ar + en)
- **Depends:** H5.1
- **Files:** `store/metadata/en.md`, `store/metadata/ar.md`, `store/privacy-answers.md`
- **Steps:**
  1. For each language: app name (≤ 30 characters), subtitle, short description (≤ 80), full description, keywords, support URL and privacy URL.
  2. `privacy-answers.md`: draft answers for the Apple privacy "nutrition label" and Google's Data safety form:
     - location: precise, collected only from helpers, during trips, shared with linked parents
     - phone number
     - name (children's names are provided by the school)
     - no ads, no tracking
  3. A **background location justification** paragraph for review notes, plus a demo account (HELPER test number) and instructions.
- **Done when:** the files exist. The human reviews them.

### T6.04 — Icons and splash config
- **Depends:** H6.1 (the final name; logo provided by the human as `assets/brand/icon-1024.png`)
- **Files:** `apps/mobile/app.config.ts`, `apps/mobile/assets/*`
- **Steps:** set `icon`, the `android.adaptiveIcon` foreground and background colour, and `splash` (use the `expo-splash-screen` plugin per the current docs). Use only the provided images. **Do not generate artwork.**
- **Done when:** `npx expo config` succeeds.
- **Stop if:** the brand image is missing.

### H6.3 — Production builds and store submission 👤
1. `eas build --profile production --platform all`.
2. `eas submit` to TestFlight and the Play internal testing track.
3. Fill in the listings from `store/metadata`. Upload screenshots (from the Maestro runs) in both languages.
4. Answer the privacy forms from `store/privacy-answers.md`.
5. Submit for review, adding the background-location justification and the demo account to the reviewer notes.

### H6.4 — Pilot onboarding 👤
1. Create the pilot school and the first admin (runbook T6.01 step 8).
2. The admin imports the roster (CSV), creates buses, stops (pins), routes, assignments and helpers, and prints invite codes for parents.
3. Hold a helper training session (30 min) on a school-provided phone set up per `IMPLEMENTATION_PLAN.md` §8.
4. **Run week 1 in shadow mode:** the helpers use the app, and the school keeps its old process too.
5. **Hold a daily 10-minute review** of the alerts inbox and `BLOCKED.md`. Collect feedback into a new file `tasks/phase-7-feedback.md`, in the same task format.
