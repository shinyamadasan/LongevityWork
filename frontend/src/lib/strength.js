// Strength, compared only against yourself.
//
// One representative lift per body area, with what it does now and what it did about
// three months ago. No population bands, no levels, no "you are an Intermediate athlete" —
// the only question is whether the number moved, and which way.
//
// The metric is an estimated 1RM computed on *total* load, which is the part that had to
// be got right. The alternatives all fail the same test:
//
//   S.exWeights          monotonic by construction (Math.max at every write site), so it
//                        can never answer "am I getting stronger" with anything but yes
//   raw top-set weight   non-monotonic, but rep-blind: 100x5 -> 100x10 is real progress
//                        and moves it by exactly zero
//   session volume       confounds training style with capability
//   e1RM on logged weight   absent for a quarter of real training, because a bodyweight
//                           pull-up is stored as w = 0 and every 1RM formula refuses it
//
// Computing total load *before* estimating fixes that last one, and is what makes pull-ups,
// dips and push-ups produce real numbers. The remaining holes stay holes: sets above
// REP_CAP and timed sets produce nothing, and an area with nothing to say is left out
// rather than filled in.

import { EXIDX } from './exercises.js'
import { estimate1RM } from './onerm.js'

/* ------------------------------- total load ------------------------------- */

// Share of bodyweight the movement actually carries. Push-ups are the one everyone
// forgets: roughly two thirds of you, because your feet hold the rest.
const BW_SHARE = [
  [/\b(pull.?up|chin.?up)\b/, 1],
  [/\bdip\b/, 1],
  [/\bpush.?up\b/, 0.64]
]

// Assisted variants log the *assistance*, which is subtractive. Adding it the way the
// share table adds a weight belt would read an 80 kg lifter on 40 kg of help as 120 kg —
// more than the same lifter doing an unassisted pull-up — and, worse, the number would
// fall as they got stronger and needed less help. Since the representative for an area is
// chosen by how often you train it, and assisted pull-ups are exactly what a beginner
// trains most, that inversion would land on the headline for the people this screen is
// for. There is no honest absolute load here, so these produce nothing at all.
const ASSISTED = /\bassisted\b/

/**
 * What one rep actually moved, in the profile's unit: the bar plus whatever share of the
 * lifter the movement carries. Returns null when there is no honest answer — an assisted
 * variation, a bodyweight movement with no weigh-in to scale, or an unnamed machine
 * logged at zero, which is carrying something real that we cannot quantify.
 */
export function totalLoadOf(ex, w, bw) {
  const n = String((ex && ex.n) || '').toLowerCase()
  if (!n || ASSISTED.test(n)) return null
  const bar = Number(w) || 0
  for (const [re, share] of BW_SHARE) {
    if (re.test(n)) {
      if (!bw || bw <= 0) return null
      return bw * share + bar
    }
  }
  return bar > 0 ? bar : null
}

/**
 * Best estimate out of one entry's completed sets, computed on total load.
 *
 * Unchecked sets are skipped, as everywhere else in the app. Warm-ups need no special
 * handling: they estimate lower than the working set, and this takes the max.
 */
export function bestE1RMOf(entry, ex, bw) {
  let best = null
  ;(entry && entry.sets ? entry.sets : []).forEach(s => {
    if (!s.done) return
    const total = totalLoadOf(ex, s.w, bw)
    if (total === null) return
    const est = estimate1RM(total, s.r)
    if (est !== null && (!best || est > best.est)) {
      best = { est, w: Number(s.w) || 0, r: Math.round(Number(s.r)), total: Math.round(total * 10) / 10 }
    }
  })
  return best
}

/**
 * Bodyweight as it was at the time of the session, not as it is today.
 *
 * This matters only for bodyweight movements, and there it matters a lot: your pull-up's
 * absolute load *is* your bodyweight, so scoring a session from six months ago with
 * today's number would silently rewrite what you did. `w.bw` is captured when a workout
 * starts but is null on older and imported records, so fall back to the nearest weigh-in
 * on or before that date, then to the most recent one.
 *
 * The honest consequence, which the screen says out loud: losing weight lowers a
 * bodyweight lift's absolute load even though nothing about you got weaker.
 */
export function bwFor(S, w) {
  if (Number(w && w.bw) > 0) return Number(w.bw)
  const log = (S && S.bodyweight) || []
  let best = null
  for (const b of log) if (b && b.d <= w.d && Number(b.w) > 0) best = b
  if (best) return Number(best.w)
  const last = log.length ? log[log.length - 1] : null
  return last && Number(last.w) > 0 ? Number(last.w) : 0
}

/* ------------------------------- the areas ------------------------------- */

// `bp` is the only taxonomy in the catalogue with full coverage: custom exercises always
// have one (the editor refuses to save without it) while `tg` and `sm` are empty on them,
// and all ten values are already translated in every locale.
//
// Two are missing on purpose. `cardio` has no load concept at all, and `neck` has two
// exercises in a catalogue of 1324. An area that cannot produce an honest number should
// be absent, not empty.
export const AREAS = ['chest', 'back', 'shoulders', 'upper arms', 'lower arms', 'upper legs', 'lower legs', 'waist']

const DAY = 86400000
const tsOf = w => w.start || new Date(w.d + 'T12:00:00').getTime()

/**
 * Every exercise in an area that has ever produced an estimate, with the number of
 * distinct training days it was logged on, most-trained first.
 *
 * Frequency rather than heaviest load, because a max over an area picks the leg press
 * over the squat and calls a leverage artifact strength. And *only* exercises that can
 * produce an estimate, because otherwise a 15-rep finisher logged one day more often than
 * your working squat would take the slot and delete the entire row.
 */
export function candidates(S, bp) {
  const by = new Map()
  ;(S.workouts || []).forEach(w => {
    if (!w || !w.entries) return
    const bw = bwFor(S, w)
    w.entries.forEach(e => {
      const ex = EXIDX[e.id]
      if (!ex || ex.bp !== bp) return
      if (!bestE1RMOf(e, ex, bw)) return
      const c = by.get(e.id) || { id: e.id, name: ex.n, days: new Set(), last: '' }
      c.days.add(w.d)
      if (w.d > c.last) c.last = w.d
      by.set(e.id, c)
    })
  })
  return [...by.values()]
    .map(c => ({ id: c.id, name: c.name, days: c.days.size, last: c.last }))
    .sort((a, b) => b.days - a.days || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0))
}

/**
 * The exercise that represents an area.
 *
 * Derived from history the first time, then kept: a headline that silently swaps to a
 * different lift is comparing two different things and calling the difference progress.
 * `S.strengthReps` holds the choice; a stored id with no usable history any more falls
 * back to derivation rather than blanking the row.
 */
export function repFor(S, bp) {
  const list = candidates(S, bp)
  if (!list.length) return null
  const pinned = ((S && S.strengthReps) || {})[bp]
  return (pinned && list.find(c => c.id === pinned)) || list[0]
}

/**
 * bp -> exercise id for every area that has a representative but no stored one yet.
 *
 * Pure, so the caller decides when to persist. Existing profiles need no migration: an
 * absent map derives itself the first time the screen is opened.
 */
export function missingReps(S) {
  const have = (S && S.strengthReps) || {}
  const out = {}
  AREAS.forEach(bp => {
    if (have[bp]) return
    const rep = repFor(S, bp)
    if (rep) out[bp] = rep.id
  })
  return out
}

/** Every estimate the representative lift has ever produced, oldest first. */
function seriesFor(S, exId) {
  const ex = EXIDX[exId]
  const pts = []
  ;(S.workouts || []).forEach(w => {
    if (!w || !w.entries) return
    const bw = bwFor(S, w)
    w.entries.forEach(e => {
      if (e.id !== exId) return
      const best = bestE1RMOf(e, ex, bw)
      if (best) pts.push({ t: tsOf(w), d: w.d, est: best.est })
    })
  })
  return pts.sort((a, b) => a.t - b.t)
}

/**
 * One row per area that can produce an honest number, or nothing for the ones that cannot.
 *
 * Current is the best estimate in the last `window` days. The baseline is the best in the
 * `window`-wide band centred on `days` ago. Both ends can go down — a plateau shows as a
 * plateau and a decline shows as a decline, which is the whole point — but neither can be
 * moved by one deload session, which a bare most-recent-session reading could not manage.
 *
 * When there is no such band, the comparison falls back to the first thing ever logged and
 * says so. `baselineDate` is always the real date, because "vs 3 months ago" over a
 * training gap can quietly mean fourteen.
 */
export function areaProgress(S, { days = 90, window = 30, now = Date.now() } = {}) {
  return AREAS.map(bp => {
    const rep = repFor(S, bp)
    if (!rep) return null
    const pts = seriesFor(S, rep.id)
    if (!pts.length) return null

    const bestIn = (from, to) => {
      const inRange = pts.filter(p => p.t >= from && p.t <= to)
      return inRange.length ? inRange.reduce((a, b) => (b.est > a.est ? b : a)) : null
    }

    const cur = bestIn(now - window * DAY, Infinity) || pts[pts.length - 1]
    const half = (window / 2) * DAY
    let base = bestIn(now - days * DAY - half, now - days * DAY + half)
    let since = false
    // No comparison band, or one that overlaps what we are calling "now".
    if (!base || base.t >= cur.t) { base = pts[0]; since = true }
    // A single session is a reading, not a comparison.
    if (base.t === cur.t) { base = null; since = false }

    return {
      bp,
      exId: rep.id,
      name: rep.name,
      trainedDays: rep.days,
      current: cur.est,
      currentDate: cur.d,
      baseline: base ? base.est : null,
      baselineDate: base ? base.d : null,
      delta: base ? Math.round((cur.est - base.est) * 10) / 10 : null,
      since
    }
  }).filter(Boolean)
}
