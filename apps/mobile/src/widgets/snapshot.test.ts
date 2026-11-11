import { describe, expect, it } from 'vitest'
import { everyCadence } from '../tasks/cadence'
import { momentOf } from '../tasks/dates'
import { newTask, type Task } from '../tasks/model'
import { defaultRepeat } from '../tasks/recurrence'
import { sortedTasks, viewTasks } from './snapshot'

const today = '2026-11-03'

const now = momentOf(today, '12:00').getTime()

const task = (clientId: string, fields: Partial<Task> = {}) =>
  newTask(clientId, { listId: 'default', title: clientId, ...fields }, 1)

const ids = (tasks: Task[]) => tasks.map((shown) => shown.clientId)

describe('a widget’s tasks', () => {
  const tasks = [
    task('b', { position: 1, dueDate: '2026-11-05' }),
    task('a', { position: 2, dueDate: '2026-11-04' }),
    task('c', { position: 3 }),
    task('c1', { parentId: 'c', position: 1 }),
    task('done', { position: 0, completedAt: 5 }),
    task('other', { listId: 'work', position: 0 }),
  ]

  it('shows a list’s open tasks in the sort given, each over its subtasks, as its page does', () => {
    const list = { kind: 'list', listId: 'default' } as const

    expect(ids(viewTasks(tasks, list, 'manual', today, now))).toEqual(['b', 'a', 'c', 'c1'])
    expect(ids(viewTasks(tasks, list, 'date', today, now))).toEqual(['a', 'b', 'c', 'c1'])
    expect(ids(viewTasks(tasks, list, 'title', today, now))).toEqual(['a', 'b', 'c', 'c1'])
  })

  it('shows Today’s tasks with their open subtasks, but none done or resting', () => {
    const chore = task('chore', { dueDate: today, repeat: defaultRepeat('week') })

    const due = [
      chore,
      task('open', { parentId: 'chore' }),
      task('done', { parentId: 'chore', completedAt: 5 }),
      task('resting', { parentId: 'chore', cadence: everyCadence(chore, 2, 1) }),
    ]

    expect(ids(viewTasks(due, { kind: 'today' }, 'manual', today, now))).toEqual(['chore', 'open'])
  })

  it('sorts Today within its sections, overdue first, unless it is My order', () => {
    const due = [
      task('late', { dueDate: '2026-11-01', title: 'z' }),
      task('now2', { dueDate: today, dueTime: '09:00', title: 'b' }),
      task('now1', { dueDate: today, dueTime: '10:00', title: 'a' }),
    ]

    expect(ids(viewTasks(due, { kind: 'today' }, 'manual', today, now))).toEqual([
      'late',
      'now2',
      'now1',
    ])
    expect(ids(viewTasks(due, { kind: 'today' }, 'title', today, now))).toEqual([
      'late',
      'now1',
      'now2',
    ])
  })

  it('keeps each task once, the default sort’s first, with every sort’s order by id', () => {
    const sorted = sortedTasks(
      (sort) =>
        sort === 'manual'
          ? [task('a'), task('b'), task('c')]
          : sort === 'date'
            ? [task('c'), task('d'), task('a')]
            : [],
      'manual',
      2,
    )

    expect(ids(sorted.tasks)).toEqual(['a', 'b', 'c', 'd'])
    expect(sorted.orders).toEqual({
      manual: ['a', 'b'],
      date: ['c', 'd'],
      deadline: [],
      starred: [],
      title: [],
    })
  })
})
