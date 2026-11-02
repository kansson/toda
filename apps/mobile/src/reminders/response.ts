import type { NotificationResponse } from 'expo-notifications'
import { z } from 'zod'

const dataSchema = z.object({ taskIds: z.array(z.string()) })

const responseSchema = z.object({
  actionIdentifier: z.string(),
  notification: z.object({
    date: z.number(),
    request: z.object({
      identifier: z.string(),
      content: z.object({
        data: z.unknown().optional(),
        dataString: z.string().optional(),
      }),
    }),
  }),
})

export type ReminderTap = { key: string; identifier: string; action: string; taskId: string }

function json(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * What a reminder tap asks for, or null. The app's listener gets the reminder's data as an object;
 * the background task, which Android runs from a serialised copy, gets it as JSON in `dataString`.
 */
export function reminderTap(response: NotificationResponse): ReminderTap | null {
  const parsed = responseSchema.safeParse(response)

  if (!parsed.success) return null
  const { actionIdentifier, notification } = parsed.data
  const { content, identifier } = notification.request

  // Either may be there; the listener can also get an empty `data` beside `dataString`.
  const data = [content.data, content.dataString ? json(content.dataString) : null]
    .map((candidate) => dataSchema.safeParse(candidate))
    .find((result) => result.success)

  const taskId = data?.data?.taskIds[0]

  if (!taskId) return null

  return {
    key: `${identifier}:${notification.date}:${actionIdentifier}`,
    identifier,
    action: actionIdentifier,
    taskId,
  }
}
