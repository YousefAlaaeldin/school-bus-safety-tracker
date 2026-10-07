# Blocked / questions for the human

The executor appends entries here. The human answers inline, then deletes the entry once it is resolved.

Format:
```
## T1.07 — <title>
- Tried: …
- Error: …
- Question: …
- Answer (human): …
```

## T0.07 / T1.16 — note (no action needed unless you disagree)
- Phone sign-in locally needs an SMS provider enabled, even for test-OTP numbers (`phone_provider_disabled` otherwise). I enabled `[auth.sms.twilio]` in `supabase/config.toml` with **dummy** credentials; the test_otp numbers never send an SMS. The real Twilio setup is H6.2.
- I added `supabase` as a root devDependency (the CLI isn't on PATH on this machine), so `pnpm db:*` scripts work unchanged.

## T3.08 — resolved
- H0.4 is ticked (development build runs on the emulator), so T3.08 to T3.13, T3.19, T4.07 and T5.05 to T5.08 were done.

## T6.01 to T6.04 — blocked on human tasks
- T6.01 and T6.02 need H6.1 (decisions, domain), T6.03 needs H5.1 (Arabic review) and T6.04 needs H6.1 (final name) plus the logo at `assets/brand/icon-1024.png`.
- Tell me when H5.1 and H6.1 are ticked, or tell me to go ahead with placeholders.

## T5.02 — note (no action needed)
- The new security test found that Supabase's default privileges had left EXECUTE on 29 functions in schema `private` for `anon` and 16 for `authenticated`. They are not reachable through the API (schema not exposed), but I added migration `20260101005100_private_privileges.sql` to lock them down, as skeletons §2 intends. All earlier tests still pass.

## Device checks pending
- T0.08: open the app in the Android emulator (`cd apps/mobile && npx expo start`, press `a`) and confirm it shows "OK". Android SDK/emulator was not set up when I ran this; the Android bundle builds and resolves @sst/shared and @sst/i18n.
- T0.09: rebuild dev client (eas build --profile development) before testing. Note: expo-localization's plugin now takes `supportsRTL` as an option, so I set it there as well as in `extra.supportsRTL`; the expo-location options match skeletons §5.
- T0.10: tap العربية on the phone/emulator; the app should reload with Arabic text, right-aligned (and back with English). If RTL does not flip in Expo Go, re-check in the dev build (H0.4).
- T1.35: landing screen looks right in both languages (device check).
- T1.37: sign in with +971500000003 / 123456 against local Supabase works (device check; use EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321 on the emulator).
- T1.38: sign in on device: +971500000003 -> parent home; +971500000002 -> helper home; +971500000005 -> pending; +971500000006 -> the role picked on the landing screen (admin-a@example.com via the staff screen after T1.42 -> admin home).
- T1.41: run `npx uri-scheme open saferide://invite/ABCD2345 --android` and confirm the invite screen opens with the code prefilled.
- T1.54-T1.60 (web dashboard): the browser extension was not connected, so I could not click through the UI. Please run `pnpm --filter @sst/web dev`, log in at http://localhost:3000/en/dashboard/login as admin-a@example.com / password123 and check: students list shows 5, student edit page + guardians panel work, CSV import with apps/web/public/roster-template.csv works.
- T2.12: rebuild dev client (eas build --profile development) before testing (expo-sqlite, expo-location, netinfo added).
- T2.14: HELPER_A sees trips after running `select public.generate_trips(current_date)` in Studio on a weekday.
- T2.22: in airplane mode tap 3 boards, the badge shows 3; turn airplane mode off, it syncs to 0 and the server shows 3 events.
- T2.23: rebuild dev client (react-native-maps added). The map must render on Android (needs GOOGLE_MAPS_ANDROID_API_KEY in the build env) and iOS.
- T3.16 / T3.17 / T3.18: rebuild dev client (eas build --profile development): expo-task-manager background location, permissions, expo-intent-launcher, localized iOS strings. Then run H3.1 (background tracking + push on two phones).
- T5.03: rebuild dev client (Sentry native module). Set EXPO_PUBLIC_SENTRY_DSN in apps/mobile/.env when you have a Sentry project (also NEXT_PUBLIC_SENTRY_DSN / SENTRY_DSN for the web app); without a DSN Sentry does nothing.
<!-- executor adds "- T3.16: verify background pings arrive with screen locked" etc. -->
- T3.08: push tokens only work on a real device or an emulator with Google Play services AND an FCM `google-services.json` (EAS credentials). If the emulator shows no token row, test on a real Android phone. Check: `select * from push_tokens` after signing in.
- T3.09: tap a notification from the notification shade; it should open the live map (boarded, picked_up, eta_*) or the parent home.
- T3.10 to T3.13: sign in as +971500000003 (PARENT_1) after `select public.generate_trips(current_date)`. Home shows Sara and Omar with "Bus at ..."; board Sara from the helper phone and the card changes to "On Bus 12" with a Track button; Report absence and History open.
- T3.19: sign in as admin-a@example.com / password123 via the staff screen; the alerts list shows, Acknowledge works.
- T5.05 / T5.06: run the Maestro flows (apps/mobile/.maestro/README.md) in ar and en.
- T5.07: switch the emulator to airplane mode; the orange offline bar appears on parent and helper screens.

