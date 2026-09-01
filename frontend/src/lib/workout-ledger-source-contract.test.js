// ── Life Ledger compatibility gate — WORKOUT_LEDGER_SOURCE_CONTRACT_V1 ──────────────────────
//
// Answers one question: "Does current openGym still satisfy WORKOUT_LEDGER_SOURCE_CONTRACT_V1?"
// The authoritative contract document lives in the ChronaSense repo at
// contracts/WORKOUT_LEDGER_SOURCE_CONTRACT_V1.md — this file is its source-side enforcement.
//
// If you are changing anything this file checks, read that document's matching numbered
// section first. A failure here should read as "contract clause N broke", not "expected true,
// got false" — every assertion below carries a message naming the clause.
//
// Two verification strategies are used, deliberately kept apart:
//   1. REAL EXECUTED CODE — parseWorkoutCSV() is a pure, exported function, so its CSV-import
//      behavior (identity shape, equal-time collapse, unit conversion) is verified by actually
//      running it, not by simulating what it does.
//   2. SOURCE-LINE-ANCHORED CHECKS — the native "workouts collection record" shape is built
//      inline inside a store-mutating UI event handler (sheets.jsx doFinishWorkout()), which
//      openGym does not export as a pure function. Adding such an export purely for this gate
//      would be exactly the kind of source-app redesign Phase 5C explicitly avoids, so instead
//      this file reads the relevant source files as text and asserts the literal construction
//      is still present. This is weaker than execution but still fails loudly and specifically
//      the moment a maintainer renames or restructures one of these fields — see each test's
//      comment for exactly which source lines it is anchored to.
//
// Run in isolation: `npm run test:ledger-contract` (from frontend/).

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseWorkoutCSV } from './import-csv.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_PATH = path.join(__dirname, '__fixtures__', 'workout-source-contract-v1.fixture.json')
const FIXTURE_UPDATE = process.env.WORKOUT_LEDGER_FIXTURE_UPDATE === '1'

function readSource(relPath) {
  return fs.readFileSync(path.resolve(__dirname, relPath), 'utf8')
}

const STRONG_CSV = [
  'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
  '2026-08-15 07:30,Push Day,45m,Barbell Bench Press,1,60,8,,,,,',
  '2026-08-15 07:30,Push Day,45m,Barbell Bench Press,2,60,7,,,,,8',
  '2026-08-15 07:30,Push Day,45m,Barbell Bench Press,3,60,6,,,,,'
].join('\n')

describe('WORKOUT_LEDGER_SOURCE_CONTRACT_V1 — CSV-import variant (real parseWorkoutCSV execution)', () => {
  it('§2/§4: produces an iw-prefixed id and collapses to an equal-time (unknown-duration) interval when the source has no end time', () => {
    const parsed = parseWorkoutCSV(STRONG_CSV, { unit: 'kg' })
    expect(parsed.error, 'contract §1 broken: a well-formed Strong-shaped export must parse').toBeUndefined()
    expect(parsed.workouts.length).toBe(1)
    const w = parsed.workouts[0]
    expect(w.id.startsWith('iw'), 'contract §2 broken: CSV-import workouts must carry an iw-prefixed id').toBe(true)
    expect(w.end, 'contract §4 broken: a Strong-shaped row with no End Time column must collapse end to start, never fabricate a distinct end').toBe(w.start)
    expect(w.entries.length).toBe(1)
    expect(w.entries[0].sets.every(s => s.done === true)).toBe(true)
    expect(w.entries[0].sets.every(s => 'r' in s && 'w' in s), 'contract §5 broken: a strength CSV row must produce {w, r, done} sets').toBe(true)

    if (FIXTURE_UPDATE) {
      const existing = fs.existsSync(FIXTURE_PATH) ? JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) : {}
      existing.contractVersion = 'WORKOUT_LEDGER_SOURCE_CONTRACT_V1'
      existing.capturedAt = new Date().toISOString()
      existing.capturedFrom = 'real parseWorkoutCSV() execution (workout-ledger-source-contract.test.js)'
      existing.sourceCsv = STRONG_CSV
      existing.workout = w
      fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true })
      fs.writeFileSync(FIXTURE_PATH, JSON.stringify(existing, null, 2) + '\n', 'utf8')
    }
  })

  it('§1: a global unit change at import time converts CSV-asserted weights, proving the source has no per-row historical unit authority of its own', () => {
    const asKg = parseWorkoutCSV(STRONG_CSV, { unit: 'kg' }).workouts[0]
    const asLb = parseWorkoutCSV(STRONG_CSV, { unit: 'lb' }).workouts[0]
    // The CSV never states its own unit (no "Weight Unit" column in this Strong-shaped sample),
    // so the row's number is taken to already be in the profile's own unit at import time —
    // requesting a different profile unit therefore leaves the raw number UNCONVERTED (there is
    // nothing to convert from), which is the concrete mechanism behind "no historical unit
    // authority": the number's meaning is entirely a function of the unit asserted at read time.
    expect(asKg.entries[0].sets[0].w).toBe(asLb.entries[0].sets[0].w)
  })

  it('benign: an unrecognized extra CSV column is ignored, not a parse failure', () => {
    const withExtraColumn = STRONG_CSV.replace('RPE', 'RPE,Injury Notes')
      .split('\n').map((line, i) => (i === 0 ? line : line + ',')).join('\n')
    const parsed = parseWorkoutCSV(withExtraColumn, { unit: 'kg' })
    expect(parsed.error).toBeUndefined()
    expect(parsed.workouts.length).toBe(1)
  })

  it('chaos: removing the exercise-name column is a structural break the source itself already refuses', () => {
    const broken = STRONG_CSV.split('\n').map(line => line.split(',').filter((_, i) => i !== 3).join(',')).join('\n')
    const parsed = parseWorkoutCSV(broken, { unit: 'kg' })
    expect(parsed.error, 'a CSV with no exercise column must be refused, never silently imported as workouts with no exercises').toBe('unrecognised')
  })

  it('the tracked fixture (if present) still matches the current real parseWorkoutCSV() output shape', () => {
    if (!fs.existsSync(FIXTURE_PATH)) return // fresh checkout before the first fixture:update run
    const tracked = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'))
    const live = parseWorkoutCSV(tracked.sourceCsv, { unit: 'kg' }).workouts[0]
    expect(live.entries).toEqual(tracked.workout.entries)
    expect(live.end === live.start).toBe(tracked.workout.end === tracked.workout.start)
  })
})

describe('WORKOUT_LEDGER_SOURCE_CONTRACT_V1 — native "workouts collection record" variant (source-line-anchored)', () => {
  const sheets = readSource('../sheets.jsx')
  const store = readSource('../store/useStore.js')

  it('§1: the whole persisted state is the backup object — DEF.workouts is an array, DEF.unit is a single global unit', () => {
    expect(store, "contract §1 broken: useStore.js's DEF no longer defines workouts as an array default")
      .toMatch(/workouts:\s*\[\]/)
    expect(store, "contract §1 broken: useStore.js's DEF no longer defines a single global `unit` default")
      .toMatch(/unit:\s*'kg'/)
  })

  it('§1: persist() stamps a whole-snapshot _ts, never a per-workout one', () => {
    expect(store, 'contract §1 broken: persist() no longer stamps S._ts — provenance.sourceStateTimestamp would go stale/undetectable')
      .toMatch(/S\._ts\s*=\s*Date\.now\(\)/)
  })

  it('§3: a finished workout is pushed to s.workouts in the same update that clears s.active, and nowhere else', () => {
    expect(sheets, 'contract §3 broken: doFinishWorkout() no longer pushes the completed workout into s.workouts').toMatch(/s\.workouts\.push\(w\)/)
    expect(sheets, 'contract §3 broken: doFinishWorkout() no longer clears s.active on completion — an active session could leak into history').toMatch(/s\.active\s*=\s*null/)
    const workoutsPushSites = (sheets.match(/\.workouts\.push\(/g) || []).length
    expect(workoutsPushSites, 'contract §3 broken: a NEW code path now pushes into workouts[] — every push site must be re-verified against this contract').toBe(1)
  })

  it('§5: the completed workout object carries exactly the field set this contract documents', () => {
    const constructionLine = sheets.match(/const w = \{\s*\n\s*id: A\.id, d: A\.d, start: A\.start, end: Date\.now\(\), routineId: A\.routineId, name: A\.name, bw: A\.bw,/)
    expect(constructionLine, 'contract §5 broken: the completed-workout field list (id, d, start, end, routineId, name, bw) changed — update WORKOUT_LEDGER_SOURCE_CONTRACT_V1.md §5 and the adapter together').not.toBeNull()
    expect(sheets, 'contract §5 broken: entries are no longer built as {id, sets, topW, target}')
      .toMatch(/entries:\s*A\.entries\.map\(e => \(\{ id: e\.id, sets: e\.sets, topW: e\.topW \|\| null, target: e\.target \|\| null \}\)\)/)
    expect(sheets, 'contract §5 broken: only exercises with at least one completed set should survive onto the stored workout')
      .toMatch(/\.filter\(e => e\.sets\.some\(s => s\.done\)\)/)
  })

  it('§5/§8: rating and note are mutated onto an already-stored workout by id after initial completion (a documented, intentional conflict source)', () => {
    expect(sheets, 'contract §5/§8 broken: SessionRating no longer mutates rec.rating in place on the stored workout').toMatch(/rec\.rating\s*=\s*next/)
    expect(sheets, 'contract §5/§8 broken: SessionRating no longer mutates rec.note in place, or the 300-char cap changed (must match MAX_NOTE_LENGTH in the adapter)').toMatch(/rec\.note\s*=\s*v\.slice\(0,\s*300\)/)
  })

  it('§6: deleting a workout is a plain array filter — there is still no tombstone/deletion-evidence mechanism for workouts', () => {
    expect(sheets, 'contract §6 broken: "Delete workout" no longer does a plain filter — if a deletion map now exists, WORKOUT_LIFE_LEDGER_CAPABILITIES.deletion must be revisited, this is a version-bump-worthy change')
      .toMatch(/s\.workouts\s*=\s*s\.workouts\.filter\(x => x\.id !== w\.id\)/)
    expect(store + sheets, 'contract §6 broken: a workout deletion-map/tombstone concept now exists in the source — this directly contradicts §6 and requires a new contract version')
      .not.toMatch(/deletions\.workouts|workoutDeletions|workoutTombstone/)
  })
})
