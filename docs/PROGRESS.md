# Progress — consistency, strength & cardio

The screen this fork exists for, and the reasoning behind every number on it.

Progress answers three questions and refuses to answer anything else:

1. **Am I training consistently?**
2. **Am I getting stronger?**
3. **Is my cardio improving?**

It lives at `/progress`, reached from the medal button in the Stats header. Stats keeps the
heatmap, muscle map, body weight and per-exercise charts; Home keeps answering "what do I do
now". Progress answers neither.

---

## The governing rule: ME NOW vs ME BEFORE

Every number is you against your own past. There are no population bands, no percentiles, no
levels and no composite score anywhere on the screen.

One constraint follows from that and drives most of the design:

> **Every primary number must be capable of going down.**

A metric that can only rise cannot answer "am I getting stronger?" — it can only ever answer
"yes". That single rule is what rules out the most convenient implementation of the strength
number, and it is why a decline renders as a decline rather than being smoothed away.

---

## Consistency

**What counts as training:** a *day*, not a session. A distinct `w.d` with at least one
completed set.

- **Days rather than sessions**, because `w.d` is not unique — two sessions on one Saturday is
  one training day — and imported history is one-session-per-day by construction, so a session
  count is not comparable between logged and imported data.
- **A workout with nothing checked off is not training.** `finishWorkout` lets you "Finish
  anyway" with zero completed sets, and those records would otherwise inflate every number
  here. This is the single most important correctness detail in the module.

### This week is two facts, never a fraction

    This week      3 training days · 3 planned

It is deliberately **not** rendered as "3 of 3 planned". Trained days and planned days count
different sets, so dividing one by the other lies in both directions:

| Situation | "3 of 3 planned" would say | Truth |
|---|---|---|
| 3 planned; trained 2 planned + 1 unplanned | a perfect week | a planned session was missed |
| 3 planned; trained 4 days | `4 of 3` | not a sentence |

Two independent numbers cannot lie that way.

### Eight weeks, goal-free

    Last 8 weeks   2.6 days/week · trained in 7 of 8

There is no target to hit, on purpose. `S.week` holds only your *current* plan and has no
history, so scoring past weeks against it would let switching from a three-day to a five-day
plan retroactively re-score every week behind you. A consistency figure that silently rewrites
itself is worse than no figure. An average and a count cannot be invalidated that way, and
neither can be gamed by editing the plan.

Nothing here is punitive: no day streaks, no loss language. A missed week lowers an average
slightly and shows up in "7 of 8". It resets nothing.

### Implementation notes

- The planned count uses `effectiveRoutine()`, **not** `effectiveRoutineId()`. The id version
  validates a `dayPlan` override against `S.routines` but returns `S.week[wd]` unchecked, so a
  routine deleted without clearing the weekly plan would count as planned forever.
- Week keys are sorted on a Monday-in-milliseconds value, never on `weekKey()`, whose output is
  not zero-padded (`'2026-5'`) and sorts as a string into nonsense.
- Dates are always parsed at local noon. `new Date(iso)` parses as UTC midnight and lands on
  the previous day for anyone west of Greenwich.
- Weeks are stepped with `setDate`, not by adding 86,400,000 ms, so a clock change inside the
  week cannot shift a date by one.

---

## Strength

One representative lift per body area, with what it does now and what it did about three
months ago.

### The metric: estimated 1RM on *total* load

Every alternative was rejected for a specific reason:

| Candidate | Why not |
|---|---|
| `S.exWeights` (stored per-exercise max) | Monotonic by construction — `Math.max` at every write site. Can never show a plateau or a decline, so "am I stronger?" can only answer yes. Also `0` for bodyweight work, and its two write paths disagree (max-wins in-app, newest-wins on import). |
| Raw top-set weight | Non-monotonic, but rep-blind: 100×5 → 100×10 is real progress and moves it by exactly zero. |
| Session volume | Confounds training style with capability. |
| e1RM on the logged weight | Absent for roughly a quarter of real training. |

That last row is the important one. A bodyweight pull-up is stored as `w = 0`, and every 1RM
formula correctly refuses a zero weight — so estimating from the logged weight left every
bodyweight movement silently absent. Computing **total load first, then estimating** fixes it:

    totalLoad = (bodyweight share, if the movement carries you) + logged weight
    e1RM      = estimate1RM(totalLoad, reps)

An 80 kg lifter doing a weighted pull-up at +20 kg × 5 gives `(80 + 20) × (1 + 5/30) = 116.7`.
Estimating the plate alone and adding bodyweight afterwards gives `103.3` — a full band low.

Remaining holes stay holes: sets above `REP_CAP` (12) and timed sets produce nothing, and an
area with nothing honest to say is left out rather than filled in.

### Assisted variants are excluded outright

The catalogue contains `assisted pull-up`, `assisted standing chin-up`,
`assisted parallel close grip pull-up`, `assisted chest dip (kneeling)` and others. On these the
logged weight is **assistance — subtractive**. Adding it the way the bodyweight-share table adds
a weight belt would read an 80 kg lifter on 40 kg of help as 120 kg of total load, *more* than
the same lifter unassisted — and the number would **fall as they got stronger** and needed less
help.

That is not a fringe case. The representative for an area is chosen by how often you train it,
and assisted pull-ups are exactly what a beginner trains most. The inversion would have landed
on the headline for precisely the people this screen is for. There is no honest absolute load
here, so these produce nothing at all.

### Choosing the representative lift

- **By training frequency**, not by heaviest load. A max over an area picks the leg press over
  the squat and calls a leverage artifact strength.
- **Only among lifts that can actually produce an estimate.** Otherwise a 15-rep finisher logged
  one day more often than your working squat takes the slot and deletes the entire row.
- **Then pinned.** Once chosen it is kept in `S.strengthReps`, because a headline that silently
  swaps to a different lift is comparing two different things and calling the difference
  progress. Tap any row to change it deliberately.
- The exercise name is **always rendered**, so if the representative ever does change it is
  visible rather than silent.

### The comparison window

- **Current** — best estimate in the last 30 days.
- **Baseline** — best estimate in the 30-day band centred on 90 days ago.

Both ends are non-monotonic, so a plateau shows as a plateau and a decline shows as a decline —
but neither can be moved by a single deload session, which a bare most-recent-session reading
could not manage.

When there is no such band the comparison falls back to the first thing ever logged and says
"since you started". The **real baseline date is always printed**, because "vs 3 months ago"
across a training gap can quietly mean fourteen.

### Body areas

The taxonomy is `bp` (body part) — the only one in the catalogue with full coverage. Custom
exercises always have one (the editor refuses to save without it) while `tg` and `sm` are empty
on them, and all ten values are already translated in every locale.

Eight are usable: `chest`, `back`, `shoulders`, `upper arms`, `lower arms`, `upper legs`,
`lower legs`, `waist`. Two are excluded — `cardio` has no load concept, and `neck` has two
exercises in a catalogue of 1,324.

In practice a barbell trainee sees four or five rows. That is correct: an area with no honest
number is **absent, not blank**.

### Which bodyweight?

Bodyweight movements are scored with the bodyweight **at the time of the session** — `w.bw`,
captured when the workout starts, falling back to the nearest weigh-in on or before that date,
then to the most recent one.

Using today's number for a session six months ago would silently rewrite what you did. The
honest consequence, which the screen states out loud: **losing weight lowers a bodyweight lift's
absolute load even though nothing about you got weaker.**

---

## Cardio

### Distance is the answer; VO₂max is a footnote

The primary number is the **Cooper 12-minute run distance**, not VO₂max. A distance is directly
understood, directly repeatable and directly comparable. VO₂max is a derived estimate.

Displayed as `2.21 km` — metres become kilometres past 1,000, because "2,210 m" is a number you
have to convert first. **Storage is untouched**: results are stored in metres, and comparisons
run on the stored metres. The delta stays in metres too (`↑ 160 m`), because "0.16 km" reads as
nothing at all.

### Direction of good

Each test declares which way is better:

| Test | Field | Better |
|---|---|---|
| `cooper` — 12-minute run | metres | **higher** |
| `run24` — 2.4 km time trial | minutes | **lower** |
| `step` — Queens College step test | bpm | **lower** |

Without this, a 2.4 km trial improving from 12.0 to 11.4 min renders as "↓ 0.6 min" — a
decline, in the one block whose entire job is reporting improvement.

### Same instrument only

Comparisons are latest-vs-previous **of the same kind**. A Cooper run and a step test are
different instruments with different error; a "change" between them is not a change, it is
noise with a unit attached. The primary block shows Cooper whenever any Cooper result exists,
otherwise the most recently tested kind, labelled with its own name and unit.

### The raw result always saves

An earlier version of the logging sheet disabled its own save button until the VO₂max formula
was willing to produce an estimate. That meant a 350 m twelve-minute run — a real distance a
real person covered — could not be recorded at all, and so could never be compared against the
next one.

The raw measurement is the record. VO₂max is shown when it can be derived, and **never gates
anything**. Below the range the 1968 regression was fitted on, the result is logged anyway and
the sheet says so plainly.

### Deliberately not ported

The retired athletic-profile branch also had VO₂max **population norms** by age and sex, and a
**resting-heart-rate** test. Neither came across. The norms answered "how do you compare to
other people", which is the question this product stopped asking. The RHR test is an inference
rather than a measurement, and was the only one that needed to know your age — dropping it
removed the age requirement entirely.

---

## Data model

Two top-level keys were added to the profile:

    cardioTests: []      // [{ d, kind, values, vo2 }] — vo2 nullable; the raw values are the record
    strengthReps: {}     // { [bodyPart]: exerciseId } — which lift represents each area

**Top-level, not nested under one namespace.** Loaded state is overlaid with a *shallow*
`Object.assign` on every path — local load, server pull, backup import — so a nested namespace
would be replaced wholesale by an older copy instead of merged.

**No migration.** A profile that predates the feature arrives without both keys and gets the
defaults. `strengthReps` then derives itself from history the first time Progress is opened.

### Cross-device sync

Which lift represents an area is *profile* state, not a device preference: it decides how your
training reads, so it has to be the same answer on a phone as on a laptop.

It rides the ordinary state sync with no plumbing of its own — `pushState` PUTs the whole
profile blob, the server stores it verbatim, `pullState` shallow-merges the reply over the
defaults. Deriving on mount is safe because the derivation only fills areas with **no** stored
pin, so an answer that arrived from another device is never overwritten, and `boot()` pulls
before any screen mounts.

---

## Known limitations

- **Bodyweight-movement numbers move with your bodyweight.** Lose 8 kg and your pull-up's
  absolute load drops even though nothing got weaker. Stated on screen rather than hidden.
- **`REP_CAP` (12) suppresses high-rep areas.** Under the shipped starter plan `lower legs` has
  no number, because the calf raise is prescribed at 15 reps. Correct behaviour — absent beats
  invented — but surprising the first time.
- **Home and Progress count differently.** Home's streak card uses workout *records* matching
  `weekKey`, and `Object.keys(S.week).length` for the plan. Progress uses training *days* and
  `effectiveRoutine()`. So two sessions in one day is 2 on Home and 1 on Progress, and a routine
  deleted without clearing `S.week` still counts as planned on Home. Pre-existing behaviour,
  now visible because Progress sits beside it.
- **Cardio distance is always metres**, regardless of the kg/lb profile setting. No unit
  conversion in v1.
- **`waist` will almost always be absent.** Ab work is largely bodyweight with `w = 0` and is
  not in the bodyweight-share table, and planks are timed.

---

## How it was verified

Unit tests live next to the code — `consistency.test.js`, `strength.test.js`, `cardio.test.js`,
plus `Progress.smoke.test.js` for the import graph (there is no jsdom in this project, so the
smoke test is an import test). Regression cases include the `w = 0` pull-up, the 116.7 kg
weighted-pull-up arithmetic, assisted exclusion, frequency-vs-estimable selection, deload
resistance, and a faster 2.4 km time reading as an improvement.

Beyond the suite, the screen was driven in a real browser at 375 px across five seeded states —
new user, lifting-but-no-cardio, established, an assisted-pull-up profile, and a
four-training-days-on-a-three-day-plan week — checking for horizontal scroll and console errors
in each. Cross-device sync was verified against the real API server with two independent browser
contexts on one profile: choose on A, appears on B, change on B, appears on a fresh A.
