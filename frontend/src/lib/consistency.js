// Consistency — how often you actually trained, recently and over the last two months.
//
// Two rules decide everything here.
//
// Days, not sessions. `w.d` is not unique: two sessions on one Saturday is one training
// day, and imported history is one-session-per-day by construction, so a session count is
// not comparable across logged and imported data.
//
// Nothing counts unless something was completed. `finishWorkout` lets you "Finish anyway"
// with no sets checked off, and those records would otherwise inflate every number on this
// screen — the single most important correctness detail in the file.
//
// Nothing here is punitive. There are no day streaks and no loss language: a missed week
// lowers an average slightly and shows up in "trained in 7 of 8", and resets nothing.

import { setsDone, effectiveRoutine } from './history.js'
import { isoOf, todayISO } from './format.js'

/**
 * The Monday of the week a date falls in, as milliseconds.
 *
 * Week keys are sorted on this, never on `weekKey()`, whose output is not zero-padded
 * ('2026-5') and sorts as a string into nonsense. Local noon throughout: `new Date(iso)`
 * parses as UTC midnight and lands on the previous day for anyone west of Greenwich.
 */
export function mondayOf(iso) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

/** The seven ISO dates of the week containing `iso`, Monday first. */
export function weekDates(iso) {
  const d = new Date(mondayOf(iso))
  const out = []
  // Stepped with setDate rather than by adding 86_400_000, so a clock change inside the
  // week cannot shift a date by one.
  for (let i = 0; i < 7; i++) { out.push(isoOf(d)); d.setDate(d.getDate() + 1) }
  return out
}

/** Distinct days on which at least one set was completed. */
export function trainingDays(S) {
  const days = new Set()
  ;((S && S.workouts) || []).forEach(w => {
    if (w && w.d && w.entries && setsDone(w) > 0) days.add(w.d)
  })
  return days
}

/**
 * How many of this week's days have a routine on them.
 *
 * `effectiveRoutine`, not `effectiveRoutineId`: the id version validates a `dayPlan`
 * override against `S.routines` but returns `S.week[wd]` unchecked, so a routine deleted
 * without clearing the weekly plan would count as planned forever. It also respects an
 * explicit 'rest', which `Object.keys(S.week).length` does not.
 */
export function plannedThisWeek(S, today = todayISO()) {
  return weekDates(today).filter(iso => effectiveRoutine(S, iso)).length
}

/**
 * This week as two independent facts — never as a fraction.
 *
 * Trained days and planned days are different sets, so dividing one by the other lies in
 * both directions. Train two planned days plus an unplanned one on a three-day plan and
 * "3 of 3 planned" reports a perfect week in which a session was missed; train a fourth
 * day and it reports "4 of 3".
 */
export function thisWeek(S, today = todayISO()) {
  const wk = new Set(weekDates(today))
  let trained = 0
  trainingDays(S).forEach(d => { if (wk.has(d)) trained++ })
  return { trained, planned: plannedThisWeek(S, today) }
}

/**
 * The last `n` weeks, deliberately goal-free.
 *
 * `S.week` has no history, so scoring past weeks against today's plan would let switching
 * from a three-day to a five-day plan retroactively re-score every week behind you. A
 * consistency figure that silently rewrites itself is worse than no figure. An average and
 * a count cannot be invalidated that way, and neither can be gamed by editing the plan.
 */
export function lastNWeeks(S, n = 8, today = todayISO()) {
  const keys = []
  const cur = new Date(mondayOf(today))
  for (let i = 0; i < n; i++) {
    keys.unshift(mondayOf(isoOf(cur)))
    cur.setDate(cur.getDate() - 7)
  }
  const counts = new Map(keys.map(k => [k, 0]))
  trainingDays(S).forEach(d => {
    const m = mondayOf(d)
    if (counts.has(m)) counts.set(m, counts.get(m) + 1)
  })
  const series = keys.map(k => counts.get(k))
  const total = series.reduce((a, b) => a + b, 0)
  return {
    weeks: n,
    days: total,
    daysPerWeek: Math.round((total / n) * 10) / 10,
    weeksTrained: series.filter(c => c > 0).length,
    counts: series
  }
}
