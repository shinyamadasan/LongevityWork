import { describe, it, expect } from 'vitest'
import { trainingDays, plannedThisWeek, thisWeek, lastNWeeks, weekDates, mondayOf } from './consistency.js'

const set = (w, r = 8, done = true) => ({ w, r, done })
const workout = (d, sets = [set(60)]) => ({ d, entries: [{ id: '0001', sets }] })

// A weekday-keyed plan, the way S.week actually is: getDay(), Sunday = 0.
const week = (...days) => Object.fromEntries(days.map(d => [d, 'r1']))
const state = (over = {}) => ({
  workouts: [], routines: [{ id: 'r1', name: 'A', ex: [] }], week: {}, dayPlan: {}, ...over
})

describe('trainingDays', () => {
  it('excludes a workout with no completed set', () => {
    // "Finish anyway" writes a record with nothing checked off. It is not training.
    const S = state({ workouts: [workout('2026-03-02', [set(60, 8, false)])] })
    expect(trainingDays(S).size).toBe(0)
  })

  it('counts two sessions on one date as one training day', () => {
    const S = state({ workouts: [workout('2026-03-02'), workout('2026-03-02')] })
    expect(trainingDays(S).size).toBe(1)
  })

  it('survives a record with no entries array', () => {
    const S = state({ workouts: [{ d: '2026-03-02' }, workout('2026-03-03')] })
    expect(trainingDays(S).size).toBe(1)
  })
})

describe('week boundaries', () => {
  it('runs Monday to Sunday', () => {
    // 2026-03-04 is a Wednesday.
    const days = weekDates('2026-03-04')
    expect(days[0]).toBe('2026-03-02')
    expect(days[6]).toBe('2026-03-08')
  })

  it('keeps a year-end week together', () => {
    // 2026-12-31 is a Thursday; its week starts 2026-12-28 and ends 2027-01-03.
    const days = weekDates('2026-12-31')
    expect(days[0]).toBe('2026-12-28')
    expect(days[6]).toBe('2027-01-03')
    expect(mondayOf('2027-01-01')).toBe(mondayOf('2026-12-31'))
  })
})

describe('plannedThisWeek', () => {
  it('counts the weekdays that carry a routine', () => {
    // Mon, Wed, Fri -> getDay() 1, 3, 5.
    const S = state({ week: week(1, 3, 5) })
    expect(plannedThisWeek(S, '2026-03-04')).toBe(3)
  })

  it('drops a day explicitly set to rest', () => {
    const S = state({ week: week(1, 3, 5), dayPlan: { '2026-03-04': 'rest' } })
    expect(plannedThisWeek(S, '2026-03-04')).toBe(2)
  })

  it('adds a day the plan overrides onto a rest day', () => {
    const S = state({ week: week(1, 3, 5), dayPlan: { '2026-03-05': 'r1' } })
    expect(plannedThisWeek(S, '2026-03-04')).toBe(4)
  })

  it('does not count a routine that no longer exists', () => {
    // effectiveRoutineId returns S.week[wd] without checking S.routines, so a routine
    // deleted without clearing the weekly plan would otherwise be planned forever.
    const S = state({ week: week(1, 3, 5), routines: [] })
    expect(plannedThisWeek(S, '2026-03-04')).toBe(0)
  })

  it('is zero with no plan at all', () => {
    expect(plannedThisWeek(state(), '2026-03-04')).toBe(0)
  })
})

describe('thisWeek', () => {
  it('reports trained and planned as independent numbers', () => {
    const S = state({ week: week(1, 3, 5), workouts: [workout('2026-03-02'), workout('2026-03-04')] })
    expect(thisWeek(S, '2026-03-04')).toEqual({ trained: 2, planned: 3 })
  })

  it('lets trained exceed planned rather than capping it into a fraction', () => {
    // Four training days on a three-day plan is a real week. "4 of 3" is not a sentence,
    // which is exactly why these are two facts and never a ratio.
    const S = state({
      week: week(1, 3, 5),
      workouts: ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05'].map(d => workout(d))
    })
    expect(thisWeek(S, '2026-03-04')).toEqual({ trained: 4, planned: 3 })
  })

  it('ignores training in an adjacent week', () => {
    const S = state({ workouts: [workout('2026-03-01'), workout('2026-03-09')] })
    expect(thisWeek(S, '2026-03-04').trained).toBe(0)
  })
})

describe('lastNWeeks', () => {
  it('averages over the whole window, including weeks with nothing in them', () => {
    // Three days in the current week, none in the seven before it.
    const S = state({ workouts: ['2026-03-02', '2026-03-04', '2026-03-06'].map(d => workout(d)) })
    const r = lastNWeeks(S, 8, '2026-03-04')
    expect(r.days).toBe(3)
    expect(r.weeksTrained).toBe(1)
    expect(r.daysPerWeek).toBe(0.4)
  })

  it('shows a missed week as a lower average, not as a reset', () => {
    // Two days a week for eight weeks, minus the week of 2026-02-09.
    const days = []
    for (let i = 0; i < 8; i++) {
      const mon = new Date(mondayOf('2026-03-04'))
      mon.setDate(mon.getDate() - i * 7)
      if (mon.getMonth() === 1 && mon.getDate() === 9) continue
      const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
      days.push(iso(mon))
      const wed = new Date(mon); wed.setDate(wed.getDate() + 2)
      days.push(iso(wed))
    }
    const r = lastNWeeks(state({ workouts: days.map(d => workout(d)) }), 8, '2026-03-04')
    expect(r.weeksTrained).toBe(7)
    expect(r.days).toBe(14)
    expect(r.daysPerWeek).toBe(1.8)
  })

  it('excludes zero-set sessions from the average', () => {
    const S = state({
      workouts: [workout('2026-03-02'), workout('2026-03-03', [set(60, 8, false)])]
    })
    expect(lastNWeeks(S, 8, '2026-03-04').days).toBe(1)
  })
})
