import { t, plural } from '@lingui/core/macro'
import * as Notifications from 'expo-notifications'
import { getPreferences } from '@/settings/preferences'
import { addDays, type CalendarDate, localDate, momentOf } from '@/tasks/dates'
import type { Task } from '@/tasks/model'
import { formatDate } from '@/ui/format'
import { planReminders, type Reminder } from './plan'

/** Never renamed once shipped: Android keeps each channel's settings by its id. */
export const channels = { timed: 'timed', digest: 'digest' } as const

export const CATEGORY = 'task'

export const actions = { complete: 'complete', tomorrow: 'tomorrow' } as const

/** What a reminder carries to act on when tapped. */
export type ReminderData = { taskIds: string[]; listId: string | null }

/** Channels and the reminder buttons, in the phone's language; safe to run on every start. */
export async function setUpReminders() {
  await Notifications.setNotificationChannelAsync(channels.timed, {
    name: t({ message: 'Tasks at a time', comment: 'Notification channel for tasks with a time' }),
    description: t({
      message: 'At the time a task is set for',
      comment: 'Notification channel description: tasks with a time',
    }),
    importance: Notifications.AndroidImportance.HIGH,
  })

  await Notifications.setNotificationChannelAsync(channels.digest, {
    name: t({ message: 'Today’s tasks', comment: 'Notification channel for the morning digest' }),
    description: t({
      message: 'Each morning, the day’s tasks without a time and those overdue',
      comment: 'Notification channel description: the morning digest',
    }),
    importance: Notifications.AndroidImportance.DEFAULT,
  })

  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    {
      identifier: actions.complete,
      buttonTitle: t({ message: 'Mark done', comment: 'Notification button completing the task' }),
      options: { opensAppToForeground: false },
    },
    {
      identifier: actions.tomorrow,
      buttonTitle: t({
        message: 'Tomorrow',
        comment: 'Notification button moving the task to tomorrow',
      }),
      options: { opensAppToForeground: false },
    },
  ])
}

function untitled(task: Task) {
  return (
    task.title.trim() || t({ message: '(No title)', comment: 'Shown for a task without a title' })
  )
}

function dayName(date: CalendarDate, today: CalendarDate) {
  if (date === today)
    return t({ message: 'Today', comment: 'Morning digest title: the day it is for' })

  if (date === addDays(today, 1))
    return t({ message: 'Tomorrow', comment: 'Morning digest title: the day it is for' })

  return formatDate(momentOf(date), { weekday: 'long' })
}

function content(
  reminder: Reminder,
  listTitles: ReadonlyMap<string, string>,
): Notifications.NotificationContentInput {
  if (reminder.kind === 'timed') {
    const data: ReminderData = { taskIds: [reminder.task.clientId], listId: reminder.task.listId }

    return {
      title: untitled(reminder.task),
      body:
        reminder.task.notes.trim() ||
        (reminder.task.listId === null ? '' : listTitles.get(reminder.task.listId)) ||
        '',
      data,
      categoryIdentifier: CATEGORY,
    }
  }

  const count = reminder.due.length

  const overdue = plural(reminder.overdue, {
    one: '# overdue',
    other: '# overdue',
  })

  const title =
    count === 1
      ? untitled(reminder.due[0]!)
      : count > 1
        ? plural(count, { one: '# task', other: '# tasks' })
        : overdue

  const day = dayName(reminder.date, localDate(reminder.at))
  const titles = reminder.due.map(untitled).join(', ')

  const body =
    count === 0
      ? day
      : reminder.overdue > 0
        ? `${day} · ${titles} · ${overdue}`
        : `${day} · ${titles}`

  const data: ReminderData = { taskIds: reminder.due.map((task) => task.clientId), listId: null }

  const digest: Notifications.NotificationContentInput = { title, body, data }

  // Only a single task can be done or moved from its digest.
  if (count === 1) digest.categoryIdentifier = CATEGORY

  return digest
}

let scheduling: Promise<void> = Promise.resolve()

/**
 * Schedules every reminder again from the tasks as they are: called after any change, so one
 * never outlives its task. Runs one at a time; the last call wins.
 */
export function scheduleReminders(tasks: readonly Task[], listTitles: ReadonlyMap<string, string>) {
  scheduling = scheduling
    .catch(() => undefined)
    .then(async () => {
      const permission = await Notifications.getPermissionsAsync()

      if (!permission.granted) return

      const reminders = planReminders(tasks, Date.now(), getPreferences().digestTime)

      await Notifications.cancelAllScheduledNotificationsAsync()

      for (const reminder of reminders) {
        await Notifications.scheduleNotificationAsync({
          identifier: reminder.id,
          content: content(reminder, listTitles),
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminder.at,
            channelId: reminder.kind === 'timed' ? channels.timed : channels.digest,
          },
        })
      }
    })

  return scheduling
}
