import type { Condition, Repeat } from '@toda/backend/model'
import {
  addDays,
  addMonths,
  type CalendarDate,
  dateOf,
  daysInMonth,
  parts,
  startOfWeek,
  weekday,
  type Weekday,
} from './dates'

export type { Condition, Repeat } from '@toda/backend/model'

/**
 * Whether another task's series is due on a date, for a repeat's `task` conditions; null when no
 * such series exists, which leaves the condition out. Without one, `task` conditions are left out.
 */
export type Schedules = (seriesId: string, date: CalendarDate) => boolean | null

/** The most dates looked through for one a repeat's conditions keep. */
const CONDITION_SEARCH = 3660

/** Whether a condition names `date`, or null when it cannot tell, which leaves it out. */
function names(condition: Condition, date: CalendarDate, schedules?: Schedules): boolean | null {
  switch (condition.kind) {
    case 'weekdays':
      return condition.weekdays.includes(weekday(date))
    case 'months':
      return condition.months.includes(parts(date).month)
    case 'dates':
      return date >= condition.from && date <= condition.to
    case 'task':
      return schedules ? schedules(condition.seriesId, date) : null
  }
}

/**
 * Whether a repeat's conditions keep `date`: every "only" condition names it and no "except" one
 * does. A rule without conditions keeps every date.
 */
export function keeps(
  conditions: readonly Condition[] | undefined,
  date: CalendarDate,
  schedules?: Schedules,
) {
  return (conditions ?? []).every((condition) => {
    const named = names(condition, date, schedules)

    return named === null || named !== condition.except
  })
}

/** The day of the month a monthly rule names: -1 is the last day. */
function monthDay(year: number, month: number, day: number) {
  const length = daysInMonth(year, month)

  return day === -1 ? length : Math.min(day, length)
}

/**
 * The nth weekday of a month (week 1–4, or -1 for the last). A fifth week is never asked for, so
 * every month has the day.
 */
export function nthWeekday(year: number, month: number, week: number, day: Weekday) {
  if (week === -1) {
    const last = dateOf(year, month, daysInMonth(year, month))

    return addDays(last, -((weekday(last) - day + 7) % 7))
  }

  const first = dateOf(year, month, 1)

  return addDays(first, ((day - weekday(first) + 7) % 7) + (week - 1) * 7)
}

/** The days a weekly rule falls on, sorted; none chosen means the anchor's own weekday. */
function weekdaysOf(repeat: Repeat, anchor: CalendarDate): Weekday[] {
  // SAFETY: the server only accepts weekdays 0 to 6.
  const days = (repeat.weekdays as Weekday[]).slice().sort((a, b) => a - b)

  return days.length > 0 ? days : [weekday(anchor)]
}

/** The date in a given month that a monthly rule picks, from the anchor where it names none. */
function monthlyDate(repeat: Repeat, year: number, month: number, anchor: CalendarDate) {
  const monthly = repeat.monthly ?? { kind: 'day' as const, day: parts(anchor).day }

  return monthly.kind === 'day'
    ? dateOf(year, month, monthDay(year, month, monthly.day))
    : // SAFETY: the server only accepts weekdays 0 to 6.
      nthWeekday(year, month, monthly.week, monthly.weekday as Weekday)
}

/**
 * The first date on or after `date` that the rule falls on: what a new repeat starts from. Daily
 * and yearly rules fall on any date.
 */
export function snap(repeat: Repeat, date: CalendarDate): CalendarDate {
  if (repeat.unit === 'week') {
    const days = weekdaysOf(repeat, date)
    const today = weekday(date)
    const later = days.find((day) => day >= today)

    return later === undefined
      ? addDays(startOfWeek(date), 7 + days[0]!)
      : addDays(date, later - today)
  }

  if (repeat.unit === 'month' && repeat.monthly !== null) {
    const { year, month } = parts(date)
    const candidate = monthlyDate(repeat, year, month, date)

    if (candidate >= date) return candidate
    const next = addMonths(dateOf(year, month, 1), 1)

    return monthlyDate(repeat, parts(next).year, parts(next).month, date)
  }

  return date
}

/**
 * The rule's next date after `date`, a whole interval on: the next chosen weekday later in the
 * same week, or else the first chosen weekday `interval` weeks on.
 */
export function step(repeat: Repeat, date: CalendarDate, anchor: CalendarDate = date) {
  switch (repeat.unit) {
    case 'day':
      return addDays(date, repeat.interval)
    case 'week': {
      const days = weekdaysOf(repeat, anchor)
      const later = days.find((day) => day > weekday(date))

      return later === undefined
        ? addDays(startOfWeek(date), 7 * repeat.interval + days[0]!)
        : addDays(startOfWeek(date), later)
    }

    case 'month': {
      const next = addMonths(dateOf(parts(date).year, parts(date).month, 1), repeat.interval)

      return monthlyDate(repeat, parts(next).year, parts(next).month, anchor)
    }

    case 'year': {
      const { month, day } = parts(anchor)
      const target = parts(date).year + repeat.interval

      // A repeat from 29 February falls on the 28th in other years.
      return dateOf(target, month, Math.min(day, daysInMonth(target, month)))
    }
  }
}

/**
 * When the next occurrence of a repeating task falls, once the occurrence due on `due` is done on
 * `completed`; null when the series has ended.
 *
 * - `anchor: 'due'` keeps a fixed schedule: the first date of the schedule after the one that was
 *   due, skipping any that also passed before it was done. Done late or early, later dates stay.
 * - `anchor: 'completion'` counts from the day it was done: three days after a three-day chore is
 *   done, however late it was, and a monthly one a month after. Only rules that name weekdays or
 *   a day of the month look for their next such day after it.
 */
export function nextOccurrence(
  repeat: Repeat,
  due: CalendarDate,
  completed: CalendarDate,
  occurrence: number,
  schedules?: Schedules,
): CalendarDate | null {
  if (repeat.end.kind === 'after' && occurrence >= repeat.end.count) return null

  let next: CalendarDate

  if (repeat.anchor === 'completion') {
    next = step(repeat, completed, completed)
  } else {
    next = step(repeat, due, due)

    // Occurrences that came and went before it was done are skipped, so only one is ever open.
    for (let guard = 0; next <= completed && guard < 100_000; guard += 1) {
      next = step(repeat, next, due)
    }
  }

  next = kept(repeat, next, due, schedules)

  if (repeat.end.kind === 'on' && next > repeat.end.date) return null

  return next
}

/**
 * The first date from `date` on that the repeat's conditions keep: a fixed schedule moves on to
 * its next date, one counted from completion to the next day. Where none comes within ten years,
 * the conditions leave out every date and are let go of: `date` stays.
 */
function kept(repeat: Repeat, date: CalendarDate, due: CalendarDate, schedules?: Schedules) {
  if (!repeat.conditions?.length) return date
  let candidate = date

  for (let guard = 0; guard < CONDITION_SEARCH; guard += 1) {
    // Past its end, the repeat ends rather than letting go of its conditions.
    if (repeat.end.kind === 'on' && candidate > repeat.end.date) return candidate

    if (keeps(repeat.conditions, candidate, schedules)) return candidate
    candidate =
      repeat.anchor === 'completion' ? addDays(candidate, 1) : step(repeat, candidate, due)
  }

  return date
}

/** A new rule: every `interval` units, counted from the day each occurrence is done. */
export function defaultRepeat(unit: Repeat['unit'], interval = 1): Repeat {
  return {
    unit,
    interval,
    weekdays: [],
    monthly: null,
    anchor: 'completion',
    end: { kind: 'never' },
  }
}

/**
 * The same rule on a fixed schedule, pinned to `due`'s weekday or day of the month where it names
 * none, so the schedule stays put whatever day it is done.
 */
export function fixedRepeat(repeat: Repeat, due: CalendarDate): Repeat {
  return {
    ...repeat,
    anchor: 'due',
    weekdays:
      repeat.unit === 'week' && repeat.weekdays.length === 0 ? [weekday(due)] : repeat.weekdays,
    monthly:
      repeat.unit === 'month' && repeat.monthly === null
        ? { kind: 'day', day: parts(due).day }
        : repeat.monthly,
  }
}

/** The same rule counted from completion: a plain interval. */
export function intervalRepeat(repeat: Repeat): Repeat {
  return { ...repeat, anchor: 'completion', weekdays: [], monthly: null }
}

/** Monday to Friday, every week. */
export function isEveryWeekday(repeat: Repeat) {
  return (
    repeat.unit === 'week' &&
    repeat.interval === 1 &&
    repeat.weekdays.length === 5 &&
    [0, 1, 2, 3, 4].every((day) => repeat.weekdays.includes(day))
  )
}
