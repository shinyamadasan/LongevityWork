import { useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { fmtNum, fmtFixed, fmtDate } from '../lib/format.js'
import { thisWeek, lastNWeeks } from '../lib/consistency.js'
import { areaProgress, missingReps } from '../lib/strength.js'
import { latestPair, primaryKind, daysSince, displayResult } from '../lib/cardio.js'
import { fieldTestSheet, strengthRepSheet } from '../sheets.jsx'
import { Button } from '../components/ui.jsx'
import { nav } from '../lib/nav.js'

// Three questions, in fixed order, each answered against your own past rather than against
// a population: are you staying consistent, are you getting stronger, is your cardio
// improving. Everything here can go down. A number that can only rise cannot answer the
// second question — it can only ever answer "yes" — which is what ruled out the obvious
// stored-max shortcut in lib/strength.js.
//
// Stats is still the analytics hub (heatmap, muscle map, bodyweight, per-exercise charts)
// and Home still answers "what do I do now". This screen answers neither.

/**
 * A signed change, coloured by whether it is an improvement rather than by its sign.
 *
 * Those are not the same thing: a 2.4 km time trial improves by going *down*, so keying
 * the colour off the arrow would paint the single best cardio result of the year in the
 * decline colour. Declines are muted rather than red — the arrow already says which way
 * it went, and nothing on this screen is trying to make you feel bad about a deload.
 */
function Delta({ value, unit, improved }) {
  if (value === null || value === 0) return <span className="small dim">{t('no change')}</span>
  return <span className="small" style={{ color: improved ? 'var(--acc)' : 'var(--label-2)' }}>
    {(value > 0 ? '↑ ' : '↓ ') + fmtNum(Math.abs(value)) + ' ' + unit}
  </span>
}

/** A block with nothing to show yet: what it needs, and the one action that produces it. */
function Empty({ lines, action, onAction }) {
  return <>
    {lines.map((l, i) => <div key={i} className={i ? 'small dim' : 'muted'} style={{ marginTop: i ? 4 : 0, lineHeight: 1.5 }}>{l}</div>)}
    {action && <div style={{ marginTop: 14 }}><Button variant="primary" onClick={onAction}>{action}</Button></div>}
  </>
}

function Consistency({ S }) {
  const week = thisWeek(S)
  const last8 = lastNWeeks(S, 8)

  if (!last8.days && !week.trained) {
    return <div className="card">
      <h2>{t('Consistency')}</h2>
      <Empty
        lines={[t('No training logged yet.'), t('Your first workout starts the record.')]}
        action={t('Start a workout')} onAction={() => nav('/workout')} />
    </div>
  }

  return <div className="card">
    <h2>{t('Consistency')}</h2>
    {/* Two independent facts, never "3 of 3 planned". Trained days and planned days are
        different sets: two planned days plus an unplanned one on a three-day plan would
        render a perfect week in which a session was missed, and a fourth day would
        render "4 of 3". */}
    <div className="mrow">
      <span className="nm">{t('This week')}</span>
      <span className="v" style={{ minWidth: 0 }}>
        {t(week.trained === 1 ? '{0} training day' : '{0} training days', week.trained)}
        {week.planned ? ' · ' + t('{0} planned', week.planned) : ''}
      </span>
    </div>
    <div className="mrow">
      <span className="nm">{t('Last 8 weeks')}</span>
      <span className="v" style={{ minWidth: 0 }}>
        {t('{0} days/week', fmtNum(last8.daysPerWeek))} · {t('trained in {0} of {1}', last8.weeksTrained, last8.weeks)}
      </span>
    </div>
  </div>
}

function Strength({ S }) {
  const rows = areaProgress(S)

  return <div className="card">
    <h2>{t('Strength')} <span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>· {t('vs about 3 months ago')}</span></h2>
    {!rows.length && <Empty lines={[
      t('Nothing to compare yet.'),
      t('Log a few sessions and the lift you train most in each area appears here.')
    ]} />}
    {/* Tapping a row changes which lift speaks for that area. The default is derived and
        then pinned, so this is the only thing that moves it. */}
    {rows.map(r => <button key={r.bp} className="prow" onClick={() => strengthRepSheet(r.bp)} aria-label={t('Change which exercise represents {0}', t(r.bp))}>
      <div className="row between" style={{ alignItems: 'baseline', gap: 10 }}>
        {/* The area is a grouping header; the exercise name carries the truth claim.
            Always rendered, so if the representative ever changes it is visible. */}
        <span className="capitalize" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <b>{t(r.bp)}</b> <span className="dim">· {r.name}</span>
        </span>
        <b style={{ flex: 'none' }}>{fmtNum(r.current)} {S.unit}</b>
      </div>
      <div className="row between" style={{ alignItems: 'baseline', gap: 10, marginTop: 3 }}>
        <span className="small dim">
          {r.baselineDate
            ? (r.since ? t('since you started') + ' · ' + fmtDate(r.baselineDate) : fmtDate(r.baselineDate) + ' · ' + fmtNum(r.baseline) + ' ' + S.unit)
            : t('first reading')}
        </span>
        {r.baselineDate && <Delta value={r.delta} unit={S.unit} improved={r.delta > 0} />}
      </div>
    </button>)}
    {rows.length > 0 && <div className="small dim" style={{ marginTop: 10, lineHeight: 1.45 }}>
      {t('Estimated from your top set. Pull-ups, dips and push-ups count your bodyweight, so their numbers move when your weight does.')}
    </div>}
  </div>
}

function Cardio({ S }) {
  const kind = primaryKind(S)
  const pair = kind ? latestPair(S, kind) : null

  if (!pair) {
    return <div className="card">
      <h2>{t('Cardio')}</h2>
      <Empty
        lines={[t('No baseline yet.'), t('A 12-minute run gives you one in a single session.')]}
        action={t('Take the test')} onAction={fieldTestSheet} />
    </div>
  }

  const stale = daysSince(pair.currentDate)
  // A Cooper run reads as "2.21 km", not "2,210 m" — but the delta below stays in metres,
  // where 160 m is a visible gain and "0.16 km" would look like nothing.
  const cur = displayResult(pair.kind, pair.current)
  const prev = pair.previous === null ? null : displayResult(pair.kind, pair.previous)
  return <div className="card">
    <h2>{t('Cardio')}</h2>
    <div className="small dim">{t(pair.name)}</div>
    <div className="row between" style={{ alignItems: 'baseline', gap: 10, marginTop: 2 }}>
      <span className="big">{fmtFixed(cur.value, cur.digits)} <span className="dim" style={{ fontSize: 17, fontWeight: 400 }}>{cur.unit}</span></span>
      {/* Same kind only, always — a Cooper run and a step test are different instruments,
          and a "change" between them is noise with a unit attached. */}
      {pair.previous !== null && <Delta value={pair.delta} unit={pair.unit} improved={pair.improved} />}
    </div>
    {pair.previous !== null && <div className="small dim" style={{ marginTop: 6 }}>
      {t('Previous {0} {1} · {2}', fmtFixed(prev.value, prev.digits), prev.unit, fmtDate(pair.previousDate))}
    </div>}
    {pair.vo2 && <div className="small dim" style={{ marginTop: 3 }}>{t('Estimated VO₂max {0}', pair.vo2)}</div>}
    <div className="small dim" style={{ marginTop: 3, color: stale > 180 ? 'var(--label-2)' : undefined }}>
      {stale > 180 ? t('Last tested {0} · over six months ago', fmtDate(pair.currentDate)) : t('Last tested {0}', fmtDate(pair.currentDate))}
    </div>
    <div style={{ marginTop: 14 }}>
      <Button onClick={fieldTestSheet}>{t('Log a test')}</Button>
    </div>
  </div>
}

export default function Progress() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)

  // Pin each area's representative lift the first time it can be derived, so the headline
  // never silently swaps to a different exercise when training patterns shift.
  //
  // Synced like any other profile state, because it is profile state: which lift represents
  // an area is a decision about how your training reads, and it has to be the same decision
  // on your phone as on your laptop. `update` pushes by default, so this rides the ordinary
  // debounced sync rather than needing anything of its own.
  //
  // Safe to run on every mount: missingReps only fills areas with no stored pin, so a choice
  // that arrived from the server is never overwritten by a fresh derivation. boot() pulls
  // before any screen mounts, so the server's answer is already in place by the time this
  // runs, and once every area is pinned it produces nothing and writes nothing.
  useEffect(() => {
    const add = missingReps(S)
    if (Object.keys(add).length) update(s => { s.strengthReps = { ...(s.strengthReps || {}), ...add } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S.workouts.length])

  return <>
    <div className="hdr">
      <div><h1>{t('Progress')}</h1><div className="sub">{t('Consistency, strength & cardio')}</div></div>
    </div>
    <Consistency S={S} />
    <Strength S={S} />
    <Cardio S={S} />
  </>
}
