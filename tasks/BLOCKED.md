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

## T0.07 — Supabase init and local config
- Tried: `supabase -v`. Docker works (`docker ps` OK).
- Error: `supabase: command not found` (H0.2 incomplete). T0.08 (Expo, needs Android emulator) is also waiting on H0.2.
- Question: Install the Supabase CLI (scoop: `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git` then `scoop install supabase`), open a new terminal and tell me. T0.08 (Expo scaffold) also needs Android Studio + emulator (H0.2). I did all the tasks that don't need either: T0.12, T0.13, T1.34, T2.10, T2.11, T3.01, T3.02, T3.04, T4.03, T4.04. Everything left depends on the Supabase CLI (T0.07) or the Expo app (T0.08).
- Answer (human):

## Device checks pending
<!-- executor adds "- T3.16: verify background pings arrive with screen locked" etc. -->
