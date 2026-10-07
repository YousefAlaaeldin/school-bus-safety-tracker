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

## Device checks pending
- T0.08: open the app in the Android emulator (`cd apps/mobile && npx expo start`, press `a`) and confirm it shows "OK". Android SDK/emulator was not set up when I ran this; the Android bundle builds and resolves @sst/shared and @sst/i18n.
- T0.09: rebuild dev client (eas build --profile development) before testing. Note: expo-localization's plugin now takes `supportsRTL` as an option, so I set it there as well as in `extra.supportsRTL`; the expo-location options match skeletons §5.
<!-- executor adds "- T3.16: verify background pings arrive with screen locked" etc. -->
