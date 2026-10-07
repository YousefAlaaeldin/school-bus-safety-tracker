# Maestro flows

UI flows that drive the real app on an emulator or phone. They need a **development build** (see H0.4) and the local
Supabase stack running (`pnpm exec supabase start` from the repo root). The seeded test users and the OTP `123456`
come from `supabase/seed.sql` and `supabase/config.toml`.

## Install Maestro (Windows)

Maestro's CLI runs on macOS, Linux and WSL; on Windows use **WSL 2**:

1. Install WSL with Ubuntu (PowerShell as admin): `wsl --install -d Ubuntu`, then reboot.
2. In Ubuntu: `curl -fsSL "https://get.maestro.mobile.dev" | bash` and `export PATH="$PATH:$HOME/.maestro/bin"`.
3. Install Java 17+ in Ubuntu: `sudo apt install openjdk-17-jre`.
4. Let WSL reach the Windows `adb`: in Windows run `adb kill-server` then `adb -a nodaemon server start`
   (leave it running), and in Ubuntu `export ADB_SERVER_SOCKET=tcp:$(grep nameserver /etc/resolv.conf | cut -d' ' -f2):5037`.
5. Check: `maestro --version` and `adb devices` in Ubuntu both work and show the emulator.

(Running Maestro with a native Windows install of the emulator and a WSL CLI is the supported path today.)

## Prepare

1. Start an emulator (or plug in a phone) with the development build installed and `npx expo start --dev-client` running.
2. Generate today's trips (needed by the trip flows, T5.06) once per day:
   `docker exec supabase_db_school-safety-tracker psql -U postgres -c "select public.generate_trips(current_date);"`
   Trips are only generated on school days (not Fri/Sat by default).
3. Open the app once so the dev launcher connects to Metro; the flows then use `launchApp` with `clearState`.

## Run

From `apps/mobile` (in WSL: `cd /mnt/c/Users/<you>/.../apps/mobile`):

```
maestro test .maestro/signin-parent.yaml -e LANG=ar
maestro test .maestro/signin-parent.yaml -e LANG=en
maestro test .maestro/signin-helper.yaml -e LANG=ar
maestro test .maestro/signin-helper.yaml -e LANG=en
```

`LANG` is `ar` or `en`. Screenshots are saved in `~/.maestro/tests/<run>/` for the Arabic RTL review (H5.1).

## testIDs used

`welcome-lang-ar`, `welcome-lang-en`, `welcome-parent`, `welcome-helper`, `welcome-staff`, `phone-input`,
`phone-continue`, `otp-input`, `otp-resend`, `parent-home`, `helper-home`, `admin-home`.
