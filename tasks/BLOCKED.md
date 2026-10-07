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

## T0.05 — packages/i18n skeleton with parity test
- Tried: Created packages/i18n (package.json, tsconfig, index.ts, en.json, ar.json, parity.test.ts). Copied the `notif.*` templates exactly from docs/contracts/i18n.md §4. Typecheck passes.
- Error: parity test fails: `notif.returned_to_school.body: expected [ 'bus' ] to deeply equal [ 'bus', 'child' ]`. The frozen en body uses `{{child}}` ("Drop-off was not possible. {{child}} is returning to school on {{bus}}...") but the frozen ar body does not ("تعذّر الإنزال، وتتم الإعادة إلى المدرسة على متن {{bus}}. ستتواصل معك المدرسة.").
- Question: The templates are frozen and the test must not be weakened, so I stopped. Which fix do you want? (a) change the ar body to include `{{child}}` (e.g. "تعذّر الإنزال، وتتم إعادة {{child}} إلى المدرسة على متن {{bus}}. ستتواصل معك المدرسة."), or (b) remove `{{child}}` from the en body, or (c) allow this one key as an exception in the test. I recommend (a). The work is in the tree, uncommitted, and the task is not ticked.
- Answer (human):

## Device checks pending
<!-- executor adds "- T3.16: verify background pings arrive with screen locked" etc. -->
