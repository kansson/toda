import { describe, expect, it } from 'vitest'
import {
  keptOf,
  mindableTasks,
  seriesSchedules,
  seriesTitles,
  skipConditions,
  skipPhrasing,
  skipSet,
} from './conditions'
import { newTask, type Task } from './model'
import {
  type Condition,
  defaultRepeat,
  fixedRepeat,
  keeps,
  nextOccurrence,
  type Repeat,
} from './recurrence'

const SATURDAY = 5

const SUNDAY = 6

const task = (clientId: string, fields: Partial<Task> = {}) =>
  newTask(clientId, { listId: 'default', title: clientId, ...fields }, 1)

const withConditions = (repeat: Repeat, conditions: Condition[]): Repeat => ({
  ...repeat,
  conditions,
})

describe('a repeat with conditions', () => {
  it('moves a repeat counted from completion to the next day the conditions keep', () => {
    // Done on Saturday 7 November: tomorrow is a Sunday, so Monday.
    const daily = withConditions(defaultRepeat('day'), [
      { kind: 'weekdays', weekdays: [SUNDAY], except: true },
    ])

    expect(nextOccurrence(daily, '2026-11-07', '2026-11-07', 1)).toBe('2026-11-09')
    expect(nextOccurrence(daily, '2026-11-05', '2026-11-05', 1)).toBe('2026-11-06')
  })

  it('skips a fixed schedule’s dates the conditions leave out, as for a season', () => {
    // Mondays from April to September: the last Monday in September, then the first in April.
    const summer = withConditions(fixedRepeat(defaultRepeat('week'), '2026-09-28'), [
      { kind: 'months', months: [4, 5, 6, 7, 8, 9], except: false },
    ])

    expect(nextOccurrence(summer, '2026-09-28', '2026-09-28', 1)).toBe('2027-04-05')
  })

  it('leaves out a run of days, such as a holiday', () => {
    const daily = withConditions(fixedRepeat(defaultRepeat('day'), '2026-12-19'), [
      { kind: 'dates', from: '2026-12-20', to: '2026-12-27', except: true },
    ])

    expect(nextOccurrence(daily, '2026-12-19', '2026-12-19', 1)).toBe('2026-12-28')
  })

  it('takes every condition together: only Saturdays, except in December', () => {
    const conditions: Condition[] = [
      { kind: 'weekdays', weekdays: [SATURDAY], except: false },
      { kind: 'months', months: [12], except: true },
    ]

    expect(keeps(conditions, '2026-11-28')).toBe(true)
    expect(keeps(conditions, '2026-12-05')).toBe(false)
    expect(keeps(conditions, '2026-11-27')).toBe(false)
  })

  it('lets go of conditions that leave out every date, rather than never coming back', () => {
    const never = withConditions(defaultRepeat('day'), [
      { kind: 'months', months: [2], except: false },
      { kind: 'months', months: [2], except: true },
    ])

    expect(nextOccurrence(never, '2026-11-02', '2026-11-02', 1)).toBe('2026-11-03')
  })

  it('ends when the first date kept is after the repeat’s end', () => {
    const daily = withConditions(
      { ...defaultRepeat('day'), end: { kind: 'on', date: '2026-12-22' } },
      [{ kind: 'dates', from: '2026-12-20', to: '2026-12-27', except: true }],
    )

    expect(nextOccurrence(daily, '2026-12-19', '2026-12-19', 1)).toBeNull()
  })
})

describe('a repeat that minds another task', () => {
  // Gym every other day from Monday 2 November: the 2nd, 4th, 6th…
  const gym = task('gym', {
    dueDate: '2026-11-04',
    seriesId: 'gym-1',
    occurrence: 2,
    repeat: fixedRepeat(defaultRepeat('day', 2), '2026-11-02'),
  })

  const doneGym = task('gym-1', { dueDate: '2026-11-02', completedAt: 1, repeat: gym.repeat })

  const run = (except: boolean) =>
    withConditions(fixedRepeat(defaultRepeat('day'), '2026-11-03'), [
      { kind: 'task', seriesId: 'gym-1', except },
    ])

  const schedules = seriesSchedules([doneGym, gym])

  it('takes turns with it: every day it is not due', () => {
    expect(nextOccurrence(run(true), '2026-11-03', '2026-11-03', 1, schedules)).toBe('2026-11-05')
    expect(nextOccurrence(run(true), '2026-11-05', '2026-11-05', 1, schedules)).toBe('2026-11-07')
  })

  it('follows it: only the days it is due', () => {
    expect(nextOccurrence(run(false), '2026-11-04', '2026-11-04', 1, schedules)).toBe('2026-11-06')
  })

  it('counts its done occurrences and its coming dates as due', () => {
    expect(schedules('gym-1', '2026-11-02')).toBe(true)
    expect(schedules('gym-1', '2026-11-03')).toBe(false)
    expect(schedules('gym-1', '2026-11-10')).toBe(true)
    expect(schedules('gym-1', '2026-11-01')).toBe(false)
  })

  it('leaves out a task that is gone, or itself', () => {
    expect(schedules('gone', '2026-11-04')).toBeNull()
    expect(seriesSchedules([doneGym, gym], 'gym-1')('gym-1', '2026-11-04')).toBeNull()
    expect(nextOccurrence(run(true), '2026-11-03', '2026-11-03', 1, () => null)).toBe('2026-11-04')
  })

  it('leaves the condition out where no schedules are given', () => {
    expect(nextOccurrence(run(true), '2026-11-03', '2026-11-03', 1)).toBe('2026-11-04')
  })
})

describe('the tasks a condition can mind', () => {
  const tasks = [
    task('bins-1', { title: 'Bins', dueDate: '2026-11-02', completedAt: 1 }),
    task('bins-2', {
      title: 'Bins, renamed',
      dueDate: '2026-11-09',
      seriesId: 'bins-1',
      occurrence: 2,
    }),
    task('gym', { title: 'Gym', dueDate: '2026-11-04' }),
    task('someday', { title: 'Someday' }),
    task('stretch', { title: 'Stretch', dueDate: '2026-11-04', parentId: 'gym' }),
    task('run', { title: 'Run', dueDate: '2026-11-03' }),
  ]

  it('are the open dated tasks, once a series, by title, but for the one asking', () => {
    expect(mindableTasks(tasks, 'run').map((other) => [other.seriesId, other.task.title])).toEqual([
      ['bins-1', 'Bins, renamed'],
      ['gym', 'Gym'],
    ])
  })

  it('go by the title of their latest occurrence', () => {
    expect(seriesTitles(tasks).get('bins-1')).toBe('Bins, renamed')
    expect(seriesTitles(tasks).has('stretch')).toBe(false)
  })
})

describe('a repeat’s conditions as the sheet sets them', () => {
  it('reads "only" conditions as the days they skip', () => {
    expect(
      skipSet([
        { kind: 'weekdays', weekdays: [0, 1, 2, 3, 4], except: false },
        { kind: 'months', months: [12], except: true },
        { kind: 'dates', from: '2026-12-20', to: '2026-12-27', except: true },
        { kind: 'task', seriesId: 'gym', except: true },
      ]),
    ).toEqual({
      weekdays: [5, 6],
      months: [12],
      period: { from: '2026-12-20', to: '2026-12-27' },
      task: { seriesId: 'gym', except: true },
    })
  })

  it('writes back only what it sets, so a sheet left alone adds nothing', () => {
    const set = skipSet(undefined)

    expect(skipConditions(set)).toEqual([])
    expect(skipConditions({ ...set, weekdays: [6] })).toEqual([
      { kind: 'weekdays', weekdays: [6], except: true },
    ])
  })

  it('says the shorter of what it skips and what it keeps', () => {
    expect(skipPhrasing(7, 2)).toBe('skips')
    expect(skipPhrasing(12, 6)).toBe('skips')
    expect(skipPhrasing(12, 7)).toBe('only')
    expect(keptOf('months', [1, 2, 3, 10, 11, 12])).toEqual([4, 5, 6, 7, 8, 9])
  })
})
