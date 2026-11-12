import type { CalendarDate } from './dates'
import type { Task } from './model'
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
