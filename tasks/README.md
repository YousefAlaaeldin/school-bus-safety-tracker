# How to execute tasks

This folder breaks the whole project into small tasks that a small model, such as Claude Haiku, can do one at a time without making design decisions.

## Files
| file | what |
|---|---|
| `STATUS.md` | Checklist of every task, in order. **The single place to see progress.** |
| `BLOCKED.md` | Questions and blockers written by the executor for the human |
| `phase-0-setup.md` … `phase-6-launch.md` | The task details |
| `../docs/contracts/*.md` | Exact names and shapes. Tasks point into these with § references |
| `../CLAUDE.md` | Conventions (auto-loaded by Claude Code) |

## Task types
- **`T` tasks** are for the AI executor.
- **`H` tasks** are for the human: accounts, payments, store consoles, real-phone testing. The executor skips them, but **does not start a T task that depends on an unticked H task**.
- Tasks marked **📱 device check** need a human to confirm on a real phone after the executor finishes. The executor ticks the task and adds a line to `BLOCKED.md` under "Device checks pending".
- **Native changes need a new dev build.** If a task installs a native module (anything via `npx expo install` that has native code: sqlite, maps, location, notifications, task-manager, intent-launcher, Sentry, fonts, netinfo) or changes `app.config.ts` plugins or permissions, the executor adds this line to "Device checks pending": `- <task id>: rebuild dev client (eas build --profile development) before testing`. Until the rebuild, the app will show "native module not found". That's expected; the code isn't broken.

## Protocol for the executor (follow exactly)
1. Open `tasks/STATUS.md`. Find the **first** line `- [ ] T…` whose dependencies (listed in the phase file) are all `- [x]`.
2. Open the phase file and read that task **completely**.
3. Read every file listed under **Read**, and nothing else unless the task says so.
4. Do the **Steps** in order. Only create or modify files listed under **Files**. These files are always allowed too: `packages/i18n/src/en.json` and `ar.json` (for new keys), `package.json` and the lockfile (for the packages a step installs), `packages/shared/src/db.types.ts` (regenerated) and `tasks/STATUS.md` / `BLOCKED.md`.
5. Run the **Done when** command(s). If they fail, fix the problem within the task's files. After **3 failed attempts**, treat it as a blocker (step 7).
6. Tick the task in `STATUS.md`: `- [x] T…`. Commit everything:
   ```
   git add -A
   git commit -m "T1.05: Students & guardian tables"
   ```
7. **Blocked?** A "Stop if" condition happened, a needed name isn't in the contracts, a command fails 3 times, or a dependency is missing. In that case:
   - Append to `BLOCKED.md`: task id, what you tried, the exact error, and the question.
   - Do **not** tick the task. Stop and report.
8. One task per session is fine. Never do two tasks in one commit.

## Rules that prevent the most common mistakes
- **Do not rename anything** from the contracts. Not even "for consistency".
- **Do not add features**, extra screens, extra columns or extra packages that the task doesn't ask for.
- **Do not edit a migration from a ticked task.** Make a new migration file.
- **Do not skip tests** or weaken them to make them pass. If a test seems wrong, write it in BLOCKED.md.
- **Every user-visible string** goes into both `en.json` and `ar.json`.
- **Check the docs:** when a step says "check the current docs", actually open the docs (WebFetch) before writing code.

## How the human drives it
Open a Claude Code session in the repo folder (Haiku is fine) and say:

> Do the next task per tasks/README.md.

Repeat. Check `BLOCKED.md` every few tasks. Use a stronger model for tasks marked **⚠ hard**.
