import { addDays, type CalendarDate, localDate, momentOf } from '@/tasks/dates'
import type { Task } from '@/tasks/model'

export type Reminder =
  | { kind: 'timed'; id: string; at: Date; task: Task }
  /** One notification a morning for the day's tasks without a time, and those overdue. */
  | { kind: 'digest'; id: string; at: Date; date: CalendarDate; due: Task[]; overdue: number }

/** Android keeps up to 500 alarms an app; a fortnight of reminders stays well below. */
const MAX_REMINDERS = 120

const DIGEST_DAYS = 14

/**
 * The reminders to schedule from now on: each open task with a time at that minute, and on each
 * coming day with tasks that have only a date, one digest at the chosen time, counting the tasks
 * still overdue then. Completing or changing a task schedules everything again, so a reminder
 * never outlives its task.
 */
export function planReminders(
  tasks: readonly Task[],
  now: number,
  digestTime: string | null,
): Reminder[] {
  const open = tasks.filter((task) => task.completedAt === null && task.dueDate !== null)
  const reminders: Reminder[] = []

  for (const task of open) {
    if (task.dueTime === null) continue
    const at = momentOf(task.dueDate!, task.dueTime)

    if (at.getTime() > now) reminders.push({ kind: 'timed', id: `task:${task.clientId}`, at, task })
  }

  if (digestTime !== null) {
    const today = localDate(now)

    for (let offset = 0; offset < DIGEST_DAYS; offset += 1) {
      const date = addDays(today, offset)
      const at = momentOf(date, digestTime)

      if (at.getTime() <= now) continue
      const due = open.filter((task) => task.dueDate === date && task.dueTime === null)
      const overdue = open.filter((task) => task.dueDate! < date && task.parentId === null).length

      if (
        due.length > 0 ||
        (offset === 0 && overdue > 0) ||
        (offset === 1 && overdue > 0 && at.getTime() - now < 864e5)
      )
        reminders.push({ kind: 'digest', id: `digest:${date}`, at, date, due, overdue })
    }
  }

  return reminders
    .slice()
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_REMINDERS)
}
