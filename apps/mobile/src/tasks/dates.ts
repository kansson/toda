/**
 * Calendar dates as the app keeps them: `YYYY-MM-DD` strings in the phone's own time zone, so a
 * task due on Friday stays due on Friday wherever the phone travels, and comparing two dates is
 * comparing two strings. Arithmetic runs in UTC, where every day has 24 hours.
 */
export type CalendarDate = string

/** Days of the week, Monday first: 0 is Monday and 6 is Sunday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/u

const DAY_MS = 24 * 60 * 60 * 1000

function pad(value: number, width = 2) {
  return String(value).padStart(width, '0')
}

function fromUtc(date: Date): CalendarDate {
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** The parts of a date, or throws for text that is not one. */
export function parts(date: CalendarDate) {
  const match = DATE.exec(date)

  if (!match) throw new Error(`Not a calendar date: ${date}`)

  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

function toUtc(date: CalendarDate) {
  const { year, month, day } = parts(date)

  return new Date(Date.UTC(year, month - 1, day))
}

export function isCalendarDate(value: string) {
  if (!DATE.test(value)) return false
  const { year, month, day } = parts(value)

  return day >= 1 && day <= daysInMonth(year, month)
}

/** The phone's local date at a moment. */
export function localDate(moment: Date | number = Date.now()): CalendarDate {
  const date = new Date(moment)

  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return fromUtc(new Date(toUtc(date).getTime() + days * DAY_MS))
}

/** The same day `months` later, or the month's last day where it is shorter (31 Jan → 28 Feb). */
export function addMonths(date: CalendarDate, months: number, day = parts(date).day): CalendarDate {
  const { year, month } = parts(date)
  const index = year * 12 + (month - 1) + months
  const targetYear = Math.floor(index / 12)
  const targetMonth = (index % 12) + 1

  return dateOf(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)))
}

export function dateOf(year: number, month: number, day: number): CalendarDate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`
}

export function weekday(date: CalendarDate): Weekday {
  // getUTCDay is 0 for Sunday; Monday first instead.
  // SAFETY: (n + 6) % 7 of a day index is always 0 to 6.
  return ((toUtc(date).getUTCDay() + 6) % 7) as Weekday
}

/** The Monday of the date's week. */
export function startOfWeek(date: CalendarDate): CalendarDate {
  return addDays(date, -weekday(date))
}

/** Whole days from `from` to `to`: positive when `to` is later. */
export function daysBetween(from: CalendarDate, to: CalendarDate) {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS)
}

/** The local moment a date and an optional `HH:MM` time stand for. */
export function momentOf(date: CalendarDate, time: string | null = null) {
  const { year, month, day } = parts(date)
  const [hours = 0, minutes = 0] = time ? time.split(':').map(Number) : []

  return new Date(year, month - 1, day, hours, minutes)
}

/** The local `HH:MM` of a moment. */
export function localTime(moment: Date | number): string {
  const date = new Date(moment)

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** A date chosen in a date picker, which reports midnight UTC of the chosen day. */
export function pickedDate(date: Date): CalendarDate {
  return fromUtc(date)
}

/** The ISO string a date picker opens at, for a calendar date. */
export function pickerDate(date: CalendarDate) {
  return toUtc(date).toISOString()
}
