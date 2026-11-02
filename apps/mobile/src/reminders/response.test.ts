import type { NotificationResponse } from 'expo-notifications'
import { describe, expect, it } from 'vitest'
import { reminderTap } from './response'

/** A response as JSON, the way the native side hands it over; the parser checks every field. */
const response = (json: string): NotificationResponse => JSON.parse(json)

// As the background task received it on the emulator.
const fromTask = response(
  '{"notification":{"request":{"trigger":{"channelId":"timed","type":"date"},"content":{"dataString":"{\\"listId\\":\\"default\\",\\"taskIds\\":[\\"t1\\"]}","categoryIdentifier":"task","title":"Recycling","badge":null},"identifier":"task:t1"},"date":1793558014377},"actionIdentifier":"complete"}',
)

describe('reminderTap', () => {
  it('reads the task from the background task’s serialised copy', () => {
    expect(reminderTap(fromTask)).toEqual({
      key: 'task:t1:1793558014377:complete',
      identifier: 'task:t1',
      action: 'complete',
      taskId: 't1',
    })
  })

  it('reads the task from the listener’s object', () => {
    const fromListener = response(
      JSON.stringify({
        actionIdentifier: 'tomorrow',
        notification: {
          date: 5,
          request: { identifier: 'task:t2', content: { data: { taskIds: ['t2'], listId: null } } },
        },
      }),
    )

    expect(reminderTap(fromListener)?.taskId).toBe('t2')
  })

  it('falls back to the JSON when `data` is there but empty', () => {
    const both = response(JSON.stringify(fromTask).replace('"content":{', '"content":{"data":{},'))

    expect(reminderTap(both)?.taskId).toBe('t1')
  })

  it('ignores anything else', () => {
    expect(reminderTap(response('{}'))).toBeNull()
  })
})
