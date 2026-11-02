import * as Notifications from 'expo-notifications'
import { createActions } from '@/data/actions'
import { openDb } from '@/data/shared-db'
import { addDays, localDate } from '@/tasks/dates'
import { actions } from './notifications'
import { reminderTap } from './response'

/** Responses already acted on: the task path and the app's listener may both hear one tap. */
const handled = new Set<string>()

/**
 * A tap on a reminder's Done or Tomorrow, from the app or from a background task while it is
 * closed: the change goes into the outbox like any other and reaches the server once the app is
 * signed in and online. Returns whether it acted.
 */
export async function respondToReminder(response: Notifications.NotificationResponse) {
  const tap = reminderTap(response)

  if (!tap || handled.has(tap.key)) return false

  if (tap.action !== actions.complete && tap.action !== actions.tomorrow) return false
  handled.add(tap.key)

  const db = await openDb()

  // Started by a tap while the app was closed, the data may still be loading from the phone.
  await db.tasks.preload()
  const writes = createActions(db, () => undefined)

  if (tap.action === actions.complete) writes.complete(tap.taskId)
  else writes.updateTask(tap.taskId, { dueDate: addDays(localDate(), 1) })

  await Notifications.dismissNotificationAsync(tap.identifier)

  return true
}
