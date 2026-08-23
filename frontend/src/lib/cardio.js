// Cardio field tests — a measurement you repeat, not a session you logged.
//
// The app logs cardio as { min, speed }, which records what you scheduled, not what you
// are capable of. A number that only ever reads "20 min @ 8 km/h" cannot answer "is my
// cardio improving". So this file does not grade sessions. It grades a *test*: a maximal
// effort over a fixed time or distance, done the same way each time, a few times a year.
// That is how field testing has always worked, and it is the only honest option for
// someone with no chest strap.
//
// Selectively ported from the retired athletic-profile branch. Deliberately left behind:
// the population VO2max norms and the resting-heart-rate test. The norms answered
// "how do you compare to other people", which is the question this product stopped
// asking; the RHR test is an inference rather than a measurement, and it was the only
// one that needed to know your age.
//
// The raw result is the answer here. VO2max is a derived estimate, shown when it can be
// derived and never gating anything — a distance is a distance whether or not a formula
// likes it.

/* --------------------------------- the tests --------------------------------- */

// `dir` is which way is better, and it exists because three of these are times or heart
// rates. Without it a 2.4 km trial improving 12.0 -> 11.4 min renders as "↓ 0.6 min", a
// decline, in the one block whose entire job is reporting improvement.
//
// `est` returns VO2max in ml/kg/min, or null when the inputs cannot support one. Each
// formula is the standard published one; the citation is the point of the comment,
// because a number like 504.9 is unreviewable without it.
export const TESTS = {
  // Cooper 1968. Run as far as you can in 12 minutes; the distance is the score.
  // The reference test — best signal, worst experience.
  cooper: {
    name: '12-minute run',
    unit: 'm',
    field: 'metres',
    dir: 'up',
    decimal: false,
    how: 'Run as far as you can in exactly 12 minutes. Flat route or a track. Log the distance in metres.',
    est: v => {
      const m = Number(v.metres)
      if (!Number.isFinite(m) || m < 400) return null
      return (m - 504.9) / 44.73
    }
  },

  // Cooper's 1.5-mile (2.4 km) variant. Same idea, fixed distance instead of fixed time —
  // easier to pace, and easier to repeat on a route you already know.
  run24: {
    name: '2.4 km time trial',
    unit: 'min',
    field: 'minutes',
    dir: 'down',
    decimal: true,
    how: 'Cover 2.4 km (1.5 miles) as fast as you can. Log the time in minutes.',
    est: v => {
      const t = Number(v.minutes)
      if (!Number.isFinite(t) || t < 4 || t > 40) return null
      return 483 / t + 3.5
    }
  },

  // Queens College / McArdle step test. No running at all, which matters if running is the
  // thing you are currently bad at — a test you avoid produces no data.
  step: {
    name: 'Step test',
    unit: 'bpm',
    field: 'bpm',
    dir: 'down',
    decimal: false,
    how: 'Step up and down a 41 cm step for 3 minutes, 24 steps a minute (22 if female). Stop, wait 5 seconds, then count your pulse for 15 seconds and multiply by 4.',
    est: v => {
      const hr = Number(v.bpm)
      if (!Number.isFinite(hr) || hr < 60 || hr > 220) return null
      return v.body === 'female' ? 65.81 - 0.1847 * hr : 111.33 - 0.42 * hr
    }
  }
}

export const TEST_KINDS = Object.keys(TESTS)
export const PRIMARY_KIND = 'cooper'

/**
 * VO2max for one logged test, rounded to one decimal, or null when the formula cannot
 * honestly produce one. `body` is passed through because the step test needs it.
 *
 * Null is a normal outcome, not a failure: a 300 m Cooper result is a real thing a real
 * person ran, it just sits below the range the 1968 regression was fitted on.
 */
export function estimateVO2(kind, values, { body = 'male' } = {}) {
  const test = TESTS[kind]
  if (!test) return null
  const v = test.est({ ...values, body })
  if (!Number.isFinite(v) || v <= 0) return null
  return Math.round(v * 10) / 10
}

/* ------------------------------ reading history ------------------------------
   Tests live in S.cardioTests as { d, kind, values, vo2 }. `vo2` is stored rather than
   recomputed so that changing a formula later cannot quietly rewrite your own history,
   and it is nullable — the raw values in `values` are the record. */

const raw = t => Number(t && t.values && t.values[TESTS[t.kind].field])

export const cardioTests = S =>
  ((S && S.cardioTests) || []).filter(t => t && TESTS[t.kind] && Number.isFinite(raw(t)))

const byDate = (a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0)

/** Every usable test of one kind, oldest first. */
export const testsOfKind = (S, kind) => cardioTests(S).filter(t => t.kind === kind).sort(byDate)

/**
 * The kind the primary block should show: Cooper whenever any Cooper result exists,
 * otherwise whichever kind was tested most recently.
 */
export function primaryKind(S) {
  const all = cardioTests(S)
  if (!all.length) return null
  if (all.some(t => t.kind === PRIMARY_KIND)) return PRIMARY_KIND
  return [...all].sort(byDate).pop().kind
}

/**
 * Latest result of one kind and the one before it.
 *
 * Same kind only, always. A Cooper run and a step test are different instruments with
 * different error; a "change" between them is not a change, it is noise with a unit
 * attached. `improved` reads `dir` rather than the sign of the delta, so a faster time
 * and a longer distance both come back as improvements.
 */
export function latestPair(S, kind) {
  const list = testsOfKind(S, kind)
  if (!list.length) return null
  const test = TESTS[kind]
  const cur = list[list.length - 1]
  const prev = list.length > 1 ? list[list.length - 2] : null
  const delta = prev ? Math.round((raw(cur) - raw(prev)) * 100) / 100 : null
  return {
    kind,
    name: test.name,
    unit: test.unit,
    dir: test.dir,
    current: raw(cur),
    currentDate: cur.d,
    vo2: Number.isFinite(cur.vo2) ? cur.vo2 : null,
    previous: prev ? raw(prev) : null,
    previousDate: prev ? prev.d : null,
    delta,
    improved: !delta ? null : test.dir === 'up' ? delta > 0 : delta < 0
  }
}

/** Whole days since an ISO date. Local noon, never UTC midnight. */
export const daysSince = (iso, now = Date.now()) =>
  Math.floor((now - new Date(iso + 'T12:00:00').getTime()) / 86400000)
