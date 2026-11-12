import type { CalendarDate } from './dates'
import type { Condition, Task } from './model'
import { nextOccurrence, type Schedules } from './recurrence'

/** The most of a series' coming dates looked through to tell whether it is due on a day. */
const SERIES_SEARCH = 3660

/** The series a top-level task belongs to: its first occurrence's id, which every one carries. */
export function seriesOf(task: Pick<Task, 'clientId' | 'seriesId'>) {
  return task.seriesId ?? task.clientId
}

/**
 * Whether each series among `tasks` is due on a day, for a repeat's `task` conditions: on an
 * occurrence's own date, done or not, or on one of the dates its open occurrence comes back on,
 * each counted as done on its day. Those dates follow the other task's own weekday, month and date
 * conditions but not its `task` ones, so two tasks that each name the other never go round in a
 * circle. `self`, the series asking, is never due by this: a task does not wait for itself.
 */
export function seriesSchedules(tasks: readonly Task[], self?: string): Schedules {
  const bySeries = new Map<string, Task[]>()

  for (const task of tasks) {
    if (task.parentId !== null) continue
    const series = seriesOf(task)
    const rows = bySeries.get(series)

    if (rows) rows.push(task)
    else bySeries.set(series, [task])
  }

  return (seriesId, date) => {
    const rows = seriesId === self ? undefined : bySeries.get(seriesId)

    if (!rows) return null

    if (rows.some((row) => row.dueDate === date)) return true
    const open = rows.find((row) => row.completedAt === null && row.dueDate !== null)

    if (!open?.repeat || open.dueDate === null || open.dueDate > date) return false
    let current: CalendarDate | null = open.dueDate
    let occurrence = open.occurrence

    for (let guard = 0; current !== null && current < date && guard < SERIES_SEARCH; guard += 1) {
      current = nextOccurrence(open.repeat, current, current, occurrence)
      occurrence += 1
    }

    return current === date
  }
}

/**
 * The tasks a repeat's conditions can mind: each open top-level task with a date, once per
 * series, by title, without the series asking.
 */
export function mindableTasks(tasks: readonly Task[], self?: string) {
  const seen = new Map<string, Task>()

  for (const task of tasks) {
    const series = seriesOf(task)

    if (task.parentId === null && task.completedAt === null && task.dueDate !== null)
      if (series !== self && !seen.has(series)) seen.set(series, task)
  }

  return [...seen.entries()]
    .map(([seriesId, task]) => ({ seriesId, task }))
    .sort((a, b) => a.task.title.localeCompare(b.task.title))
}

/** Each series' title, from its latest occurrence, for naming the tasks conditions mind. */
export function seriesTitles(tasks: readonly Task[]) {
  const latest = new Map<string, Task>()

  for (const task of tasks) {
    if (task.parentId !== null) continue
    const series = seriesOf(task)
    const current = latest.get(series)

    if (!current || task.occurrence > current.occurrence) latest.set(series, task)
  }

  return new Map([...latest].map(([series, task]) => [series, task.title]))
}

/**
 * A repeat's conditions as the repeat sheet sets them: the weekdays and months it skips, one run
 * of days it skips, and one other task whose days it skips or keeps to.
 */
export type SkipSet = {
  weekdays: number[]
  months: number[]
  period: { from: CalendarDate; to: CalendarDate } | null
  task: { seriesId: string; except: boolean } | null
}

const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/** What a set of "only" or "except" conditions on weekdays or months leaves out of `all`. */
function skipped(all: readonly number[], conditions: { values: number[]; except: boolean }[]) {
  const left = new Set<number>()

  for (const { values, except } of conditions)
    for (const value of all) if (values.includes(value) === except) left.add(value)

  return all.filter((value) => left.has(value))
}

/** A repeat's conditions as the sheet shows them, whatever way they were written. */
export function skipSet(conditions: readonly Condition[] | undefined): SkipSet {
  const list = conditions ?? []
  const period = list.find((condition) => condition.kind === 'dates' && condition.except)
  const task = list.find((condition) => condition.kind === 'task')

  return {
    weekdays: skipped(
      ALL_WEEKDAYS,
      list.flatMap((condition) =>
        condition.kind === 'weekdays'
          ? [{ values: condition.weekdays, except: condition.except }]
          : [],
      ),
    ),
    months: skipped(
      ALL_MONTHS,
      list.flatMap((condition) =>
        condition.kind === 'months' ? [{ values: condition.months, except: condition.except }] : [],
      ),
    ),
    period: period?.kind === 'dates' ? { from: period.from, to: period.to } : null,
    task: task?.kind === 'task' ? { seriesId: task.seriesId, except: task.except } : null,
  }
}

/** The conditions a skip set writes: none for what it leaves alone. */
export function skipConditions(set: SkipSet): Condition[] {
  const conditions: Condition[] = []

  if (set.weekdays.length > 0 && set.weekdays.length < ALL_WEEKDAYS.length)
    conditions.push({ kind: 'weekdays', weekdays: set.weekdays, except: true })

  if (set.months.length > 0 && set.months.length < ALL_MONTHS.length)
    conditions.push({ kind: 'months', months: set.months, except: true })

  if (set.period) conditions.push({ kind: 'dates', ...set.period, except: true })

  if (set.task) conditions.push({ kind: 'task', ...set.task })

  return conditions
}

/**
 * How to say which of `all` are left: the ones skipped ("Skips Sat, Sun"), or the ones kept where
 * that is shorter ("Only in Apr, May, Jun").
 */
export function skipPhrasing(all: number, skippedCount: number): 'skips' | 'only' {
  return skippedCount <= all - skippedCount ? 'skips' : 'only'
}

/** The weekdays or months of `all` that `skippedValues` leaves. */
export function keptOf(kind: 'weekdays' | 'months', skippedValues: readonly number[]) {
  return (kind === 'weekdays' ? ALL_WEEKDAYS : ALL_MONTHS).filter(
    (value) => !skippedValues.includes(value),
  )
}
