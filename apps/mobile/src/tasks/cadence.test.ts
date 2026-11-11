import { describe, expect, it } from 'vitest'
import {
  type Cadence,
  carriedCadence,
  comesRound,
  everyCadence,
  landsOn,
  nextRound,
  rests,
  scheduleCadence,
} from './cadence'
import { planCompletion } from './completion'
import { momentOf } from './dates'
import { newTask, type Task } from './model'
import { defaultRepeat, fixedRepeat } from './recurrence'

const task = (clientId: string, fields: Partial<Task> = {}) =>
  newTask(clientId, { listId: 'default', title: clientId, ...fields }, 1)

/** Cleaning, every Saturday: 7 and 28 November, 5 and 26 December, 2 January. */
const cleaning = (dueDate: string, occurrence = 1) =>
  task('clean', {
    dueDate,
    occurrence,
    repeat: fixedRepeat(defaultRepeat('week'), '2026-11-07'),
  })

const sub = (cadence: Cadence | null, fields: Partial<Task> = {}) =>
  task('sub', { parentId: 'clean', cadence, ...fields })

describe('a subtask every few times', () => {
  it('comes round every third time from the time it was set', () => {
    const cadence = everyCadence(cleaning('2026-11-07', 4), 3)

    const shown = [4, 5, 6, 7, 8, 9, 10].map((occurrence) =>
      comesRound(sub(cadence), cleaning('2026-11-07', occurrence)),
    )

    expect(shown).toEqual([true, false, false, true, false, false, true])
  })

  it('starts a number of times later when asked', () => {
    const cadence = everyCadence(cleaning('2026-11-07', 1), 3, 1)

    expect(comesRound(sub(cadence), cleaning('2026-11-07', 1))).toBe(false)
    expect(comesRound(sub(cadence), cleaning('2026-11-14', 2))).toBe(true)
    expect(nextRound(sub(cadence), cleaning('2026-11-07', 1))).toEqual({
      date: '2026-11-14',
      after: 1,
    })
  })

  it('says nothing under a task that does not repeat', () => {
    const plain = task('clean', { dueDate: '2026-11-07' })

    expect(comesRound(sub(everyCadence(plain, 3, 1)), plain)).toBe(true)
  })
})

describe('a subtask on a schedule of its own', () => {
  // Meant for Tuesday 1 December: Saturday 28 November is 3 days early, 5 December 4 days late.
  const monthly = (lean: 'closest' | 'before' | 'after', leeway = 0) =>
    scheduleCadence('month', 1, '2026-12-01', lean, leeway)

  it('lands on the closest of the task’s dates around its own', () => {
    expect(landsOn(monthly('closest'), '2026-11-28', '2026-12-05')).toBe(true)
    expect(landsOn(monthly('closest'), '2026-11-21', '2026-11-28')).toBe(false)
  })

  it('lands before its date, never after, unless a later date is near enough', () => {
    expect(landsOn(monthly('before'), '2026-11-28', '2026-12-05')).toBe(true)

    // Meant for Friday 1 January: Saturday 26 December is 6 days early, 2 January 1 day late.
    const newYear = { ...monthly('before'), next: '2027-01-01' }

    expect(landsOn(newYear, '2026-12-26', '2027-01-02')).toBe(true)
    expect(landsOn({ ...newYear, leeway: 1 }, '2026-12-26', '2027-01-02')).toBe(false)
  })

  it('lands after its date, never before, unless an earlier date is near enough', () => {
    expect(landsOn(monthly('after'), '2026-11-28', '2026-12-05')).toBe(false)
    expect(landsOn(monthly('after'), '2026-12-05', '2026-12-12')).toBe(true)
    expect(landsOn(monthly('after', 2), '2026-11-28', '2026-12-05')).toBe(false)
    expect(landsOn(monthly('after', 3), '2026-11-28', '2026-12-05')).toBe(true)
  })

  it('lands on a date past its own, and on the task’s last date', () => {
    expect(landsOn(monthly('after'), '2026-12-12', '2026-12-19')).toBe(true)
    expect(landsOn(monthly('after'), '2026-11-07', null)).toBe(true)
  })

  it('says which of the task’s dates it comes with next', () => {
    const subtask = sub(monthly('closest'))

    expect(rests(subtask, cleaning('2026-11-07'))).toBe(true)
    expect(nextRound(subtask, cleaning('2026-11-07'))).toEqual({ date: '2026-11-28', after: 3 })
  })

  it('moves on to its next date once it came round, and stays put while it rests', () => {
    const subtask = sub(monthly('closest'))

    expect(carriedCadence(subtask, cleaning('2026-11-28'))).toMatchObject({ next: '2027-01-01' })
    expect(carriedCadence(subtask, cleaning('2026-11-21'))).toMatchObject({ next: '2026-12-01' })
  })

  it('keeps to the end of the month it started on', () => {
    const endOfMonth = sub(scheduleCadence('month', 1, '2027-01-31'))
    const february = carriedCadence(endOfMonth, cleaning('2027-01-30'))

    expect(february).toMatchObject({ next: '2027-02-28' })
    expect(carriedCadence(sub(february), cleaning('2027-02-27'))).toMatchObject({
      next: '2027-03-31',
    })
  })

  it('skips its dates that passed while the task was late', () => {
    const weekly = sub(scheduleCadence('week', 1, '2026-11-02'))

    expect(carriedCadence(weekly, cleaning('2026-11-21'))).toMatchObject({ next: '2026-11-23' })
  })
})

describe('completing a task with resting subtasks', () => {
  const now = momentOf('2026-11-07', '10:00').getTime()
  let ids = 0
  const newId = () => `new-${(ids += 1)}`

  it('leaves a resting subtask open and carries every subtask into the next time', () => {
    ids = 0
    const filter = sub(scheduleCadence('month', 1, '2026-12-01'), { clientId: 'filter' })
    const floor = sub(null, { clientId: 'floor' })
    const plan = planCompletion(cleaning('2026-11-07'), [filter, floor], now, newId)

    expect(plan.complete).toEqual(['clean', 'floor'])
    expect(plan.spawn).toMatchObject([
      { clientId: 'new-1', dueDate: '2026-11-14' },
      { clientId: 'new-2', parentId: 'new-1', cadence: { next: '2026-12-01' } },
      { clientId: 'new-3', parentId: 'new-1', cadence: null },
    ])
  })

  it('completes a subtask whose turn it is and moves its date on', () => {
    ids = 0
    const filter = sub(scheduleCadence('month', 1, '2026-12-01'), { clientId: 'filter' })
    const plan = planCompletion(cleaning('2026-11-28', 4), [filter], now, newId)

    expect(plan.complete).toEqual(['clean', 'filter'])
    expect(plan.spawn[1]).toMatchObject({ cadence: { next: '2027-01-01' } })
  })
})
