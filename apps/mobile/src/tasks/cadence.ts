import type { Cadence } from '@toda/backend/model'
import { type CalendarDate, daysBetween, localDate } from './dates'
import type { Task } from './model'
import { defaultRepeat, nextOccurrence, step } from './recurrence'

export type { Cadence } from '@toda/backend/model'

/** A subtask's own schedule, as it is stored. */
export type ScheduleCadence = Extract<Cadence, { kind: 'schedule' }>

/** Which of its task's dates around its own a scheduled subtask lands on. */
export type Lean = ScheduleCadence['lean']

/** The most occurrences of a task looked through for the one a subtask is next due in. */
const LOOKAHEAD = 1000

/** How many of a task's coming occurrences are looked at to tell a subtask is due in each. */
const EVERY_TIME_ROUNDS = 8

/**
 * One occurrence of a repeating task as a subtask's cadence sees it: the day it is done on (its
 * date, or today once that has passed), which one it is, and the task's next date after it.
 */
type Round = { date: CalendarDate; occurrence: number; following: CalendarDate | null }

/**
 * The subtask's cadence where it applies: a subtask of a repeating task with a date. Anywhere
 * else a cadence says nothing, and the subtask is due every time.
 */
export function cadenceOf(subtask: Task, parent: Task | undefined): Cadence | null {
  const cadence = subtask.cadence ?? null

  return cadence !== null &&
    parent !== undefined &&
    subtask.parentId === parent.clientId &&
    parent.repeat !== null &&
    parent.dueDate !== null
    ? cadence
    : null
}

/**
 * Whether a subtask on its own schedule, meant for `next`, lands on the task's occurrence done on
 * `date`, with `following` the task's next date after it (null for its last). A date on or after
 * `next` takes it, as does the last date before it when no later one falls before or on `next`:
 *
 * - `closest`: the nearer of that date and the following one, the earlier on a tie;
 * - `before` (never late): the earlier, unless the following one is late by no more than
 *   `leeway` days and nearer;
 * - `after` (never early): the following one, unless this one is early by no more than `leeway`
 *   days and nearer.
 */
export function landsOn(
  cadence: Pick<ScheduleCadence, 'next' | 'lean' | 'leeway'>,
  date: CalendarDate,
  following: CalendarDate | null,
) {
  if (date >= cadence.next || following === null) return true

  if (following <= cadence.next) return false

  const early = daysBetween(date, cadence.next)
  const late = daysBetween(cadence.next, following)

  switch (cadence.lean) {
    case 'closest':
      return early <= late
    case 'before':
      return !(late <= cadence.leeway && late < early)
    case 'after':
      return early <= cadence.leeway && early < late
  }
}

/** Whether a cadence is due in an occurrence of its task. */
function dueIn(cadence: Cadence, round: Round) {
  return cadence.kind === 'every'
    ? round.occurrence >= cadence.from && (round.occurrence - cadence.from) % cadence.count === 0
    : landsOn(cadence, round.date, round.following)
}

/**
 * The task's current occurrence as a cadence sees it. Once its date has passed it is done today
 * at the earliest, and its next date counts from today: a task that repeats from when it is done
 * comes back later the later it is done, and a fixed one skips the dates that went by.
 */
function currentRound(parent: Task, today: CalendarDate): Round {
  // SAFETY: only called for a parent with a date, as `cadenceOf` requires.
  const due = parent.dueDate as CalendarDate
  const date = due < today ? today : due

  const following =
    parent.repeat === null ? null : nextOccurrence(parent.repeat, due, date, parent.occurrence)

  return { date, occurrence: parent.occurrence, following }
}

/** The occurrence after `round`, as if it is done on its own day. */
function followingRound(parent: Task, round: Round): Round | null {
  if (round.following === null || parent.repeat === null) return null
  const date = round.following

  return {
    date,
    occurrence: round.occurrence + 1,
    following: nextOccurrence(parent.repeat, date, date, round.occurrence + 1),
  }
}

/**
 * Whether a subtask is due in its task's current occurrence. One that is not rests: it is left
 * out of the lists and left open when its task is done. Without a cadence it always is.
 */
export function isDue(subtask: Task, parent: Task | undefined, today: CalendarDate) {
  const cadence = cadenceOf(subtask, parent)

  if (cadence === null || parent === undefined) return true

  return dueIn(cadence, currentRound(parent, today))
}

/** Whether a subtask is resting in its task's current occurrence: open, and not due. */
export function rests(subtask: Task, parent: Task | undefined, today: CalendarDate) {
  return subtask.completedAt === null && !isDue(subtask, parent, today)
}

/**
 * When a subtask is next due: the task's date it comes with and how many of the task's
 * occurrences come first (0 for this one), as if each later one is done on its own day; null
 * when the task stops repeating first.
 */
export function nextDue(
  subtask: Task,
  parent: Task | undefined,
  today: CalendarDate,
): { date: CalendarDate; after: number } | null {
  const cadence = cadenceOf(subtask, parent)

  if (parent === undefined || parent.dueDate === null) return null

  let round: Round | null = currentRound(parent, today)

  if (cadence === null) return { date: round.date, after: 0 }

  for (let after = 0; round !== null && after < LOOKAHEAD; after += 1) {
    if (dueIn(cadence, round)) return { date: round.date, after }
    round = followingRound(parent, round)
  }

  return null
}

/** The date after `date` on a subtask's own schedule, from `from`. */
function stepSchedule(cadence: ScheduleCadence, date: CalendarDate, from = cadence.from) {
  return step(defaultRepeat(cadence.unit, cadence.interval), date, from)
}

/**
 * A scheduled cadence once it is done on `doneOn` in an occurrence done on `date`: a fixed one is
 * next meant for the first of its dates after the one it was meant for and after `date`; one
 * counted from when it is done starts again from `doneOn`.
 */
function advance(cadence: ScheduleCadence, date: CalendarDate, doneOn: CalendarDate) {
  if (cadence.anchor === 'completion')
    return { ...cadence, from: doneOn, next: stepSchedule(cadence, doneOn, doneOn) }

  let next = stepSchedule(cadence, cadence.next)

  for (let guard = 0; next <= date && guard < 100_000; guard += 1)
    next = stepSchedule(cadence, next)

  return { ...cadence, next }
}

/**
 * The cadence the subtask's copy carries into its task's next occurrence, once the task is done
 * on `doneOn`. One on its own schedule that was due, or was done anyway, moves on (see `advance`),
 * counting from the day the subtask itself was done; one that rested is still meant for the same
 * date. Counting every few times needs nothing moved.
 */
export function carriedCadence(
  subtask: Task,
  parent: Task,
  today: CalendarDate,
  doneOn: CalendarDate = today,
): Cadence | null {
  const cadence = subtask.cadence ?? null

  if (cadence === null || cadence.kind === 'every' || parent.dueDate === null) return cadence

  if (rests(subtask, parent, today)) return cadence

  const done = subtask.completedAt === null ? doneOn : localDate(subtask.completedAt)

  return advance(cadence, currentRound(parent, today).date, done)
}

/**
 * Whether a cadence on its own schedule is due in each of its task's coming occurrences, as when
 * the task repeats as often as it or less: then it is the same as every time.
 */
export function dueEveryTime(cadence: Cadence, parent: Task, today: CalendarDate) {
  if (cadence.kind === 'every' || parent.dueDate === null) return false

  let current = cadence
  let round: Round | null = currentRound(parent, today)

  for (let index = 0; round !== null && index < EVERY_TIME_ROUNDS; index += 1) {
    if (!dueIn(current, round)) return false
    current = advance(current, round.date, round.date)
    round = followingRound(parent, round)
  }

  return true
}

/** A subtask due once every `count` times, starting `after` occurrences on. */
export function everyCadence(parent: Task, count: number, after = 0): Cadence {
  return { kind: 'every', count, from: parent.occurrence + after }
}

/**
 * A subtask on a schedule of its own, every `interval` units from `start`, landing on the task's
 * date closest to each of its dates unless told otherwise, on fixed dates.
 */
export function scheduleCadence(
  unit: ScheduleCadence['unit'],
  interval: number,
  start: CalendarDate,
  lean: Lean = 'closest',
  leeway = 0,
): ScheduleCadence {
  return { kind: 'schedule', unit, interval, from: start, next: start, lean, leeway, anchor: 'due' }
}
