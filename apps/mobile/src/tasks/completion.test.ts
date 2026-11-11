import { describe, expect, it } from 'vitest'
import {
  asksDoneDay,
  asksDoneDayAfter,
  checkedOff,
  completionMoment,
  doneDayChoices,
  nextDueIfDone,
  planCompletion,
  planReopen,
} from './completion'
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

describe('a late repeating task done on an earlier day', () => {
  const daily = task('p', { dueDate: '2026-11-02', repeat: defaultRepeat('day') })

  it('comes back today when it was done on its own day, yesterday', () => {
    // Checked off on Tuesday, done on Monday: Tuesday's comes, rather than Wednesday's.
    expect(planCompletion(daily, [], now, nextId).nextDue).toBe('2026-11-04')
    expect(planCompletion(daily, [], now, nextId, '2026-11-02').nextDue).toBe('2026-11-03')
  })

  it('keeps today on a fixed schedule when it was done on its day', () => {
    const fixed = task('p', {
      dueDate: '2026-11-02',
      repeat: { ...defaultRepeat('day'), anchor: 'due' },
    })

    expect(nextDueIfDone(fixed, '2026-11-03')).toBe('2026-11-04')
    expect(nextDueIfDone(fixed, '2026-11-02')).toBe('2026-11-03')
  })

  it('is asked about only while late, repeating and top-level', () => {
    expect(asksDoneDay(daily, '2026-11-03')).toBe(true)
    expect(asksDoneDay(daily, '2026-11-02')).toBe(false)
    expect(asksDoneDay({ ...daily, repeat: null }, '2026-11-03')).toBe(false)
    expect(asksDoneDay({ ...daily, parentId: 'q' }, '2026-11-03')).toBe(false)
    expect(asksDoneDay({ ...daily, completedAt: 1 }, '2026-11-03')).toBe(false)
  })

  it('tells the widgets the day after which it asks', () => {
    expect(asksDoneDayAfter(daily)).toBe(daily.dueDate)
    expect(asksDoneDayAfter({ ...daily, repeat: null })).toBeNull()
    expect(asksDoneDayAfter({ ...daily, parentId: 'q' })).toBeNull()
    expect(asksDoneDayAfter({ ...daily, dueDate: null })).toBeNull()
  })

  it('offers today back to its own date, a week at most', () => {
    expect(doneDayChoices(daily, '2026-11-04')).toEqual(['2026-11-04', '2026-11-03', '2026-11-02'])
    expect(doneDayChoices({ ...daily, dueDate: '2026-10-01' }, '2026-11-04')).toHaveLength(7)
  })

  it('is recorded at the same time of day on the day it was done', () => {
    expect(completionMoment('2026-11-03', now)).toBe(now)
    expect(completionMoment('2026-11-02', now)).toBe(momentOf('2026-11-02', '10:00').getTime())
  })
})

describe('a task checked off in a widget and completed later', () => {
  const evening = momentOf('2026-11-08', '22:30').getTime()
  const afterMidnight = momentOf('2026-11-09', '00:24').getTime()

  it('counts the day and moment it was checked off, not when the app took it', () => {
    expect(checkedOff(evening, afterMidnight)).toEqual({ day: '2026-11-08', at: evening })
  })

  it('comes back the next day, not the day after', () => {
    const daily = task('p', { dueDate: '2026-11-08', repeat: defaultRepeat('day') })

    const fixed = task('f', {
      dueDate: '2026-11-08',
      repeat: { ...defaultRepeat('day'), anchor: 'due' },
    })

    const { day } = checkedOff(evening, afterMidnight)

    expect(nextDueIfDone(daily, day)).toBe('2026-11-09')
    expect(nextDueIfDone(fixed, day)).toBe('2026-11-09')
  })

  it('counts a moment ahead of the clock as now', () => {
    expect(checkedOff(afterMidnight, evening)).toEqual({ day: '2026-11-08', at: evening })
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

  it('opens a subtask’s done task again with it, leaving its other subtasks done', () => {
    const done = task('p', { dueDate: '2026-11-02', repeat: defaultRepeat('day'), completedAt: 9 })
    const subtask = task('s', { parentId: 'p', completedAt: 9 })
    const other = task('o', { parentId: 'p', completedAt: 9 })
    const next = task('n', { seriesId: 'p', occurrence: 2 })

    expect(planReopen(subtask, [], [done, subtask, other, next])).toEqual({
      reopen: ['s', 'p'],
      remove: ['n'],
    })
  })

  it('opens a subtask alone under an open task', () => {
    const open = task('p')
    const subtask = task('s', { parentId: 'p', completedAt: 9 })

    expect(planReopen(subtask, [], [open, subtask])).toEqual({ reopen: ['s'], remove: [] })
  })

  it('keeps an occurrence done since', () => {
    const done = task('p', { dueDate: '2026-11-02', repeat: defaultRepeat('day'), completedAt: 9 })
    const doneToo = task('n', { seriesId: 'p', occurrence: 2, completedAt: 20 })

    expect(planReopen(done, [], [done, doneToo]).remove).toEqual([])
  })
})
