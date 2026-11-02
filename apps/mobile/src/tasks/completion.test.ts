import { describe, expect, it } from 'vitest'
import { planCompletion, planReopen } from './completion'
import { momentOf } from './dates'
import { newTask, type Task } from './model'
import { defaultRepeat } from './recurrence'

const now = momentOf('2026-11-03', '10:00').getTime()

let ids = 0

const nextId = () => `new-${(ids += 1)}`

const task = (clientId: string, fields: Partial<Task> = {}) =>
  newTask(clientId, { listId: 'default', title: clientId, ...fields }, 1)

describe('completing a task', () => {
  it('completes its open subtasks with it', () => {
    const subtasks = [task('s1', { parentId: 'p' }), task('s2', { parentId: 'p', completedAt: 5 })]

    expect(planCompletion(task('p'), subtasks, now, nextId)).toEqual({
      complete: ['p', 's1'],
      spawn: [],
      nextDue: null,
    })
  })

  it('creates the next occurrence of a repeating task, with its subtasks open again', () => {
    ids = 0

    const chore = task('p', {
      dueDate: '2026-11-02',
      repeat: defaultRepeat('day', 3),
      deadline: '2026-11-02',
    })

    const plan = planCompletion(chore, [task('s', { parentId: 'p', completedAt: 2 })], now, nextId)

    expect(plan.nextDue).toBe('2026-11-06')
    expect(plan.spawn).toMatchObject([
      { clientId: 'new-1', dueDate: '2026-11-06', seriesId: 'p', occurrence: 2, deadline: null },
      { clientId: 'new-2', parentId: 'new-1', completedAt: null },
    ])
  })

  it('creates nothing once the series has ended', () => {
    const last = task('p', {
      dueDate: '2026-11-02',
      occurrence: 2,
      repeat: { ...defaultRepeat('day'), end: { kind: 'after', count: 2 } },
    })

    expect(planCompletion(last, [], now, nextId).spawn).toEqual([])
  })
})

describe('reopening a task', () => {
  it('takes back the open occurrence completing it made', () => {
    const done = task('p', { dueDate: '2026-11-02', repeat: defaultRepeat('day'), completedAt: 9 })
    const next = task('n', { seriesId: 'p', occurrence: 2, repeat: defaultRepeat('day') })
    const subtask = task('s', { parentId: 'p', completedAt: 9 })

    expect(planReopen(done, [subtask], [done, next, subtask])).toEqual({
      reopen: ['p', 's'],
      remove: ['n'],
    })
  })

  it('keeps an occurrence done since', () => {
    const done = task('p', { dueDate: '2026-11-02', repeat: defaultRepeat('day'), completedAt: 9 })
    const doneToo = task('n', { seriesId: 'p', occurrence: 2, completedAt: 20 })

    expect(planReopen(done, [], [done, doneToo]).remove).toEqual([])
  })
})
