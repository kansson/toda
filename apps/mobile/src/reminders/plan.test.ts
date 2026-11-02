import { describe, expect, it } from 'vitest'
import { momentOf } from '@/tasks/dates'
import { newTask, type Task } from '@/tasks/model'
import { planReminders } from './plan'

const now = momentOf('2026-11-03', '10:00').getTime()

const task = (clientId: string, fields: Partial<Task> = {}) =>
  newTask(clientId, { listId: 'default', title: clientId, ...fields }, 1)

describe('planReminders', () => {
  it('reminds of timed tasks at their minute, and only from now on', () => {
    const reminders = planReminders(
      [
        task('later', { dueDate: '2026-11-03', dueTime: '14:30' }),
        task('gone', { dueDate: '2026-11-03', dueTime: '08:00' }),
        task('done', { dueDate: '2026-11-03', dueTime: '15:00', completedAt: 1 }),
      ],
      now,
      null,
    )

    expect(reminders).toMatchObject([
      { kind: 'timed', id: 'task:later', at: momentOf('2026-11-03', '14:30') },
    ])
  })

  it('gathers each day’s dated tasks into one morning digest, counting overdue ones', () => {
    const reminders = planReminders(
      [
        task('a', { dueDate: '2026-11-04' }),
        task('b', { dueDate: '2026-11-04' }),
        task('overdue', { dueDate: '2026-11-01' }),
        task('today', { dueDate: '2026-11-03' }),
      ],
      now,
      '09:00',
    )

    // Today's 09:00 has passed; tomorrow's digest holds both and counts the overdue task.
    expect(reminders).toMatchObject([
      {
        kind: 'digest',
        id: 'digest:2026-11-04',
        overdue: 2,
        due: [{ clientId: 'a' }, { clientId: 'b' }],
      },
    ])
  })

  it('schedules today’s digest when its time is still to come', () => {
    expect(planReminders([task('t', { dueDate: '2026-11-03' })], now, '18:00')).toMatchObject([
      { id: 'digest:2026-11-03' },
    ])
  })
})
