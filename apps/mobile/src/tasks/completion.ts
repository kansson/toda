import { addDays, type CalendarDate, localDate, localTime, momentOf } from './dates'
import type { Task } from './model'
import { nextOccurrence } from './recurrence'

/** The most days a late repeating task offers as when it was done, today included. */
const DONE_DAY_CHOICES = 7

/**
 * Whether checking a task off asks which day it was done: a repeating task whose date has passed,
 * where that day decides when it comes back and whether it counts as kept.
 */
export function asksDoneDay(task: Task, today: CalendarDate) {
  return (
    task.completedAt === null &&
    task.parentId === null &&
    task.repeat !== null &&
    task.dueDate !== null &&
    task.dueDate < today
  )
}

/**
 * The days a late task can be marked done on, today first and back to its own date, at most a
 * week of them; an earlier day is picked from a calendar.
 */
export function doneDayChoices(task: Task, today: CalendarDate): CalendarDate[] {
  const days: CalendarDate[] = []

  for (let day = today; days.length < DONE_DAY_CHOICES; day = addDays(day, -1)) {
    days.push(day)

    if (task.dueDate === null || day <= task.dueDate) break
  }

  return days
}

/**
 * The moment a task done on `day` is recorded as completed: now for today, and the same time of
 * day on an earlier day, so a task done yesterday sorts as done yesterday.
 */
export function completionMoment(day: CalendarDate, now: number) {
  return day >= localDate(now) ? now : momentOf(day, localTime(now)).getTime()
}

/**
 * When a task checked off at `moment` but completed only `now` was done: on the day it was
 * checked off, at that moment. A widget's check box is taken by the app when it next runs, maybe
 * after midnight, and counting that day would skip an occurrence of a repeat. A moment ahead of
 * the phone's clock counts as now.
 */
export function checkedOff(moment: number, now: number) {
  const at = Math.min(moment, now)

  return { day: localDate(at), at }
}

/** When a repeating task comes back if it was done on `day`; null when it would not. */
export function nextDueIfDone(task: Task, day: CalendarDate) {
  return task.repeat && task.dueDate && task.parentId === null
    ? nextOccurrence(task.repeat, task.dueDate, day, task.occurrence)
    : null
}

export type CompletionPlan = {
  /** Tasks to mark done now: the task and its open subtasks. */
  complete: string[]
  /** The next occurrence of a repeating task, with fresh copies of its subtasks. */
  spawn: Task[]
  /** When the next occurrence is due, for the confirmation. */
  nextDue: CalendarDate | null
}

/**
 * What checking a task off does. Its open subtasks are done with it. A repeating top-level task
 * gets its next occurrence as a new task in the same place, with its subtasks open again, so the
 * one done stays in Completed with the day it was done. That day is today unless the task was
 * done earlier and only checked off now; a repeat counted from completion counts from it.
 */
export function planCompletion(
  task: Task,
  subtasks: readonly Task[],
  now: number,
  newId: () => string,
  doneOn: CalendarDate = localDate(now),
): CompletionPlan {
  const complete = [
    task.clientId,
    ...subtasks.flatMap((subtask) => (subtask.completedAt === null ? [subtask.clientId] : [])),
  ]

  const nextDue = nextDueIfDone(task, doneOn)

  if (!task.repeat || nextDue === null) return { complete, spawn: [], nextDue: null }

  const nextId = newId()

  const next: Task = {
    ...task,
    clientId: nextId,
    dueDate: nextDue,
    // A deadline belongs to one occurrence; repeating tasks carry none.
    deadline: null,
    completedAt: null,
    seriesId: task.seriesId ?? task.clientId,
    occurrence: task.occurrence + 1,
    createdAt: now,
    updatedAt: now,
  }

  const copies = subtasks.map((subtask): Task => ({
    ...subtask,
    clientId: newId(),
    parentId: nextId,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  }))

  return { complete, spawn: [next, ...copies], nextDue }
}

export type ReopenPlan = {
  /** Tasks to mark open again: the task and the subtasks done with it. */
  reopen: string[]
  /** The occurrence completing it made, while still open: it goes again. */
  remove: string[]
}

/**
 * What unchecking a done task does: it opens again with the subtasks that were done at the same
 * moment, and a repeating task takes back the next occurrence completing it created, unless that
 * one has been done since.
 */
export function planReopen(
  task: Task,
  subtasks: readonly Task[],
  all: readonly Task[],
): ReopenPlan {
  const reopen = [
    task.clientId,
    ...subtasks.flatMap((subtask) =>
      subtask.completedAt !== null && subtask.completedAt === task.completedAt
        ? [subtask.clientId]
        : [],
    ),
  ]

  const seriesId = task.seriesId ?? task.clientId

  const next = task.repeat
    ? all.find(
        (other) =>
          other.seriesId === seriesId &&
          other.occurrence === task.occurrence + 1 &&
          other.parentId === null &&
          other.completedAt === null,
      )
    : undefined

  return { reopen, remove: next ? [next.clientId] : [] }
}
