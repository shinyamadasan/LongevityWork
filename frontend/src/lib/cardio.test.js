import { describe, it, expect } from 'vitest'
import { TESTS, estimateVO2, latestPair, primaryKind, cardioTests, daysSince, displayResult } from './cardio.js'

const test = (d, kind, values, vo2 = null) => ({ d, kind, values, vo2 })
const state = tests => ({ body: 'male', cardioTests: tests })

describe('the catalogue', () => {
  it('says which way is better for every test', () => {
    // Three of these are times or heart rates. Without `dir`, an improvement in any of
    // them renders as a decline.
    expect(TESTS.cooper.dir).toBe('up')
    Object.values(TESTS).forEach(x => expect(['up', 'down']).toContain(x.dir))
  })

  it('names and instructs every test, with a field the sheet can render', () => {
    Object.values(TESTS).forEach(x => {
      expect(x.name).toBeTruthy()
      expect(x.how).toBeTruthy()
      expect(['metres', 'minutes', 'bpm']).toContain(x.field)
    })
  })
})

describe('estimateVO2', () => {
  it('scores a Cooper run', () => {
    expect(estimateVO2('cooper', { metres: 2210 })).toBeCloseTo(38.1, 1)
  })

  it('returns null below the range the formula covers, without that being an error', () => {
    expect(estimateVO2('cooper', { metres: 350 })).toBeNull()
  })

  it('uses the profile body for the step test', () => {
    expect(estimateVO2('step', { bpm: 140 })).not.toBe(estimateVO2('step', { bpm: 140 }, { body: 'female' }))
  })
})

describe('cardioTests', () => {
  it('keeps a result whose VO2max could not be estimated', () => {
    // The raw distance is the record. A 350 m twelve-minute run is a real thing someone
    // did, and the screen must be able to compare it with the next one.
    const S = state([test('2026-01-01', 'cooper', { metres: 350 }, null)])
    expect(cardioTests(S)).toHaveLength(1)
  })

  it('drops a malformed or unknown-kind row', () => {
    const S = state([test('2026-01-01', 'nope', { metres: 2000 }), test('2026-01-02', 'cooper', {})])
    expect(cardioTests(S)).toHaveLength(0)
  })
})

describe('latestPair', () => {
  it('compares the two most recent results of one kind', () => {
    const S = state([
      test('2026-01-01', 'cooper', { metres: 1900 }, 31.2),
      test('2026-02-12', 'cooper', { metres: 2050 }, 34.5),
      test('2026-05-01', 'cooper', { metres: 2210 }, 38.1)
    ])
    const p = latestPair(S, 'cooper')
    expect(p.current).toBe(2210)
    expect(p.previous).toBe(2050)
    expect(p.previousDate).toBe('2026-02-12')
    expect(p.delta).toBe(160)
    expect(p.improved).toBe(true)
    expect(p.vo2).toBe(38.1)
  })

  it('never compares across kinds', () => {
    // A Cooper run and a step test are different instruments with different error. A
    // "change" between them is noise with a unit attached.
    const S = state([
      test('2026-01-01', 'cooper', { metres: 2000 }, 33.4),
      test('2026-05-01', 'step', { bpm: 140 }, 52.5)
    ])
    expect(latestPair(S, 'cooper').previous).toBeNull()
    expect(latestPair(S, 'step').previous).toBeNull()
  })

  it('reads a faster time as an improvement', () => {
    // The bug this exists to prevent: 12.0 -> 11.4 min is the best result of the year and
    // would otherwise render as "down 0.6", a decline.
    const S = state([
      test('2026-01-01', 'run24', { minutes: 12 }, 43.8),
      test('2026-05-01', 'run24', { minutes: 11.4 }, 45.9)
    ])
    const p = latestPair(S, 'run24')
    expect(p.delta).toBeCloseTo(-0.6, 5)
    expect(p.improved).toBe(true)
  })

  it('reads a lower recovery heart rate as an improvement', () => {
    const S = state([
      test('2026-01-01', 'step', { bpm: 150 }, 48.3),
      test('2026-05-01', 'step', { bpm: 140 }, 52.5)
    ])
    expect(latestPair(S, 'step').improved).toBe(true)
  })

  it('gives a first-ever test a reading and no comparison', () => {
    const p = latestPair(state([test('2026-05-01', 'cooper', { metres: 2210 }, 38.1)]), 'cooper')
    expect(p.current).toBe(2210)
    expect(p.previous).toBeNull()
    expect(p.delta).toBeNull()
    expect(p.improved).toBeNull()
  })

  it('is null when that kind was never tested', () => {
    expect(latestPair(state([]), 'cooper')).toBeNull()
  })
})

describe('primaryKind', () => {
  it('prefers Cooper whenever any Cooper result exists', () => {
    const S = state([
      test('2026-01-01', 'cooper', { metres: 2000 }, 33.4),
      test('2026-05-01', 'step', { bpm: 140 }, 52.5)
    ])
    expect(primaryKind(S)).toBe('cooper')
  })

  it('otherwise falls back to the most recently tested kind', () => {
    const S = state([
      test('2026-01-01', 'step', { bpm: 150 }, 48.3),
      test('2026-05-01', 'run24', { minutes: 11.4 }, 45.9)
    ])
    expect(primaryKind(S)).toBe('run24')
  })

  it('is null with no tests', () => {
    expect(primaryKind(state([]))).toBeNull()
  })
})

describe('daysSince', () => {
  it('measures from local noon', () => {
    const now = new Date('2026-06-01T09:00:00').getTime()
    expect(daysSince('2026-05-25', now)).toBe(6)
  })
})

describe('displayResult', () => {
  it('shows a Cooper run in kilometres, to two decimals', () => {
    // fmtNum's single decimal would render 2.21 and 2.15 identically as "2.2".
    expect(displayResult('cooper', 2210)).toEqual({ value: 2.21, unit: 'km', digits: 2 })
    expect(displayResult('cooper', 2050)).toEqual({ value: 2.05, unit: 'km', digits: 2 })
  })

  it('keeps a short distance in metres', () => {
    expect(displayResult('cooper', 350)).toEqual({ value: 350, unit: 'm', digits: 0 })
  })

  it('leaves times and heart rates alone', () => {
    expect(displayResult('run24', 11.4)).toEqual({ value: 11.4, unit: 'min', digits: 1 })
    expect(displayResult('step', 140)).toEqual({ value: 140, unit: 'bpm', digits: 0 })
  })

  it('does not touch what latestPair compares', () => {
    // Presentation only: storage stays in metres and so does the delta, where 160 m is a
    // visible gain and "0.16 km" would read as nothing.
    const S = { cardioTests: [
      { d: '2026-02-12', kind: 'cooper', values: { metres: 2050 }, vo2: 34.5 },
      { d: '2026-05-01', kind: 'cooper', values: { metres: 2210 }, vo2: 38.1 }
    ] }
    const p = latestPair(S, 'cooper')
    expect(p.current).toBe(2210)
    expect(p.delta).toBe(160)
    expect(p.unit).toBe('m')
  })
})
