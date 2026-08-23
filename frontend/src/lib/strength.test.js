import { describe, it, expect } from 'vitest'
import { totalLoadOf, bestE1RMOf, bwFor, candidates, repFor, missingReps, areaProgress, AREAS } from './strength.js'
import { EXIDX } from './exercises.js'

const SQUAT = '0043'          // barbell full squat            — upper legs
const LEGPRESS = '2287'       // lever alternate leg press     — upper legs
const PULLUP = '0652'         // pull-up                       — back, body weight
const ASSISTED = '0017'       // assisted pull-up              — back, leverage machine
const BENCH = '0025'          // barbell bench press           — chest
const CALF = '1370'           // barbell floor calf raise      — lower legs

const NOW = new Date('2026-06-01T12:00:00').getTime()
const daysAgo = n => {
  const d = new Date(NOW - n * 86400000)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

const workout = (n, entries, bw = 80) => ({
  d: daysAgo(n),
  start: NOW - n * 86400000,
  bw,
  entries: entries.map(([id, w, r]) => ({ id, sets: [{ w, r, done: true }] }))
})

const state = (over = {}) => ({
  unit: 'kg', bodyweight: [{ d: daysAgo(1), w: 80 }], workouts: [], strengthReps: {}, ...over
})

describe('totalLoadOf', () => {
  it('adds bodyweight for a bodyweight movement', () => {
    expect(totalLoadOf(EXIDX[PULLUP], 0, 80)).toBe(80)
    expect(totalLoadOf(EXIDX[PULLUP], 20, 80)).toBe(100)
  })

  it('counts two thirds of you on a push-up', () => {
    expect(totalLoadOf(EXIDX['0662'], 0, 80)).toBeCloseTo(51.2, 5)
  })

  it('refuses an assisted variation outright', () => {
    // The logged weight is assistance — subtractive. Adding it would read this lifter as
    // stronger than an unassisted pull-up, and the number would fall as they improved.
    expect(totalLoadOf(EXIDX[ASSISTED], 40, 80)).toBeNull()
  })

  it('leaves an external load alone', () => {
    expect(totalLoadOf(EXIDX[SQUAT], 100, 80)).toBe(100)
  })

  it('has no opinion on an unnamed load-less movement, or a bodyweight one with no weigh-in', () => {
    expect(totalLoadOf(EXIDX[SQUAT], 0, 80)).toBeNull()
    expect(totalLoadOf(EXIDX[PULLUP], 0, 0)).toBeNull()
  })
})

describe('bestE1RMOf', () => {
  it('produces a number for a bodyweight pull-up logged at w = 0', () => {
    // The regression that matters: estimate1RM refuses a zero weight, so computing the
    // estimate on the logged weight rather than on total load left every bodyweight
    // movement silently absent.
    const e = { sets: [{ w: 0, r: 8, done: true }] }
    expect(bestE1RMOf(e, EXIDX[PULLUP], 80).est).toBeCloseTo(101.3, 1)   // 80 * (1 + 8/30)
  })

  it('estimates a weighted pull-up from the whole load, not from the plate', () => {
    // 80 kg lifter, +20 kg x 5. Total-load-first: (80 + 20) * (1 + 5/30) = 116.7.
    // Estimating the plate alone and adding bodyweight after gives 103.3 — a full band low.
    const e = { sets: [{ w: 20, r: 5, done: true }] }
    expect(bestE1RMOf(e, EXIDX[PULLUP], 80).est).toBeCloseTo(116.7, 1)
  })

  it('skips unchecked sets and takes the best of the rest', () => {
    const e = { sets: [{ w: 100, r: 5, done: true }, { w: 200, r: 5, done: false }, { w: 110, r: 3, done: true }] }
    expect(bestE1RMOf(e, EXIDX[SQUAT], 80).est).toBeCloseTo(121, 0)
  })

  it('returns nothing above the rep cap', () => {
    const e = { sets: [{ w: 40, r: 15, done: true }] }
    expect(bestE1RMOf(e, EXIDX[CALF], 80)).toBeNull()
  })
})

describe('bwFor', () => {
  it('prefers the bodyweight captured with the session', () => {
    expect(bwFor(state(), { d: daysAgo(200), bw: 88 })).toBe(88)
  })

  it('falls back to the nearest weigh-in on or before that date', () => {
    const S = state({ bodyweight: [{ d: daysAgo(300), w: 90 }, { d: daysAgo(10), w: 80 }] })
    expect(bwFor(S, { d: daysAgo(200) })).toBe(90)
    expect(bwFor(S, { d: daysAgo(5) })).toBe(80)
  })

  it('falls back to the latest weigh-in when the session predates all of them', () => {
    const S = state({ bodyweight: [{ d: daysAgo(10), w: 80 }] })
    expect(bwFor(S, { d: daysAgo(300) })).toBe(80)
  })
})

describe('representative selection', () => {
  it('picks by how often you train it, not by how much it moves', () => {
    // Squat three days at 100 kg, leg press once at 200 kg. The squat represents legs;
    // a max over the area would pick the machine and call leverage strength.
    const S = state({
      workouts: [
        workout(30, [[SQUAT, 100, 5]]), workout(23, [[SQUAT, 100, 5]]),
        workout(16, [[SQUAT, 100, 5]]), workout(9, [[LEGPRESS, 200, 5]])
      ]
    })
    expect(repFor(S, 'upper legs').id).toBe(SQUAT)
  })

  it('only considers exercises that can produce an estimate', () => {
    // The 15-rep machine is trained more often, but it can never answer the question, so
    // taking the slot on frequency alone would delete the whole row.
    const S = state({
      workouts: [
        workout(30, [[LEGPRESS, 200, 15]]), workout(23, [[LEGPRESS, 200, 15]]),
        workout(16, [[LEGPRESS, 200, 15]]), workout(9, [[SQUAT, 100, 5]])
      ]
    })
    expect(repFor(S, 'upper legs').id).toBe(SQUAT)
  })

  it('never elects an assisted variation, however often it is trained', () => {
    const S = state({
      workouts: [
        workout(30, [[ASSISTED, 40, 8]]), workout(23, [[ASSISTED, 40, 8]]),
        workout(16, [[ASSISTED, 40, 8]]), workout(9, [[PULLUP, 0, 8]])
      ]
    })
    expect(repFor(S, 'back').id).toBe(PULLUP)
    expect(candidates(S, 'back').some(c => c.id === ASSISTED)).toBe(false)
  })

  it('keeps a stored choice even after another exercise becomes more frequent', () => {
    const S = state({
      strengthReps: { 'upper legs': SQUAT },
      workouts: [
        workout(30, [[SQUAT, 100, 5]]),
        workout(23, [[LEGPRESS, 200, 5]]), workout(16, [[LEGPRESS, 200, 5]]), workout(9, [[LEGPRESS, 200, 5]])
      ]
    })
    expect(repFor(S, 'upper legs').id).toBe(SQUAT)
  })

  it('re-derives when the stored choice has no usable history', () => {
    const S = state({ strengthReps: { 'upper legs': LEGPRESS }, workouts: [workout(9, [[SQUAT, 100, 5]])] })
    expect(repFor(S, 'upper legs').id).toBe(SQUAT)
  })

  it('offers a mapping for every area that has one, and needs no migration', () => {
    const S = state({ workouts: [workout(9, [[SQUAT, 100, 5]]), workout(8, [[BENCH, 80, 5]])] })
    delete S.strengthReps
    expect(missingReps(S)).toEqual({ 'upper legs': SQUAT, chest: BENCH })
  })
})

describe('areaProgress', () => {
  const opts = { now: NOW }

  it('excludes cardio and neck from the areas it will ever report', () => {
    expect(AREAS).not.toContain('cardio')
    expect(AREAS).not.toContain('neck')
    expect(AREAS).toHaveLength(8)
  })

  it('reports a gain against a point about three months back', () => {
    const S = state({ workouts: [workout(90, [[SQUAT, 100, 5]]), workout(5, [[SQUAT, 110, 5]])] })
    const row = areaProgress(S, opts).find(r => r.bp === 'upper legs')
    expect(row.current).toBeCloseTo(128.3, 1)
    expect(row.baseline).toBeCloseTo(116.7, 1)
    // The delta is the difference of the two numbers on screen, not of their unrounded
    // sources: 128.3 - 116.7. Showing 11.7 next to those two would not add up.
    expect(row.delta).toBeCloseTo(11.6, 1)
    expect(row.baselineDate).toBe(daysAgo(90))
    expect(row.since).toBe(false)
  })

  it('reports a decline as a decline', () => {
    // The whole reason the stored per-exercise max was rejected: it cannot do this.
    const S = state({ workouts: [workout(90, [[SQUAT, 120, 5]]), workout(5, [[SQUAT, 100, 5]])] })
    const row = areaProgress(S, opts).find(r => r.bp === 'upper legs')
    expect(row.delta).toBeLessThan(0)
  })

  it('is not moved by one deload session inside the window', () => {
    // A light session eight days ago must not become "current".
    const S = state({
      workouts: [workout(90, [[SQUAT, 100, 5]]), workout(20, [[SQUAT, 110, 5]]), workout(8, [[SQUAT, 60, 5]])]
    })
    const row = areaProgress(S, opts).find(r => r.bp === 'upper legs')
    expect(row.current).toBeCloseTo(128.3, 1)
    expect(row.delta).toBeGreaterThan(0)
  })

  it('says "since you started" rather than inventing a three-month baseline', () => {
    const S = state({ workouts: [workout(40, [[SQUAT, 100, 5]]), workout(5, [[SQUAT, 110, 5]])] })
    const row = areaProgress(S, opts).find(r => r.bp === 'upper legs')
    expect(row.since).toBe(true)
    expect(row.baselineDate).toBe(daysAgo(40))
  })

  it('gives a single session a reading and no comparison', () => {
    const S = state({ workouts: [workout(5, [[SQUAT, 100, 5]])] })
    const row = areaProgress(S, opts).find(r => r.bp === 'upper legs')
    expect(row.current).toBeCloseTo(116.7, 1)
    expect(row.delta).toBeNull()
    expect(row.baselineDate).toBeNull()
  })

  it('omits an area whose only work is above the rep cap', () => {
    const S = state({ workouts: [workout(5, [[CALF, 40, 15]]), workout(4, [[CALF, 40, 15]])] })
    expect(areaProgress(S, opts).find(r => r.bp === 'lower legs')).toBeUndefined()
  })

  it('gives a bodyweight-only trainee real numbers', () => {
    const S = state({ workouts: [workout(90, [[PULLUP, 0, 5]]), workout(5, [[PULLUP, 0, 9]])] })
    const row = areaProgress(S, opts).find(r => r.bp === 'back')
    expect(row.name).toBe('pull-up')
    expect(row.delta).toBeGreaterThan(0)
  })

  it('returns nothing at all for an empty profile', () => {
    expect(areaProgress(state(), opts)).toEqual([])
  })
})
