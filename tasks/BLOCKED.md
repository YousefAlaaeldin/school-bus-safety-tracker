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

## T0.02 — pnpm workspace and root scripts
- Tried: Checked tools. `node -v` = v24.19.0 and npm 11.17.0 work, but `pnpm` is not installed (command not found). H0.2 is unticked.
- Error: `pnpm: command not found`
- Question: Run `npm i -g pnpm`, open a new terminal and check `pnpm -v`, then tell me to continue. Do you also want to tick H0.2 now, or only after Docker, Supabase CLI and the other tools are installed? (T0.02 to T0.06 only need pnpm.)
- Answer (human):

## Device checks pending
<!-- executor adds "- T3.16: verify background pings arrive with screen locked" etc. -->
