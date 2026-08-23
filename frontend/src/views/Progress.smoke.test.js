import { describe, it, expect, beforeAll } from 'vitest'

// There is no jsdom or testing-library in this project, so this is not a render test — it
// is an import test, and it earns its place for one reason: Progress.jsx pulls from
// sheets.jsx, which now pulls from cardio.js, and from strength.js, which pulls from
// exercises.js and onerm.js. A cycle or a mistyped named export anywhere in that graph is
// invisible to `vite build` (it happily emits a bundle) and shows up only as a blank
// screen. This fails loudly instead.
//
// useStore.js reads localStorage and registers a visibilitychange listener at module
// scope, so importing anything downstream of it needs those two globals to exist. Stubbed
// here rather than pulling jsdom in for one test — the stubs only have to be enough for
// the module to finish evaluating.
beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map()
    globalThis.localStorage = {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k)
    }
  }
  if (typeof globalThis.document === 'undefined') {
    globalThis.document = { addEventListener() {}, documentElement: { dataset: {} }, querySelector: () => null }
  }
})

describe('Progress view module graph', () => {
  it('imports cleanly, with the sheet it opens', async () => {
    const view = await import('./Progress.jsx')
    const sheets = await import('../sheets.jsx')
    expect(typeof view.default).toBe('function')
    expect(typeof sheets.fieldTestSheet).toBe('function')
    expect(typeof sheets.strengthRepSheet).toBe('function')
  })

  it('exposes every name the view destructures at module scope', async () => {
    const consistency = await import('../lib/consistency.js')
    const strength = await import('../lib/strength.js')
    const cardio = await import('../lib/cardio.js')
    ;['thisWeek', 'lastNWeeks'].forEach(k => expect(typeof consistency[k]).toBe('function'))
    ;['areaProgress', 'missingReps'].forEach(k => expect(typeof strength[k]).toBe('function'))
    ;['latestPair', 'primaryKind', 'daysSince'].forEach(k => expect(typeof cardio[k]).toBe('function'))
    expect(cardio.TESTS[cardio.PRIMARY_KIND]).toBeTruthy()
  })

  it('keeps the store defaults the screen reads', async () => {
    const { DEF } = await import('../store/useStore.js')
    // Both are top level, not nested: loaded state is overlaid with a shallow
    // Object.assign, so a nested namespace would be replaced wholesale by an old backup.
    expect(Array.isArray(DEF.cardioTests)).toBe(true)
    expect(DEF.strengthReps).toEqual({})
  })

  it('names every body area it will render with a real catalogue value', async () => {
    const { AREAS } = await import('../lib/strength.js')
    const { BODYPARTS } = await import('../lib/exercises.js')
    AREAS.forEach(bp => expect(BODYPARTS).toContain(bp))
  })
})
