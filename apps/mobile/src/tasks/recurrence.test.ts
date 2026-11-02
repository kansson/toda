import { describe, expect, it } from 'vitest'
import {
  defaultRepeat,
  fixedRepeat,
  intervalRepeat,
  nextOccurrence,
  nthWeekday,
  type Repeat,
  snap,
  step,
} from './recurrence'

const every = (unit: Repeat['unit'], interval: number, rest: Partial<Repeat> = {}): Repeat => ({
  unit,
  interval,
  weekdays: [],
  monthly: null,
  anchor: 'completion',
  end: { kind: 'never' },
  ...rest,
})

describe('a repeat counted from completion', () => {
  it('resets the interval when a three-day chore is done a day late', () => {
    // Due Monday, done Tuesday: next on Friday, three days after it was done, not Thursday.
    expect(nextOccurrence(every('day', 3), '2026-11-02', '2026-11-03', 1)).toBe('2026-11-06')
  })

  it('counts from the day it was done when done early too', () => {
    expect(nextOccurrence(every('day', 3), '2026-11-05', '2026-11-03', 1)).toBe('2026-11-06')
  })

  it('counts weeks, months and years from completion', () => {
    expect(nextOccurrence(every('week', 2), '2026-11-02', '2026-11-04', 1)).toBe('2026-11-18')
    expect(nextOccurrence(every('month', 1), '2026-01-31', '2026-02-03', 1)).toBe('2026-03-03')
    expect(nextOccurrence(every('year', 1), '2026-03-01', '2026-03-10', 1)).toBe('2027-03-10')
  })

  it('takes the next chosen weekday after the day it was done', () => {
    const mondaysAndThursdays = every('week', 1, { weekdays: [0, 3] })

    // Due Monday the 2nd, done Wednesday the 4th: Thursday the 5th.
    expect(nextOccurrence(mondaysAndThursdays, '2026-11-02', '2026-11-04', 1)).toBe('2026-11-05')
    // Done Friday the 6th: Monday the 9th.
    expect(nextOccurrence(mondaysAndThursdays, '2026-11-02', '2026-11-06', 1)).toBe('2026-11-09')
  })
})

describe('a repeat on a fixed schedule', () => {
  const fixed = (repeat: Repeat): Repeat => ({ ...repeat, anchor: 'due' })

  it('keeps the schedule when done late, as Google Tasks does', () => {
    // Due Monday, done Tuesday: still Thursday.
    expect(nextOccurrence(fixed(every('day', 3)), '2026-11-02', '2026-11-03', 1)).toBe('2026-11-05')
  })

  it('skips the occurrences missed before it was done, leaving one open', () => {
    expect(nextOccurrence(fixed(every('day', 1)), '2026-11-02', '2026-11-06', 1)).toBe('2026-11-07')
  })

  it('keeps the schedule when done early', () => {
    expect(nextOccurrence(fixed(every('week', 1)), '2026-11-09', '2026-11-03', 1)).toBe(
      '2026-11-16',
    )
  })

  it('falls on the last day of shorter months without drifting', () => {
    const monthly = fixed(every('month', 1, { monthly: { kind: 'day', day: 31 } }))

    expect(nextOccurrence(monthly, '2026-01-31', '2026-01-31', 1)).toBe('2026-02-28')
    expect(nextOccurrence(monthly, '2026-02-28', '2026-02-28', 2)).toBe('2026-03-31')
  })

  it('falls on the nth or last weekday of the month', () => {
    const secondTuesday = fixed(
      every('month', 1, { monthly: { kind: 'weekday', week: 2, weekday: 1 } }),
    )

    const lastFriday = fixed(
      every('month', 1, { monthly: { kind: 'weekday', week: -1, weekday: 4 } }),
    )

    expect(nextOccurrence(secondTuesday, '2026-11-10', '2026-11-10', 1)).toBe('2026-12-08')
    expect(nextOccurrence(lastFriday, '2026-11-27', '2026-11-27', 1)).toBe('2026-12-25')
  })
})

describe('the end of a series', () => {
  it('ends after the last counted occurrence', () => {
    const three = every('day', 1, { end: { kind: 'after', count: 3 } })

    expect(nextOccurrence(three, '2026-11-02', '2026-11-02', 2)).toBe('2026-11-03')
    expect(nextOccurrence(three, '2026-11-03', '2026-11-03', 3)).toBeNull()
  })

  it('ends on its end date', () => {
    const until = every('week', 1, { end: { kind: 'on', date: '2026-11-10' } })

    expect(nextOccurrence(until, '2026-11-02', '2026-11-02', 1)).toBe('2026-11-09')
    expect(nextOccurrence(until, '2026-11-09', '2026-11-09', 2)).toBeNull()
  })
})

describe('snapping a new repeat to its first day', () => {
  it('moves to the first chosen weekday on or after the date', () => {
    // Sunday the 1st, Mondays and Wednesdays: Monday the 2nd.
    expect(snap(every('week', 1, { weekdays: [0, 2] }), '2026-11-01')).toBe('2026-11-02')
    expect(snap(every('week', 1, { weekdays: [0, 2] }), '2026-11-03')).toBe('2026-11-04')
    // Thursday, Mondays only: the next Monday.
    expect(snap(every('week', 1, { weekdays: [0] }), '2026-11-05')).toBe('2026-11-09')
  })

  it('moves to the day of the month on or after the date', () => {
    expect(snap(every('month', 1, { monthly: { kind: 'day', day: 15 } }), '2026-11-20')).toBe(
      '2026-12-15',
    )
    expect(snap(every('month', 1, { monthly: { kind: 'day', day: -1 } }), '2026-02-03')).toBe(
      '2026-02-28',
    )
  })

  it('leaves daily and yearly dates as they are', () => {
    expect(snap(every('day', 2), '2026-11-04')).toBe('2026-11-04')
  })
})

describe('weekly steps', () => {
  it('jumps whole intervals of weeks after the last chosen day', () => {
    expect(step(every('week', 2, { weekdays: [0, 2] }), '2026-11-04')).toBe('2026-11-16')
  })
})

describe('nthWeekday', () => {
  it('finds the nth and the last weekday', () => {
    expect(nthWeekday(2026, 11, 1, 0)).toBe('2026-11-02')
    expect(nthWeekday(2026, 11, 4, 6)).toBe('2026-11-22')
    expect(nthWeekday(2026, 11, -1, 0)).toBe('2026-11-30')
  })
})

describe('switching between the two kinds', () => {
  it('starts as a plain interval counted from completion', () => {
    expect(defaultRepeat('week')).toMatchObject({
      weekdays: [],
      monthly: null,
      anchor: 'completion',
    })
  })

  it('pins a fixed schedule to the due date’s weekday or day of the month', () => {
    expect(fixedRepeat(defaultRepeat('week'), '2026-11-04')).toMatchObject({
      weekdays: [2],
      anchor: 'due',
    })
    expect(fixedRepeat(defaultRepeat('month'), '2026-11-30')).toMatchObject({
      monthly: { kind: 'day', day: 30 },
    })
  })

  it('drops the pinned days going back to an interval', () => {
    expect(intervalRepeat(fixedRepeat(defaultRepeat('week'), '2026-11-04'))).toMatchObject({
      weekdays: [],
      anchor: 'completion',
    })
  })
})
