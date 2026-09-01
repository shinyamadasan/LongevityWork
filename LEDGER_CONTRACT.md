# Life Ledger contract — read this before changing completed-workout shape/semantics

This app feeds a Life Ledger integration in the ChronaSense repo (`workout-life-ledger-adapter.js`).
The authoritative contract document is **`WORKOUT_LEDGER_SOURCE_CONTRACT_V1.md`** in that repo's
`contracts/` directory — it enumerates exactly which fields and behaviors of a completed workout
(`S.workouts[]`) and the CSV-import path (`parseWorkoutCSV`) are load-bearing.

**You do not need to read that document for most changes.** Routine/plan editing, the coach
feature, athletic-profile screens, bodyweight logging, cardio field tests, progression-engine
internals, and anything purely visual are all explicitly out of scope — normal feature work
there is safe by default.

**You DO need to check the contract before changing:**
- `doFinishWorkout()` in `frontend/src/sheets.jsx` — the completed-workout field list
  (`id`, `d`, `start`, `end`, `routineId`, `name`, `bw`, `entries`, `prs`, `vol`)
- `SessionRating()` — the post-hoc `rating`/`note` mutation onto an already-stored workout
- `DEF.workouts`, `DEF.unit`, and `persist()`'s `S._ts` stamping in `frontend/src/store/useStore.js`
- `parseWorkoutCSV()` in `frontend/src/lib/import-csv.js` — the `iw`-prefixed id, the
  equal-time-when-no-end-time collapse, and per-row unit conversion
- The "Delete workout" action — there is currently **no tombstone/deletion-evidence mechanism**
  for workouts; if you add one, that is a version-bump-worthy contract change, not a bug fix

## The gate

```
cd frontend
npm run test:ledger-contract
```

Runs `src/lib/workout-ledger-source-contract.test.js` — real execution of `parseWorkoutCSV()`
plus source-line-anchored checks on the native completed-workout construction (openGym has no
exported pure function for that path, so it cannot be executed directly without adding one,
which this contract deliberately avoids requiring). A failing test names the exact contract
clause it protects (see the comment at the top of that file).

If you change a real completed-workout behavior and this gate starts failing, read the failure
message, decide whether the break is intentional, and if so see `CONTRACT_VERSIONING.md` in the
ChronaSense repo's `contracts/` directory for how to move the contract forward.

## Updating the CSV-import fixture

`src/lib/__fixtures__/workout-source-contract-v1.fixture.json` is checked in and only refreshed
by an explicit, env-gated run:

```
cd frontend
WORKOUT_LEDGER_FIXTURE_UPDATE=1 npx vitest run src/lib/workout-ledger-source-contract.test.js
```

Never hand-edit it — it is real captured output from `parseWorkoutCSV()`. After regenerating it
here, sync it into the ChronaSense repo's checked-in copy with
`node scripts/update-workout-source-fixture.mjs` (run from that repo).
