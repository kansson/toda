import type { Cadence } from '@toda/backend/model'
import { type CalendarDate, daysBetween } from './dates'
import type { Task } from './model'
import { defaultRepeat, nextOccurrence, step } from './recurrence'

export type { Cadence } from '@toda/backend/model'

/** A subtask's own schedule, as it is stored. */
export type ScheduleCadence = Extract<Cadence, { kind: 'schedule' }>

/** Which of its task's dates around its own a scheduled subtask lands on. */
export type Lean = ScheduleCadence['lean']

/** The most occurrences of a task looked through for the one a subtask next comes round in. */
const LOOKAHEAD = 1000

/** One occurrence of a repeating task: its date and which one it is. */
type Round = { date: CalendarDate; occurrence: number }

/**
 * The subtask's cadence where it applies: a subtask of a repeating task with a date. Anywhere
 * else a cadence says nothing, and the subtask comes every time.
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
 * Whether a subtask on its own schedule, meant for `next`, lands on the task's date `date`,
 * with `following` the task's next date after it (null for its last). A date on or after `next`
 * takes it, as does the last date before it when no later one falls before or on `next`:
 *
 * - `closest`: the nearer of that date and the following one, the earlier on a tie;
 * - `before`: the earlier, unless the following one is late by no more than `leeway` days and
 *   nearer;
 * - `after`: the following one, unless this one is early by no more than `leeway` days and
 *   nearer.
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

/** Whether a cadence comes round in an occurrence of its task, given the task's next date. */
function comesRoundIn(cadence: Cadence, round: Round, following: CalendarDate | null) {
  return cadence.kind === 'every'
    ? round.occurrence >= cadence.from && (round.occurrence - cadence.from) % cadence.count === 0
    : landsOn(cadence, round.date, following)
}

/** The task's date after an occurrence, as if each is done on its own day. */
function followingDate(parent: Task, round: Round) {
  return parent.repeat === null
    ? null
    : nextOccurrence(parent.repeat, round.date, round.date, round.occurrence)
}

/**
 * Whether a subtask comes round in its task's current occurrence. One that does not rests: it is
 * left out of the lists and left open when its task is done. Without a cadence it always does.
 */
export function comesRound(subtask: Task, parent: Task | undefined) {
  const cadence = cadenceOf(subtask, parent)

  if (cadence === null || parent === undefined || parent.dueDate === null) return true

  const round = { date: parent.dueDate, occurrence: parent.occurrence }

  return comesRoundIn(cadence, round, followingDate(parent, round))
}

/** Whether a subtask is resting in its task's current occurrence: open, and not its turn. */
export function rests(subtask: Task, parent: Task | undefined) {
  return subtask.completedAt === null && !comesRound(subtask, parent)
}

/**
 * When a subtask next comes round: the task's date it comes with and how many of the task's
 * occurrences come first (0 for this one), as if each is done on its own day; null when the
 * task's repeat ends first.
 */
export function nextRound(
  subtask: Task,
  parent: Task | undefined,
): { date: CalendarDate; after: number } | null {
  const cadence = cadenceOf(subtask, parent)

  if (parent === undefined || parent.dueDate === null) return null

  if (cadence === null) return { date: parent.dueDate, after: 0 }
  let round: Round = { date: parent.dueDate, occurrence: parent.occurrence }

  for (let after = 0; after < LOOKAHEAD; after += 1) {
    const following = followingDate(parent, round)

    if (comesRoundIn(cadence, round, following)) return { date: round.date, after }

    if (following === null) return null
    round = { date: following, occurrence: round.occurrence + 1 }
  }

  return null
}

/** The date after `date` on a subtask's own schedule. */
function stepSchedule(cadence: ScheduleCadence, date: CalendarDate) {
  return step(defaultRepeat(cadence.unit, cadence.interval), date, cadence.from)
}

/**
 * The cadence the subtask's copy carries into its task's next occurrence. One on its own
 * schedule that came round, or was done, is next meant for the first date of its schedule after
 * the one it was meant for and after the task's date it came with; one that rested is still meant
 * for the same date. Counting every few times needs nothing moved.
 */
export function carriedCadence(subtask: Task, parent: Task): Cadence | null {
  const cadence = subtask.cadence ?? null

  if (cadence === null || cadence.kind === 'every' || parent.dueDate === null) return cadence

  if (subtask.completedAt === null && !comesRound(subtask, parent)) return cadence

  let next = stepSchedule(cadence, cadence.next)

  for (let guard = 0; next <= parent.dueDate && guard < 100_000; guard += 1)
    next = stepSchedule(cadence, next)

  return { ...cadence, next }
}

/** A subtask that comes round once every `count` times, starting `after` occurrences on. */
export function everyCadence(parent: Task, count: number, after = 0): Cadence {
  return { kind: 'every', count, from: parent.occurrence + after }
}

/**
 * A subtask on a schedule of its own, every `interval` units from `start`, landing on the task's
 * date closest to each of its dates unless told otherwise.
 */
export function scheduleCadence(
  unit: ScheduleCadence['unit'],
  interval: number,
  start: CalendarDate,
  lean: Lean = 'closest',
  leeway = 0,
): ScheduleCadence {
  return { kind: 'schedule', unit, interval, from: start, next: start, lean, leeway }
}
