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
//   2. BOUNDED STRUCTURAL (AST) ANALYSIS — the native "workouts collection record" shape is
//      built inline inside a store-mutating UI event handler (sheets.jsx doFinishWorkout()),
//      which openGym does not export as a pure function. Adding such an export purely for this
//      gate would be exactly the kind of source-app redesign Phase 5C explicitly avoids.
//
//      An earlier version of this file matched the relevant source with exact, multi-line,
//      order-sensitive regexes — which broke on any benign rename/reorder/reformat, not just on
//      real contract breaks (see review feedback, 2026-09). This version instead:
//        a. carves out just the relevant function's source text with a brace/string/comment-
//           aware extractor (extractBalancedBlock — treats string and template contents and
//           comments as opaque, so braces inside them never confuse the count),
//        b. parses THAT extracted text with acorn (already a transitive dependency of Vite;
//           declared explicitly in package.json here rather than relied on silently) into a
//           real AST,
//        c. walks the AST with acorn-walk to find the relevant construct BY SHAPE (e.g. "the
//           object literal whose keys are a superset of id/d/start/end/routineId/name/bw",
//           "the call that pushes into some *.workouts array") rather than by exact spelling —
//           so it is tolerant of variable renames, property reordering, whitespace/formatting,
//           and any local helper extracted within the SAME function scope.
//
//      This still cannot see through a helper extracted to a DIFFERENT top-level function (that
//      would need call-graph resolution across the whole file, which is real-parser-project
//      territory, not a bounded gate) — that residual blind spot is intentional and documented
//      inline at the one check it affects. Every analyzer below returns a plain
//      { ok, reason } object rather than asserting directly, specifically so the SAME functions
//      can be attacked with synthetic benign/breaking source snippets in the
//      "gate self-test" describe block further down — proving this gate tolerates harmless
//      refactors and still catches real breaks, without ever touching real openGym source.
//
// Run in isolation: `npm run test:ledger-contract` (from frontend/).

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'acorn'
import * as walk from 'acorn-walk'
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

// ── Bounded structural analysis toolkit ─────────────────────────────────────────────────────
// Everything in this section is pure (source text in, {ok, reason} out) so the "gate self-test"
// block below can attack it directly with synthetic snippets.

// Extracts the source text of a balanced `{ ... }` block. `headRegex` MUST match a prefix that
// ends with the block's own opening brace as its last character (e.g.
// `/function\s+f\s*\(\s*\)\s*\{/`) — this is what lets a destructured parameter's own `{ }`
// (e.g. `function SessionRating({ w }) {`) not be mistaken for the function body's brace.
// Treats string/template literal contents and comments as opaque so braces inside them (e.g.
// `t('{0} sets')`) never desynchronize the depth count. Returns null if headRegex doesn't match
// or the block never balances (e.g. the function was removed/renamed).
function extractBalancedBlock(source, headRegex) {
  const head = headRegex.exec(source)
  if (!head) return null
  const braceStart = head.index + head[0].length - 1
  if (source[braceStart] !== '{') return null
  let depth = 0
  let i = braceStart
  for (; i < source.length; i++) {
    const ch = source[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      i++
      while (i < source.length && source[i] !== ch) { if (source[i] === '\\') i++; i++ }
      continue
    }
    if (ch === '/' && source[i + 1] === '/') {
      const nl = source.indexOf('\n', i)
      i = nl === -1 ? source.length : nl
      continue
    }
    if (ch === '/' && source[i + 1] === '*') {
      const close = source.indexOf('*/', i + 2)
      i = close === -1 ? source.length : close + 1
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) { i++; break }
    }
  }
  if (depth !== 0) return null // never balanced — treat as "not found" rather than guessing
  // bodyStart is the offset, WITHIN the returned text, of the content right after the body's
  // own opening brace — callers must use this rather than re-deriving it (e.g. via their own
  // `text.indexOf('{')`), which would wrongly find a destructured parameter's brace instead
  // for a signature like `function SessionRating({ w }) {`.
  return { text: source.slice(head.index, i), bodyStart: head[0].length }
}

// Several of sheets.jsx's functions end with a bare UI side-effect call (opening a sheet/modal)
// that embeds JSX directly (`ui().openSheet(close => <FinishSummary .../>)` or a JSX `return`).
// Plain acorn (no JSX plugin declared — see file header on scope) cannot parse JSX. None of the
// contract-relevant logic in either function analyzed here comes after its first JSX, so it is
// safe and sufficient to analyze only the text before it.
//
// Truncates at the START OF THE LINE containing the first JSX marker, not at the marker itself
// — cutting mid-expression (e.g. right before the `<` in `ui().openSheet(close => <X/>)`) would
// leave a dangling, syntactically-invalid partial call (`close =>` with no body). Dropping the
// whole line is safe here because every JSX-producing statement this file's functions end on
// (a bare `return <jsx>`, or a bare `someCall(cb => <jsx/>, ...)` side-effect call) is a
// complete, self-contained statement placed on its own line.
function stripTrailingJsx(bodyText) {
  const jsxStart = /\breturn\s*<|=>\s*</.exec(bodyText)
  if (!jsxStart) return bodyText
  const lineStart = bodyText.lastIndexOf('\n', jsxStart.index) + 1
  return bodyText.slice(0, lineStart)
}

function isMemberAccess(node, propertyName) {
  return !!node && node.type === 'MemberExpression' && !node.computed && node.property.name === propertyName
}

function describePushArg(node) {
  if (!node) return '(nothing)'
  if (node.type === 'Identifier') return node.name
  if (node.type === 'MemberExpression' && !node.computed) {
    return `${describePushArg(node.object)}.${node.property.name}`
  }
  return `<${node.type}>`
}

const REQUIRED_RECORD_KEYS = ['id', 'd', 'start', 'end', 'routineId', 'name', 'bw']

// The core §3/§4/§5 analysis: locates the completed-workout object literal BY SHAPE (its own
// key set, not its variable name or position), confirms each required field is copied from the
// active session (or, for `end`, freshly stamped), confirms that SAME object — not some other
// value — is the one pushed into a *.workouts collection exactly once, and confirms the active
// session is cleared in the process.
function analyzeCompletedWorkoutConstruction(sheetsSource) {
  const fn = extractBalancedBlock(sheetsSource, /function\s+doFinishWorkout\s*\(\s*\)\s*\{/)
  if (!fn) return { ok: false, reason: 'contract §3/§5 broken: could not locate a balanced doFinishWorkout() function body in sheets.jsx at all' }

  // The body ends in a bare `ui().openSheet(close => <FinishSummary .../>)` call — see
  // stripTrailingJsx. Every check below only needs what comes before that. `wrapped` (not the
  // trimmed body alone) is what gets parsed and later sliced from, so AST node.start/node.end
  // offsets always line up with what we slice.
  const rawBody = fn.text.slice(fn.bodyStart, fn.text.length - 1)
  const analyzableBody = stripTrailingJsx(rawBody)
  const wrapped = `function X(){ ${analyzableBody} }`

  let ast
  try {
    ast = parse(wrapped, { ecmaVersion: 2022, sourceType: 'script' })
  } catch (e) {
    return { ok: false, reason: `doFinishWorkout() could not be parsed as JS for structural analysis (${e.message}) — this needs manual review, the bounded gate cannot see past a parse error` }
  }

  let recordVarName = null
  let recordNode = null
  walk.simple(ast, {
    VariableDeclarator(node) {
      if (recordNode || !node.init || node.init.type !== 'ObjectExpression') return
      const keys = node.init.properties
        .filter(p => p.type === 'Property' && !p.computed)
        .map(p => p.key.name || p.key.value)
      if (REQUIRED_RECORD_KEYS.every(k => keys.includes(k))) {
        recordVarName = node.id.name
        recordNode = node.init
      }
    }
  })
  if (!recordNode) {
    return {
      ok: false,
      reason: `contract §5 broken: no object literal in doFinishWorkout() carries all of ${REQUIRED_RECORD_KEYS.join('/')} — the completed-workout record shape changed (property renamed, removed, or moved to a value acorn can't see, e.g. a spread from a helper defined in a DIFFERENT function)`
    }
  }

  const propByKey = new Map()
  for (const p of recordNode.properties) {
    if (p.type === 'Property' && !p.computed) propByKey.set(p.key.name || p.key.value, p.value)
  }

  for (const key of ['id', 'd', 'start', 'routineId', 'name', 'bw']) {
    if (!isMemberAccess(propByKey.get(key), key)) {
      return { ok: false, reason: `contract §5 broken: \`${key}\` on the completed workout is no longer copied straight from the active session (expected some \`<ident>.${key}\`) — it may be regenerated, hardcoded, or omitted` }
    }
  }

  const endVal = propByKey.get('end')
  const endIsFreshClockRead = !!endVal && endVal.type === 'CallExpression' &&
    endVal.callee.type === 'MemberExpression' && endVal.callee.object.name === 'Date' && endVal.callee.property.name === 'now'
  if (!endIsFreshClockRead) {
    return { ok: false, reason: 'contract §4 broken: `end` is no longer stamped with a fresh Date.now() read at completion time — it may be copied stale from elsewhere, hardcoded, or omitted' }
  }

  // §3: the exact object we just analyzed must be the thing pushed into *.workouts, so an
  // "active session leaks into completed history" mutation (pushing something else, e.g. the
  // raw active session) is caught even though a well-formed record object still exists nearby.
  const pushSites = []
  walk.simple(ast, {
    CallExpression(node) {
      const c = node.callee
      if (c.type === 'MemberExpression' && !c.computed && c.property.name === 'push' &&
          c.object.type === 'MemberExpression' && !c.object.computed && c.object.property.name === 'workouts') {
        pushSites.push(node.arguments[0])
      }
    }
  })
  if (pushSites.length === 0) {
    return { ok: false, reason: 'contract §3 broken: doFinishWorkout() no longer pushes the completed record into any *.workouts collection' }
  }
  if (pushSites.length > 1) {
    return { ok: false, reason: `contract §3 broken: doFinishWorkout() now pushes into *.workouts ${pushSites.length} times — every push site must be re-verified against the contract, not just the first` }
  }
  const pushedArg = pushSites[0]
  if (!pushedArg || pushedArg.type !== 'Identifier' || pushedArg.name !== recordVarName) {
    return {
      ok: false,
      reason: `contract §3 broken: the value pushed into *.workouts ("${describePushArg(pushedArg)}") is not the completed-workout record this function built ("${recordVarName}") — the active/completed boundary may be broken (e.g. the raw in-progress session leaking into history)`
    }
  }

  let activeCleared = false
  walk.simple(ast, {
    AssignmentExpression(node) {
      if (node.left.type === 'MemberExpression' && !node.left.computed && node.left.property.name === 'active' &&
          node.right.type === 'Literal' && node.right.value === null) {
        activeCleared = true
      }
    }
  })
  if (!activeCleared) {
    return { ok: false, reason: 'contract §3 broken: the active session is no longer cleared (`*.active = null`) when a workout completes — a finished session could remain reachable as still-in-progress' }
  }

  // §5 entries: field-copy and filter-predicate checks are run against the WHOLE function body
  // (not just the `entries:` property's own text) specifically so a benign local helper
  // extraction (e.g. hoisting the per-entry mapper or the completed-set predicate into a local
  // `const` used by name inside the same function) still passes — the pattern just needs to
  // exist SOMEWHERE in this function, not inline at the entries call site. This does mean a
  // coincidental unrelated match elsewhere in this small, single-purpose function could in
  // theory mask a real removal; that residual risk is accepted and documented here rather than
  // hidden, per review guidance to be honest about bounded blind spots.
  if (!propByKey.has('entries')) {
    return { ok: false, reason: 'contract §5 broken: the completed workout record no longer has an `entries` field at all' }
  }
  const entriesVal = propByKey.get('entries')
  const entriesSrc = wrapped.slice(entriesVal.start, entriesVal.end)
  if (!/\.map\(/.test(entriesSrc)) {
    return { ok: false, reason: 'contract §5 broken: entries are no longer built via a `.map()` transform over the active session\'s exercises' }
  }
  if (!/\.filter\(/.test(entriesSrc)) {
    return { ok: false, reason: 'contract §5 broken: exercises with no completed sets are no longer filtered out before the workout is stored' }
  }
  for (const key of ['id', 'sets', 'topW', 'target']) {
    if (!new RegExp(`\\b${key}:\\s*[\\w$]+\\.${key}\\b`).test(wrapped)) {
      return { ok: false, reason: `contract §5 broken: a completed exercise entry no longer copies its own \`${key}\` field from the source exercise` }
    }
  }
  if (!/\.sets\s*\.?\s*some\(\s*[\w$]+\s*=>\s*[\w$]+\.done\s*\)/.test(wrapped)) {
    return {
      ok: false,
      reason: 'contract §5 broken, OR the filter predicate was rewritten to a shape this bounded check cannot follow (e.g. a block-bodied arrow, or a predicate extracted to a different top-level function — a documented blind spot, see this file\'s header): the completed-set filter no longer visibly checks `.sets.some(x => x.done)`'
    }
  }

  return { ok: true, recordVarName }
}

// §3 (whole-file half): a broad, deliberately non-brittle count — this only cares whether
// EXACTLY ONE place in the entire file ever pushes into a *.workouts collection, regardless of
// how that call is formatted or what anything is named.
function countWorkoutsPushSites(sheetsSource) {
  return (sheetsSource.match(/\.workouts\.push\(/g) || []).length
}

// §5/§8: SessionRating mutates rating/note onto the already-stored workout record after initial
// completion. Its function body ends in a JSX return, which plain acorn (no JSX plugin
// available/declared — see file header on scope) cannot parse; the persistence logic is always
// plain JS preceding that return in this file's style, so this bounded blind spot is accepted:
// analysis only covers the text up to the first `return <`.
function analyzeSessionRatingPersistence(sheetsSource) {
  const fn = extractBalancedBlock(sheetsSource, /function\s+SessionRating\s*\(\s*\{[^)]*\}\s*\)\s*\{/)
  if (!fn) return { ok: false, reason: 'contract §5/§8 broken: could not locate a balanced SessionRating() function body in sheets.jsx at all' }

  const rawBody = fn.text.slice(fn.bodyStart, fn.text.length - 1)
  const analyzableBody = stripTrailingJsx(rawBody)

  let ast
  try {
    ast = parse(`function X(){ ${analyzableBody} }`, { ecmaVersion: 2022, sourceType: 'script' })
  } catch (e) {
    return { ok: false, reason: `SessionRating()'s pre-JSX logic could not be parsed for structural analysis (${e.message}) — this needs manual review, the bounded gate cannot see past a parse error` }
  }

  let ratingAssigned = false
  let noteAssigned = false
  let noteSliceBound = null
  walk.simple(ast, {
    AssignmentExpression(node) {
      if (node.left.type !== 'MemberExpression' || node.left.computed) return
      if (node.left.property.name === 'rating') ratingAssigned = true
      if (node.left.property.name === 'note') {
        noteAssigned = true
        const rhs = node.right
        if (rhs.type === 'CallExpression' && rhs.callee.type === 'MemberExpression' &&
            !rhs.callee.computed && rhs.callee.property.name === 'slice' &&
            rhs.arguments.length === 2 && rhs.arguments[0].type === 'Literal' && rhs.arguments[0].value === 0 &&
            rhs.arguments[1].type === 'Literal') {
          noteSliceBound = rhs.arguments[1].value
        }
      }
    }
  })

  if (!ratingAssigned) {
    return { ok: false, reason: 'contract §5/§8 broken: SessionRating no longer writes a `rating` field onto the already-stored workout record' }
  }
  if (!noteAssigned) {
    return { ok: false, reason: 'contract §5/§8 broken: SessionRating no longer writes a `note` field onto the already-stored workout record' }
  }
  if (noteSliceBound !== 300) {
    return {
      ok: false,
      reason: `contract §5 broken: the note is no longer bounded to 300 characters via .slice(0, 300) (found ${noteSliceBound === null ? 'no matching .slice(0, N) call' : noteSliceBound}) — this must stay in sync with MAX_NOTE_LENGTH in the adapter`
    }
  }
  return { ok: true }
}

// §6: still no deletion-evidence mechanism for workouts. Kept as a lightweight, naming-tolerant
// regex (not full AST) because it is a single, narrow structural shape — "some array is
// reassigned to a `.filter()` call over itself" — where the value being protected is genuinely
// the ABSENCE of anything more (a tombstone/deletion-map concept), not a specific spelling.
function analyzeNoWorkoutDeletionEvidence(sheetsSource, useStoreSource) {
  if (!/\.workouts\s*=\s*[\w$.]+\.workouts\.filter\(/.test(sheetsSource)) {
    return { ok: false, reason: 'contract §6 broken: "Delete workout" no longer does a plain `.filter()` reassignment — if a deletion map now exists, WORKOUT_LIFE_LEDGER_CAPABILITIES.deletion must be revisited, this is a version-bump-worthy change' }
  }
  if (/deletions\.workouts|workoutDeletions|workoutTombstone/.test(sheetsSource + useStoreSource)) {
    return { ok: false, reason: 'contract §6 broken: a workout deletion-map/tombstone concept now exists in the source — this directly contradicts §6 and requires a new contract version' }
  }
  return { ok: true }
}

// ── Real-source gate: applies the analyzers above to the actual current openGym source ────────
describe('WORKOUT_LEDGER_SOURCE_CONTRACT_V1 — native "workouts collection record" variant (bounded structural analysis)', () => {
  const sheets = readSource('../sheets.jsx')
  const store = readSource('../store/useStore.js')

  it('§1: the whole persisted state is the backup object — DEF.workouts is an array, DEF.unit is a single global unit', () => {
    expect(store, "contract §1 broken: useStore.js's DEF no longer defines workouts as an array default")
      .toMatch(/workouts:\s*\[\]/)
    expect(store, "contract §1 broken: useStore.js's DEF no longer defines a single global `unit` default")
      .toMatch(/unit:\s*'kg'/)
  })

  it('§1: persist() stamps a whole-snapshot _ts, never a per-workout one', () => {
    expect(store, 'contract §1 broken: persist() no longer stamps `_ts` with a fresh Date.now() read — provenance.sourceStateTimestamp would go stale/undetectable')
      .toMatch(/\._ts\s*=\s*Date\.now\(\)/)
  })

  it('§3/§4/§5: the completed-workout record is built from the active session, freshly timestamped, and is exactly what gets pushed into history as the active session clears', () => {
    const result = analyzeCompletedWorkoutConstruction(sheets)
    expect(result.ok, result.reason).toBe(true)
  })

  it('§3 (whole-file): exactly one place in sheets.jsx ever pushes into a *.workouts collection', () => {
    expect(countWorkoutsPushSites(sheets), 'contract §3 broken: the number of places that push into *.workouts changed — every push site must be re-verified against the contract').toBe(1)
  })

  it('§5/§8: rating and note are mutated onto an already-stored workout by id after initial completion (a documented, intentional conflict source)', () => {
    const result = analyzeSessionRatingPersistence(sheets)
    expect(result.ok, result.reason).toBe(true)
  })

  it('§6: deleting a workout is a plain array filter — there is still no tombstone/deletion-evidence mechanism for workouts', () => {
    const result = analyzeNoWorkoutDeletionEvidence(sheets, store)
    expect(result.ok, result.reason).toBe(true)
  })
})

// ── Gate self-test: attack the ANALYZERS above with synthetic source, never real openGym files ──
//
// Proves two things the review specifically asked for:
//   - benign, behavior-preserving refactors (rename / reorder / reformat / local helper
//     extraction) do NOT make the gate report a break (no false positives), and
//   - representative real breaks (identity, timestamp, history-boundary, persistence) DO make
//     the gate report a break, with an actionable reason (no false negatives).
//
// Every snippet here is a small, self-contained, synthetic stand-in for the real function shape
// — not a copy of real openGym source — so this section tests the GATE, not the app.

function syntheticDoFinishWorkout(bodyOverrides = {}) {
  const {
    recordDecl = 'const w = { id: A.id, d: A.d, start: A.start, end: Date.now(), routineId: A.routineId, name: A.name, bw: A.bw, entries: A.entries.map(e => ({ id: e.id, sets: e.sets, topW: e.topW || null, target: e.target || null })).filter(e => e.sets.some(s => s.done)), prs: [] }',
    pushLine = 's.workouts.push(w)',
    clearActiveLine = 's.active = null',
    updateWrapper = (inner) => `update(s => {\n    ${inner}\n  })`
  } = bodyOverrides
  return `
function doFinishWorkout() {
  const A = S().active
  if (!A) return
  ${recordDecl}
  ${updateWrapper(`${pushLine}\n    ${clearActiveLine}`)}
}
`
}

function syntheticSessionRating(bodyOverrides = {}) {
  const {
    ratingLine = 'if (next) rec.rating = next; else delete rec.rating',
    noteLine = 'if (v) rec.note = v.slice(0, 300); else delete rec.note'
  } = bodyOverrides
  return `
function SessionRating({ w }) {
  const update = useStore(s => s.update)
  const [rating, setRating] = useState(w.rating || null)
  const [note, setNote] = useState('')
  const onWorkout = (s, fn) => { const rec = (s.workouts || []).find(x => x.id === w.id); if (rec) fn(rec) }
  const pick = v => {
    const next = v === rating ? null : v
    setRating(next)
    update(s => onWorkout(s, rec => { ${ratingLine} }))
  }
  const saveNote = () => update(s => onWorkout(s, rec => {
    const v = note.trim()
    ${noteLine}
  }))
  return <div style={{ textAlign: 'left', marginTop: 16 }}>
    <h4 className="sec">{t('How did that feel?')}</h4>
  </div>
}
`
}

describe('gate self-test — benign refactors must NOT trip the analyzers', () => {
  it('renaming every local variable (A -> active, s -> state, w -> record, e -> ex) still passes', () => {
    const src = `
function doFinishWorkout() {
  const active = S().active
  if (!active) return
  const record = { id: active.id, d: active.d, start: active.start, end: Date.now(), routineId: active.routineId, name: active.name, bw: active.bw, entries: active.entries.map(ex => ({ id: ex.id, sets: ex.sets, topW: ex.topW || null, target: ex.target || null })).filter(ex => ex.sets.some(x => x.done)), prs: [] }
  update(state => {
    state.workouts.push(record)
    state.active = null
  })
}
`
    expect(analyzeCompletedWorkoutConstruction(src).ok).toBe(true)
  })

  it('reordering every property in the record literal still passes', () => {
    const src = syntheticDoFinishWorkout({
      recordDecl: 'const w = { bw: A.bw, name: A.name, entries: A.entries.map(e => ({ target: e.target || null, topW: e.topW || null, sets: e.sets, id: e.id })).filter(e => e.sets.some(s => s.done)), routineId: A.routineId, end: Date.now(), start: A.start, d: A.d, id: A.id, prs: [] }'
    })
    expect(analyzeCompletedWorkoutConstruction(src).ok).toBe(true)
  })

  it('reformatting the whole record onto one line, and again spread across many extra blank lines, still passes', () => {
    const oneLine = syntheticDoFinishWorkout()
    const spread = syntheticDoFinishWorkout({
      recordDecl: [
        'const w = {',
        '',
        '  id: A.id,',
        '',
        '  d: A.d, start: A.start,',
        '  end: Date.now(),',
        '',
        '  routineId: A.routineId, name: A.name, bw: A.bw,',
        '  entries: A.entries.map(e => ({ id: e.id, sets: e.sets, topW: e.topW || null, target: e.target || null }))',
        '    .filter(e => e.sets.some(s => s.done)),',
        '  prs: []',
        '}'
      ].join('\n')
    })
    expect(analyzeCompletedWorkoutConstruction(oneLine).ok).toBe(true)
    expect(analyzeCompletedWorkoutConstruction(spread).ok).toBe(true)
  })

  it('extracting the per-entry mapper and the completed-set predicate into local helpers (same function scope) still passes', () => {
    const src = `
function doFinishWorkout() {
  const A = S().active
  if (!A) return
  const toEntry = e => ({ id: e.id, sets: e.sets, topW: e.topW || null, target: e.target || null })
  const hasCompletedSet = e => e.sets.some(s => s.done)
  const w = { id: A.id, d: A.d, start: A.start, end: Date.now(), routineId: A.routineId, name: A.name, bw: A.bw, entries: A.entries.map(toEntry).filter(hasCompletedSet), prs: [] }
  update(s => {
    s.workouts.push(w)
    s.active = null
  })
}
`
    expect(analyzeCompletedWorkoutConstruction(src).ok).toBe(true)
  })

  it('an unrelated new field added to the record (e.g. a future UI hint) still passes', () => {
    const src = syntheticDoFinishWorkout({
      recordDecl: 'const w = { id: A.id, d: A.d, start: A.start, end: Date.now(), routineId: A.routineId, name: A.name, bw: A.bw, mood: A.mood || null, entries: A.entries.map(e => ({ id: e.id, sets: e.sets, topW: e.topW || null, target: e.target || null })).filter(e => e.sets.some(s => s.done)), prs: [] }'
    })
    expect(analyzeCompletedWorkoutConstruction(src).ok).toBe(true)
  })

  it('SessionRating: renaming rec/v/next and reordering the assign/delete branches still passes', () => {
    const src = syntheticSessionRating({
      ratingLine: 'if (chosen) record.rating = chosen; else delete record.rating',
      noteLine: 'if (trimmed) record.note = trimmed.slice(0, 300); else delete record.note'
    }).replace(/rec\b/g, 'record').replace(/\bnext\b/g, 'chosen').replace(/\bv\b/g, 'trimmed')
    expect(analyzeSessionRatingPersistence(src).ok).toBe(true)
  })
})

describe('gate self-test — representative real breaks MUST trip the analyzers, with an actionable reason', () => {
  it('id regenerated instead of copied from the active session is caught', () => {
    const mutated = syntheticDoFinishWorkout({
      recordDecl: 'const w = { id: uid(), d: A.d, start: A.start, end: Date.now(), routineId: A.routineId, name: A.name, bw: A.bw, entries: A.entries.map(e => ({ id: e.id, sets: e.sets, topW: e.topW || null, target: e.target || null })).filter(e => e.sets.some(s => s.done)), prs: [] }'
    })
    const result = analyzeCompletedWorkoutConstruction(mutated)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/`id`/)
  })

  it('end omitted from the record literal entirely is caught', () => {
    const mutated = syntheticDoFinishWorkout({
      recordDecl: 'const w = { id: A.id, d: A.d, start: A.start, routineId: A.routineId, name: A.name, bw: A.bw, entries: A.entries.map(e => ({ id: e.id, sets: e.sets, topW: e.topW || null, target: e.target || null })).filter(e => e.sets.some(s => s.done)), prs: [] }'
    })
    const result = analyzeCompletedWorkoutConstruction(mutated)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/end/)
  })

  it('end copied stale from the active session instead of a fresh clock read is caught', () => {
    const mutated = syntheticDoFinishWorkout({
      recordDecl: 'const w = { id: A.id, d: A.d, start: A.start, end: A.end, routineId: A.routineId, name: A.name, bw: A.bw, entries: A.entries.map(e => ({ id: e.id, sets: e.sets, topW: e.topW || null, target: e.target || null })).filter(e => e.sets.some(s => s.done)), prs: [] }'
    })
    const result = analyzeCompletedWorkoutConstruction(mutated)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/Date\.now/)
  })

  it('the completed-history push is removed entirely is caught', () => {
    const mutated = syntheticDoFinishWorkout({
      updateWrapper: (inner) => `update(s => {\n    s.active = null\n  })`
    })
    const result = analyzeCompletedWorkoutConstruction(mutated)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/no longer pushes/)
  })

  it('the active session leaking into completed history (pushing the raw active session, not the built record) is caught', () => {
    const mutated = syntheticDoFinishWorkout({ pushLine: 's.workouts.push(s.active)' })
    const result = analyzeCompletedWorkoutConstruction(mutated)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/active\/completed boundary may be broken/)
  })

  it('the active session no longer being cleared on completion is caught', () => {
    const mutated = syntheticDoFinishWorkout({ clearActiveLine: '// active session left running' })
    const result = analyzeCompletedWorkoutConstruction(mutated)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/active session is no longer cleared/)
  })

  it('a second, unrelated push into *.workouts elsewhere in the file is caught by the whole-file count', () => {
    const src = syntheticDoFinishWorkout() + '\nfunction importSomethingElse() {\n  update(s => { s.workouts.push(fabricated) })\n}\n'
    expect(countWorkoutsPushSites(src)).toBe(2)
  })

  it('rating persistence removed from SessionRating is caught', () => {
    const mutated = syntheticSessionRating({ ratingLine: '/* rating no longer persisted */' })
    const result = analyzeSessionRatingPersistence(mutated)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/no longer writes a `rating`/)
  })

  it('note persistence removed from SessionRating is caught', () => {
    const mutated = syntheticSessionRating({ noteLine: '// note no longer persisted' })
    const result = analyzeSessionRatingPersistence(mutated)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/no longer writes a `note`/)
  })

  it('the note bound silently changing from 300 characters is caught (a real factual-contract change, not a benign refactor)', () => {
    const mutated = syntheticSessionRating({ noteLine: 'if (v) rec.note = v.slice(0, 500); else delete rec.note' })
    const result = analyzeSessionRatingPersistence(mutated)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/300/)
  })

  it('a workout deletion tombstone concept appearing is caught', () => {
    const sheetsWithTombstone = 's.workouts = s.workouts.filter(x => x.id !== w.id)\nwriteTombstone("workoutDeletions", w.id)'
    const result = analyzeNoWorkoutDeletionEvidence(sheetsWithTombstone, '')
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/deletion-map\/tombstone concept now exists/)
  })

  it('"Delete workout" no longer being a plain filter reassignment is caught', () => {
    const result = analyzeNoWorkoutDeletionEvidence('someOtherDeletionMechanism(w.id)', '')
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/no longer does a plain/)
  })
})
