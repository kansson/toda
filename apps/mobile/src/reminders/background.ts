import * as Notifications from 'expo-notifications'
import * as TaskManager from 'expo-task-manager'
import { respondToReminder } from './respond'

/** Never renamed: Android keeps the registration under this name. */
const TASK = 'toda-reminder-actions'

/**
 * Reminder buttons work while the app is closed: Android starts the app's JavaScript without a
 * screen and runs this task with the tap. Defined at module scope, before anything renders.
 */
TaskManager.defineTask<Notifications.NotificationTaskPayload>(TASK, async ({ data }) => {
  if ('actionIdentifier' in data) await respondToReminder(data)
})

export function registerReminderTask() {
  return Notifications.registerTaskAsync(TASK)
}
