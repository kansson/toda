import { type CalendarDate, localDate } from './dates'
import type { Task } from './model'
import { nextOccurrence } from './recurrence'

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
 * one done stays in Completed with the day it was done.
 */
export function planCompletion(
  task: Task,
  subtasks: readonly Task[],
  now: number,
  newId: () => string,
): CompletionPlan {
  const complete = [
    task.clientId,
    ...subtasks.flatMap((subtask) => (subtask.completedAt === null ? [subtask.clientId] : [])),
  ]

  const nextDue =
    task.repeat && task.dueDate && task.parentId === null
      ? nextOccurrence(task.repeat, task.dueDate, localDate(now), task.occurrence)
      : null

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
