<div align="center">

<img src="assets/banner.png" alt="openGym Longevity" width="720">

<br>

# openGym Longevity

**A self-hosted strength and cardio tracker focused on long-term progress.**

Built on openGym, originally created by the openGym contributors.

<br>

[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-a3e635?style=flat-square)](LICENSE)
![Self-hosted](https://img.shields.io/badge/self--hosted-%F0%9F%8F%A0-60a5fa?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-installable-a78bfa?style=flat-square)
![React](https://img.shields.io/badge/React-19-38bdf8?style=flat-square&logo=react&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![No tracking](https://img.shields.io/badge/telemetry-none-f472b6?style=flat-square)

</div>

<br>

## What this version focuses on

openGym Longevity is designed around three questions:

1. **Am I training consistently?**
2. **Am I getting stronger?**
3. **Is my cardio improving?**

It adds a Progress experience centered on:

- rolling training consistency
- strength trends against your own previous performance
- stable representative lifts
- Cooper 12-minute cardio testing
- multi-user profiles and cross-device sync

Everything else is upstream openGym: the weekly plan, guided workouts, the progression
engine, the exercise library, passkey sign-in and the optional AI Coach are all unchanged.

This project is derived from [openGym](https://github.com/DuarteSantos8/openGym) and remains
licensed under AGPL-3.0.

<br>

<div align="center">
<table>
<tr>
<td align="center"><img src="assets/screenshots/home.png" alt="Home" width="230"><br><sub><b>Home</b> — today's workout & weight</sub></td>
<td align="center"><img src="assets/screenshots/workout.png" alt="Workout" width="230"><br><sub><b>Guided workout</b> — animated demos & sets</sub></td>
<td align="center"><img src="assets/screenshots/stats.png" alt="Stats" width="230"><br><sub><b>Stats</b> — heatmap, charts & PRs</sub></td>
</tr>
</table>
</div>

## Why

Most workout apps lock your data behind a login on their servers, nag you to upgrade, or
disappear when the startup does. openGym Longevity is the opposite: **it runs on your box,
your data stays in a folder you control, and it's yours to fork.** It still feels modern —
installable as a home-screen app, passkey sign-in, offline support, sync across your phone
and laptop.

## Features

- 📊 **Progress — consistency, strength & cardio** — the screen this version exists for. Training days this week against what you planned, and an 8-week rate that editing your plan can't rewrite. One representative lift per body area, compared against your own best from about three months ago — it can go **down**, which is the point. Cooper 12-minute run distance against your previous test. Every number is you-versus-you: no population bands, no percentiles, no score.
- ⚖️ **Body-weight tracking** — interactive chart with a goal line you set, gains/losses colored by whether they move toward it
- 🏋️ **Weekly plan** — a routine per weekday, over a library of **1,324 exercises** (searchable, with animated demos)
- 🗓️ **Reschedule any day** — sick, missed a session, or fewer gym days this week? Move a workout to another day without touching your weekly plan
- ▶️ **Guided workouts** — it knows what day it is and starts today's session; asks your body weight first, pre-fills your weights from last time, rest timer, PR detection, per-exercise weight tracking
- ☀️ **The screen stays awake while you train** — no unlocking the phone and finding your place again between every set. On for as long as a workout is running, released the moment you finish it, and switchable off in Settings
- 🔗 **Supersets** — build them, and log them back-to-back with a rest only after the pair
- ⏱️ **Timed exercises** — planks, hangs, wall sits and loaded carries are logged by time, not reps, with a work timer that counts the set itself (separate from the rest timer) and logs the time you actually held. They can carry weight too
- 📈 **Progression that follows a rule** — pick one per routine, override it per exercise: linear, **Greyskull LP** (AMRAP top set, double jumps, 10 % resets), double progression through a rep range, or adding time. Your weights are already right when the session opens, and every target says *why* it's that number. Missed reps never advance the load, stalls trigger a deload, and bodyweight exercises progress in reps instead
- 💪 **Estimated 1RM** — per exercise, from your best eligible set (it names which one), with its own progress curve and a calculator for sets you haven't done. Won't guess above 12 reps
- 🎯 **Effort per set, in your scale** — an optional third column rating how hard a set was, as **RIR** (reps left in the tank) or **RPE** (the same judgement on a 10-point scale). Off by default; each set keeps the scale it was logged with, and nothing else reads the value — your progression and 1RM are unaffected
- 🏃 **Cardio** — log time + speed, not just weight × reps
- 📤 **Share a plan** — send someone your routines and week schedule as a small file (no workouts, no weigh-ins), or print it as a clean PDF. Importing merges, so their plan is never overwritten
- 🔧 **Filter by equipment** — narrow the library to what you actually own; the options adapt to what you've picked, so every combination on screen has results behind it
- ✨ **Your own exercises** — a name and a body part is enough; they behave like built-in ones everywhere, with an optional description instead of an animation
- 🟩 **Activity heatmap** — a GitHub-style year view, shaded by time spent training
- 💪 **Muscle map** — a front-and-back body diagram shaded by how much work each muscle got, over a week, a month or all time. It names the muscles you *haven't* trained in that period, previews what a routine hits while you build it, and shows what you just trained when you finish. Male or female figure, your pick
- 🔔 **Push notifications** — rest-timer alerts even with the app closed, plus an optional reminder on days you have a workout planned but haven't logged one. Opt in per profile; keys are generated on first run, nothing to configure
- 🤖 **AI Coach** (optional) — an AI that *designs* your plan and adjusts it from what you actually log. A short intake produces a complete weekly plan you can refine in plain language; on demand or on a schedule it reads your stalls, effort ratings, adherence and body-weight trend and proposes **discrete, explained changes** you accept one by one. Choose the official Claude Agent SDK or the bundled OpenAI Codex CLI with ChatGPT device-code sign-in; it is off until the instance owner enables it, needs each profile's separate consent, and never changes anything without your approval — every change-set is snapshotted and revertible. The progression engine still owns your session-to-session weights. **[Full guide →](docs/AI_COACH.md)**
- 🔑 **Passkeys, not passwords** — Face ID / Touch ID / fingerprint login; each profile keeps its own data, synced across devices
- 🛠️ **Admin dashboard** (optional) — for whoever runs the instance: who's training right now, per-user history, disable accounts, and invite-only signup. Off by default, so a fresh instance stays open with no admin
- 🎨 **Designed, not assembled** — light/dark themes and 8 accent colors saved to your profile, over a hand-drawn icon set instead of emoji, so it looks the same on every phone
- 🌍 **12 languages** — full UI translation (EN, DE, ES, FR, IT, PT, PL, TR, RU, ZH, KO, HI); exercise instructions localized in 10 of them, loaded on demand so the app stays fast
- 📥 **Bring your history with you** — import from **FitNotes** (Android and iOS), **Strong** and **Hevy**, or body weight straight out of an **Apple Health** export. Exercise names are matched against the library and anything unrecognised becomes one of your own exercises, so nothing in the file is dropped
- 📦 **Yours to keep** — one-tap JSON export/import, guest mode, **no telemetry**
- 📱 **Standalone Android app** — the same codebase also builds a sideloadable APK (Capacitor): no account, no server, data on the phone, native workout reminders. You build it from this repo — **[docs/MOBILE.md](docs/MOBILE.md)**

## Quick start (self-host)

You need [Docker](https://docs.docker.com/get-docker/) with Compose.

```bash
git clone https://github.com/shinyamadasan/LongevityWork
cd LongevityWork
cp .env.example .env
docker compose pull   # grab prebuilt images (amd64 + arm64) — skip to build from source instead
docker compose up -d
```

Open **http://localhost:8080**, tap **Create profile**, and you're in. First launch downloads
the exercise media (~140 MB) once. Prefer building the images yourself instead of pulling from
`ghcr.io`? Drop the `pull` step and run `docker compose up -d --build` — you don't need Node or
a build step locally either way.

> Want it reachable from your phone over the internet with passkeys? You'll need an HTTPS
> domain — a two-line change in `.env`. See **[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)**.

## Mobile app (no server at all)

The same codebase also builds a **standalone mobile app** (Capacitor): no account, no sync,
no backend — everything stays on the phone, with native workout-day reminders and share-sheet
backups. Self-hosting gets you multi-device sync and profiles for friends & family; the
mobile app is the install-and-done flavor.

- **Android:** build the APK from this repo and sideload it — **[docs/MOBILE.md](docs/MOBILE.md)**.
  There is no prebuilt openGym Longevity download, and it is deliberately not on the Play Store.
- **iPhone:** Apple doesn't allow installing apps outside the App Store, so there is no iOS
  download. Self-host and add it to your home screen from Safari (it's a full PWA), or build
  the native app onto your own device from Xcode — see **[docs/MOBILE.md](docs/MOBILE.md)**.

## How it works

```
┌─────────────┐        ┌──────────────────────────────┐
│  Your phone │──HTTPS─▶│  web  (nginx)                │
│  / laptop   │        │   ├─ serves the built app    │
└─────────────┘        │   └─ proxies /api ──────────┐│
                       └──────────────────────────────┘│
                                                        ▼
                                        ┌──────────────────────────┐
                                        │  api  (Node + WebAuthn)  │
                                        │   └─ ./data (JSON files) │
                                        └──────────────────────────┘
```

- **frontend/** — React + Vite (React Router + Zustand), built to static files **inside Docker**
- **api/** — Node with no framework, one dependency (`@simplewebauthn/server`), storing everything as plain JSON files under `./data`
- **web/** — a multi-stage image that builds the frontend and serves it with nginx, proxying `/api` to the backend so it's all on **one origin** (passkeys require this)

## Your data

Lives in `./data` on your host: `db.json` (profiles + public passkeys), `state-<user>.json`
(each user's plan, workouts, body weight, settings), and `secret` (the session-cookie key).
**Back up `./data` and you've backed up everything.** Passkey private keys never touch the
server — they stay in your phone's secure hardware / your password manager.

## Configuration

All via `.env` (see `.env.example`):

| Variable      | What it is                                           | Default                 |
|---------------|------------------------------------------------------|-------------------------|
| `RP_ID`       | Hostname passkeys are bound to                       | `localhost`             |
| `ORIGIN`      | Full URL the app is served from                      | `http://localhost:8080` |
| `WEB_PORT`    | Host port for the web UI                             | `8080`                  |
| `RP_NAME`     | Name shown in the passkey prompt                     | `openGym`               |
| `ADMIN_UIDS`  | User ids that get the admin dashboard (comma-separated) | *(none)*             |
| `INVITE_ONLY` | Require an invite code to create a profile           | *(off)*                 |
| `COACH_DISABLED` | Force the AI Coach off, whatever the admin dashboard says | *(unset)*        |

Push notification keys are generated on first run and saved to `./data/vapid.json` — nothing to set.

The **AI Coach** needs no `.env` at all: Claude's Agent SDK and a pinned OpenAI Codex CLI ship
inside the api image. An admin can add a Claude Code setup token or complete Codex's ChatGPT
device-code sign-in in the dashboard. See [the AI Coach guide](docs/AI_COACH.md),
[the self-hosting guide](docs/SELF_HOSTING.md#8-the-ai-coach-optional), and the setup
walkthroughs for [Claude](Claude-setup-instructions.md) and [ChatGPT/Codex](ChatGPT-setup-instructions.md).

## Roadmap

Rough, community-driven — ideas and PRs welcome:

- [x] Standalone mobile app — an Android APK you build and sideload (**[docs/MOBILE.md](docs/MOBILE.md)**); on iOS as a self-hosted PWA (no store listings planned)
- [x] Automatic progression programs (linear, Greyskull LP, double progression) with stalls and deloads
- [x] Estimated 1RM per exercise
- [ ] Percentage / training-max programming (5/3/1-style) on top of the progression engine
- [x] AI Coach — plan design and feedback-driven plan reviews, from a CLI agent running on your own server
- [ ] More starter plans (upper/lower, full-body, 5×5)
- [x] Importers from FitNotes / Strong / Hevy (including the RPE they record), and body weight from Apple Health
- [x] Effort per set — RIR or RPE, whichever scale you think in
- [ ] Body measurements (waist, arms…) alongside weight
- [ ] Per-exercise notes & plate calculator
- [ ] Exercise instructions in German & Portuguese (UI is translated; upstream dataset doesn't ship these yet)

## Tech

React 19 + Vite (React Router, Zustand) · Node (no framework) · nginx · Docker Compose ·
WebAuthn · exercise data from [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset).
No database server, no cloud dependencies — the frontend builds inside Docker, so self-hosting
stays a one-command `docker compose up`.

The training logic — progression rules, 1RM estimation, how a logged session is read back —
lives in pure functions under `frontend/src/lib/` with tests next to them: `npm test` in
`frontend/`. Vitest is a dev dependency; the app itself ships no runtime dependencies beyond
React, the router and Zustand.

## Community

Anything specific to this version — Progress, the cardio field tests, the representative-lift
picker — belongs here:

- **[Issues](https://github.com/shinyamadasan/LongevityWork/issues)** — bugs and work on
  openGym Longevity.

### Upstream openGym community

The wider project this is built on. Please don't report openGym Longevity bugs in these — they
are upstream's, and the maintainers there can't act on features that only exist in this fork.

- **[Q&A](https://github.com/DuarteSantos8/openGym/discussions/categories/q-a)** — self-hosting
  help, passkey/login trouble, "how do I…". Most login problems turn out to be an `RP_ID`/`ORIGIN`
  mismatch, and that advice applies here unchanged.
- **[Ideas](https://github.com/DuarteSantos8/openGym/discussions/categories/ideas)** — features
  worth talking through before anyone writes code.
- **[Show and tell](https://github.com/DuarteSantos8/openGym/discussions/categories/show-and-tell)**
  — your setup, your plan templates, whatever you built on top.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Good first issues: more starter
plans, exercise-data languages, import from other trackers.

openGym Longevity is free and stays free: AGPL, no subscription, no paid tier, nothing held
back. Most of this app is upstream's work — if you want to support the project it is built on,
[DuarteSantos8/openGym](https://github.com/DuarteSantos8/openGym) is the place to do it.

## License

openGym Longevity is derived from [openGym](https://github.com/DuarteSantos8/openGym) by the
openGym contributors, and is distributed under the same license.

[GNU AGPL v3.0](LICENSE) — free and open source. You can self-host, use, modify and share it;
if you run a modified version as a network service, you must offer that version's source under
the same license. Nobody can turn openGym into a closed, proprietary product.

Exercise images/GIFs are fetched from the upstream dataset and keep their own terms — see [NOTICE.md](NOTICE.md).
