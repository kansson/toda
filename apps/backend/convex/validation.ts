import { NOTES_MAX, TITLE_MAX } from './constants'
import { refusal } from './errors'
import type { cadenceValidator, Infer, repeatValidator } from './schema'

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/u

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/u

function invalid(message: string): never {
  throw refusal('INVALID', message)
}

/** A real calendar date written `YYYY-MM-DD`. */
export function isCalendarDate(value: string) {
  const match = DATE.exec(value)

  if (!match) return false
  const [, year, month, day] = match.map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day!))

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
  )
}

export function checkTitle(title: string) {
  if (title.length > TITLE_MAX) invalid('Title is too long')
}

export function checkListTitle(title: string) {
  if (title.trim().length === 0) invalid('A list needs a name')
  checkTitle(title)
}

export function checkNotes(notes: string) {
  if (notes.length > NOTES_MAX) invalid('Details are too long')
}

export function checkDate(value: string | null, what: string) {
  if (value !== null && !isCalendarDate(value)) invalid(`${what} is not a date`)
}

export function checkTime(value: string | null) {
  if (value !== null && !TIME.test(value)) invalid('Time is not a time of day')
}

export function checkFinite(value: number, what: string) {
  if (!Number.isFinite(value)) invalid(`${what} is not a number`)
}

const isWeekday = (day: number) => Number.isInteger(day) && day >= 0 && day <= 6

/** A schedule the app can step through: whole, bounded numbers and real dates. */
export function checkRepeat(repeat: Infer<typeof repeatValidator> | null) {
  if (repeat === null) return

  if (!Number.isInteger(repeat.interval) || repeat.interval < 1 || repeat.interval > 999)
    invalid('Repeat interval must be 1 to 999')

  if (!repeat.weekdays.every(isWeekday) || new Set(repeat.weekdays).size !== repeat.weekdays.length)
    invalid('Repeat weekdays are not days of the week')

  if (repeat.unit !== 'week' && repeat.weekdays.length > 0) invalid('Only weekly repeats have days')

  if (repeat.monthly !== null) {
    if (repeat.unit !== 'month') invalid('Only monthly repeats have a day of the month')

    if (repeat.monthly.kind === 'day') {
      const { day } = repeat.monthly

      if (!Number.isInteger(day) || !(day === -1 || (day >= 1 && day <= 31)))
        invalid('Repeat day of the month is out of range')
    } else {
      const { week, weekday } = repeat.monthly

      if (
        !(week === -1 || (Number.isInteger(week) && week >= 1 && week <= 4)) ||
        !isWeekday(weekday)
      )
        invalid('Repeat weekday of the month is out of range')
    }
  }

  if (repeat.end.kind === 'on') checkDate(repeat.end.date, 'Repeat end')

  if (
    repeat.end.kind === 'after' &&
    (!Number.isInteger(repeat.end.count) || repeat.end.count < 1 || repeat.end.count > 9999)
  )
    invalid('Repeat count must be 1 to 9999')
}

const isWhole = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max

/** A subtask's cadence the app can count with: whole, bounded numbers and real dates. */
export function checkCadence(cadence: Infer<typeof cadenceValidator> | null | undefined) {
  if (cadence === null || cadence === undefined) return

  if (cadence.kind === 'every') {
    if (!isWhole(cadence.count, 1, 999)) invalid('A subtask comes round every 1 to 999 times')

    if (!isWhole(cadence.from, 1, Number.MAX_SAFE_INTEGER))
      invalid('A subtask’s first time must be a positive whole number')

    return
  }

  if (!isWhole(cadence.interval, 1, 999)) invalid('A subtask’s interval must be 1 to 999')

  checkDate(cadence.from, 'A subtask’s schedule start')
  checkDate(cadence.next, 'A subtask’s next date')

  if (cadence.next < cadence.from) invalid('A subtask’s next date is before its schedule starts')

  if (!isWhole(cadence.leeway, 0, 365)) invalid('A subtask’s leeway must be 0 to 365 days')
}
