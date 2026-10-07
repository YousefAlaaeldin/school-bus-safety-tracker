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

## Device checks pending
- T0.08: open the app in the Android emulator (`cd apps/mobile && npx expo start`, press `a`) and confirm it shows "OK". Android SDK/emulator was not set up when I ran this; the Android bundle builds and resolves @sst/shared and @sst/i18n.
- T0.09: rebuild dev client (eas build --profile development) before testing. Note: expo-localization's plugin now takes `supportsRTL` as an option, so I set it there as well as in `extra.supportsRTL`; the expo-location options match skeletons §5.
- T0.10: tap العربية on the phone/emulator; the app should reload with Arabic text, right-aligned (and back with English). If RTL does not flip in Expo Go, re-check in the dev build (H0.4).
- T1.35: landing screen looks right in both languages (device check).
- T1.37: sign in with +971500000003 / 123456 against local Supabase works (device check; use EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321 on the emulator).
- T1.38: sign in on device: +971500000003 -> parent home; +971500000002 -> helper home; +971500000005 -> pending; +971500000006 -> the role picked on the landing screen (admin-a@example.com via the staff screen after T1.42 -> admin home).
- T1.41: run `npx uri-scheme open saferide://invite/ABCD2345 --android` and confirm the invite screen opens with the code prefilled.
- T1.54-T1.60 (web dashboard): the browser extension was not connected, so I could not click through the UI. Please run `pnpm --filter @sst/web dev`, log in at http://localhost:3000/en/dashboard/login as admin-a@example.com / password123 and check: students list shows 5, student edit page + guardians panel work, CSV import with apps/web/public/roster-template.csv works.
<!-- executor adds "- T3.16: verify background pings arrive with screen locked" etc. -->
