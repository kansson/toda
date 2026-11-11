import { msg, plural, t } from '@lingui/core/macro'
import { getCalendars, getLocales } from 'expo-localization'
import { i18n } from '@/i18n'
import type { Cadence, Lean } from '@/tasks/cadence'
import { addDays, type CalendarDate, daysBetween, momentOf, parts } from '@/tasks/dates'
import type { Repeat, Task } from '@/tasks/model'
import { isEveryWeekday } from '@/tasks/recurrence'
import type { SectionKind } from '@/tasks/views'

const formats = new Map<string, Intl.DateTimeFormat>()

/**
 * The app's language in the phone's region, such as `en-SE` for English on a phone set to Sweden,
 * so dates read in the app's language but in the order and style the phone's region uses
 * ("Mon 9 Nov" rather than "Mon, Nov 9"). Just the language where the region is unknown or the
 * pair has no formats of its own.
 */
function formatLocale() {
  const region = getLocales()[0]?.regionCode
  const regional = region ? `${i18n.locale}-${region}` : i18n.locale

  return Intl.DateTimeFormat.supportedLocalesOf([regional]).length > 0 ? regional : i18n.locale
}

/** A moment formatted for the phone: the app's language in its region and its time zone. */
export function formatDate(moment: Date, options: Intl.DateTimeFormatOptions) {
  const locale = formatLocale()
  const key = `${locale} ${JSON.stringify(options)}`
  let format = formats.get(key)

  if (!format) {
    format = new Intl.DateTimeFormat(locale, options)
    formats.set(key, format)
  }

  return format.format(moment)
}

/** A date as people say it: Today, Tomorrow, a weekday this week, or the day and month. */
export function dayLabel(date: CalendarDate, today: CalendarDate) {
  const days = daysBetween(today, date)
  const moment = momentOf(date)

  if (days === 0) return t({ message: 'Today', comment: 'A date that is today' })

  if (days === 1) return t({ message: 'Tomorrow', comment: 'A date that is tomorrow' })

  if (days === -1) return t({ message: 'Yesterday', comment: 'A date that was yesterday' })

  if (days > 1 && days < 7) return formatDate(moment, { weekday: 'long' })

  return parts(date).year === parts(today).year
    ? formatDate(moment, { weekday: 'short', day: 'numeric', month: 'short' })
    : formatDate(moment, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** A date with its day, month and year, where relative words would mislead, as for an end date. */
export function fullDate(date: CalendarDate) {
  return formatDate(momentOf(date), { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * A date inside a sentence: today, tomorrow and yesterday in lower case, and other dates after
 * "on", as in "back on Friday".
 */
export function datePhrase(date: CalendarDate, today: CalendarDate) {
  const days = daysBetween(today, date)

  if (days === 0) return t({ message: 'today', comment: 'A date that is today, inside a sentence' })

  if (days === 1)
    return t({ message: 'tomorrow', comment: 'A date that is tomorrow, inside a sentence' })

  if (days === -1)
    return t({ message: 'yesterday', comment: 'A date that was yesterday, inside a sentence' })
  const day = dayLabel(date, today)

  return t({ message: `on ${day}`, comment: 'A date inside a sentence, as in back on Friday' })
}

/**
 * Whether the phone shows a 24-hour clock, which its owner chooses apart from the language; null
 * where it does not say.
 */
export function uses24HourClock() {
  return getCalendars()[0]?.uses24hourClock ?? null
}

/**
 * A time of day in the app's language and the phone's region, on the phone's own clock: `14:05` on
 * a 24-hour phone even in English, `2:05 PM` on a 12-hour one.
 */
export function timeLabel(time: string) {
  const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  const clock = uses24HourClock()

  if (clock !== null) {
    options.hourCycle = clock ? 'h23' : 'h12'
  }

  return formatDate(momentOf('2000-01-01', time), options)
}

/** When a task is due, with its time. */
export function dueLabel(task: Pick<Task, 'dueDate' | 'dueTime'>, today: CalendarDate) {
  if (task.dueDate === null) return ''
  const day = dayLabel(task.dueDate, today)

  return task.dueTime ? `${day}, ${timeLabel(task.dueTime)}` : day
}

/** Whether a task's date or time has passed. */
export function isOverdue(
  task: Pick<Task, 'dueDate' | 'dueTime' | 'completedAt'>,
  today: CalendarDate,
  now = Date.now(),
) {
  if (task.completedAt !== null || task.dueDate === null) return false

  if (task.dueDate < today) return true

  return (
    task.dueDate === today &&
    task.dueTime !== null &&
    momentOf(task.dueDate, task.dueTime).getTime() < now
  )
}

export function deadlineLabel(deadline: CalendarDate, today: CalendarDate) {
  const days = daysBetween(today, deadline)

  if (days === 0) return t({ message: 'Due today', comment: 'A deadline that is today' })

  if (days === 1) return t({ message: 'Due tomorrow', comment: 'A deadline that is tomorrow' })

  if (days < 0)
    return plural(-days, {
      one: 'Due yesterday',
      other: 'Due # days ago',
    })
  const day = dayLabel(deadline, today)

  return t({ message: `Due ${day}`, comment: 'A deadline, with its date' })
}

const weekdayMoment = (weekday: number) => momentOf(addDays('2024-01-01', weekday)) // a Monday

/** A weekday's name, Monday as 0. */
export function weekdayName(weekday: number, width: 'long' | 'short' | 'narrow' = 'long') {
  return formatDate(weekdayMoment(weekday), { weekday: width })
}

function ordinalWeek(week: number) {
  switch (week) {
    case 1:
      return t({ message: 'first', comment: 'Monthly repeat: the first of a weekday in the month' })
    case 2:
      return t({
        message: 'second',
        comment: 'Monthly repeat: the second of a weekday in the month',
      })
    case 3:
      return t({ message: 'third', comment: 'Monthly repeat: the third of a weekday in the month' })
    case 4:
      return t({
        message: 'fourth',
        comment: 'Monthly repeat: the fourth of a weekday in the month',
      })
    default:
      return t({ message: 'last', comment: 'Monthly repeat: the last of a weekday in the month' })
  }
}

/** A week's position in a month, for the repeat editor: first, second … last. */
export function ordinalWeekLabel(week: number) {
  return ordinalWeek(week)
}

/**
 * A weekly repeat's days inside a sentence, after "on": "every day" for all seven, one day in
 * full, or several shortened, as in "Mon, Thu".
 */
export function weekdaysPhrase(weekdays: readonly number[]) {
  if (weekdays.length === 7)
    return t({ message: 'every day', comment: 'A weekly repeat on all seven days, after "on"' })

  return weekdays
    .slice()
    .sort((a, b) => a - b)
    .map((day) => weekdayName(day, weekdays.length === 1 ? 'long' : 'short'))
    .join(', ')
}

/** A repeat rule in a few words, such as "Every 3 days, from when done" or "Weekly on Mon, Thu". */
export function repeatLabel(repeat: Repeat) {
  const n = repeat.interval
  let base: string

  switch (repeat.unit) {
    case 'day':
      base = plural(n, { one: 'Daily', other: 'Every # days' })
      break
    case 'week': {
      if (isEveryWeekday(repeat)) {
        base = t({ message: 'Every weekday', comment: 'Repeat summary: Monday to Friday' })
        break
      }

      const days = weekdaysPhrase(repeat.weekdays)

      const every = plural(n, { one: 'Weekly', other: 'Every # weeks' })
      base = days
        ? t({
            message: `${every} on ${days}`,
            comment: 'Repeat summary: the weekly rule and its days',
          })
        : every
      break
    }

    case 'month': {
      const every = plural(n, { one: 'Monthly', other: 'Every # months' })
      const monthly = repeat.monthly

      if (monthly === null) {
        base = every
      } else if (monthly.kind === 'day') {
        base =
          monthly.day === -1
            ? t({
                message: `${every} on the last day`,
                comment: 'Repeat summary: monthly on the last day',
              })
            : t({
                message: `${every} on day ${monthly.day}`,
                comment: 'Repeat summary: monthly on a day number',
              })
      } else {
        const which = ordinalWeek(monthly.week)
        const day = weekdayName(monthly.weekday)
        base = t({
          message: `${every} on the ${which} ${day}`,
          comment: 'Repeat summary: monthly on e.g. the second Tuesday',
        })
      }

      break
    }

    case 'year':
      base = plural(n, { one: 'Yearly', other: 'Every # years' })
      break
  }

  const anchor =
    repeat.anchor === 'completion'
      ? t({
          message: 'after done',
          comment: 'Repeat summary suffix: the next date counts from completion',
        })
      : null

  const end =
    repeat.end.kind === 'on'
      ? t({
          message: `until ${fullDate(repeat.end.date)}`,
          comment: 'Repeat summary suffix: the end date',
        })
      : repeat.end.kind === 'after'
        ? plural(repeat.end.count, { one: '# time', other: '# times' })
        : null

  return [base, anchor, end].filter(Boolean).join(', ')
}

/** How often, as in "Every 3 days". */
export function everyLabel(unit: Repeat['unit'], count: number) {
  switch (unit) {
    case 'day':
      return plural(count, { one: 'Every day', other: 'Every # days' })
    case 'week':
      return plural(count, { one: 'Every week', other: 'Every # weeks' })
    case 'month':
      return plural(count, { one: 'Every month', other: 'Every # months' })
    case 'year':
      return plural(count, { one: 'Every year', other: 'Every # years' })
  }
}

/** A subtask coming round every few times its task does, as in "Once every 3 times". */
export function everyTimesLabel(count: number) {
  return plural(count, { one: 'Every time', other: 'Once every # times' })
}

/** Which of its task's dates a subtask on its own schedule lands on, for the cadence editor. */
export function leanLabel(lean: Lean) {
  switch (lean) {
    case 'closest':
      return t({
        message: 'The task’s closest date',
        comment: 'Subtask schedule: lands on whichever of the task’s dates is nearest its own',
      })
    case 'before':
      return t({
        message: 'The task’s date before',
        comment: 'Subtask schedule: lands on the last of the task’s dates on or before its own',
      })
    case 'after':
      return t({
        message: 'The task’s date after',
        comment: 'Subtask schedule: lands on the first of the task’s dates on or after its own',
      })
  }
}

/** How far a subtask leaning before or after its date may go the other way, as a card says it. */
export function leewayLabel(lean: Lean, days: number) {
  return lean === 'after'
    ? plural(days, { one: 'Up to # day early', other: 'Up to # days early' })
    : plural(days, { one: 'Up to # day late', other: 'Up to # days late' })
}

/**
 * How often a subtask comes round, in a few words: "Once every 3 times", or "Every month, on the
 * closest date" for one on its own schedule.
 */
export function cadenceLabel(cadence: Cadence) {
  if (cadence.kind === 'every') return everyTimesLabel(cadence.count)
  const every = everyLabel(cadence.unit, cadence.interval)
  const leeway = cadence.leeway

  switch (cadence.lean) {
    case 'closest':
      return t({
        message: `${every}, on the closest date`,
        comment: 'Subtask cadence summary: its own schedule, on the task’s nearest date',
      })
    case 'before':
      return leeway === 0
        ? t({
            message: `${every}, on the date before`,
            comment: 'Subtask cadence summary: its own schedule, on the task’s date on or before',
          })
        : plural(leeway, {
            one: `${every}, on the date before or # day late`,
            other: `${every}, on the date before or up to # days late`,
          })
    case 'after':
      return leeway === 0
        ? t({
            message: `${every}, on the date after`,
            comment: 'Subtask cadence summary: its own schedule, on the task’s date on or after',
          })
        : plural(leeway, {
            one: `${every}, on the date after or # day early`,
            other: `${every}, on the date after or up to # days early`,
          })
  }
}

/**
 * When a subtask next comes round: this time, or after how many of its task's occurrences and on
 * which of its dates; null once its task's repeat ends first.
 */
export function nextRoundLabel(
  round: { date: CalendarDate; after: number } | null,
  today: CalendarDate,
) {
  if (round === null)
    return t({
      message: 'Not again before the repeat ends',
      comment: 'Subtask: its turn would come after its task stops repeating',
    })

  if (round.after === 0)
    return t({ message: 'Comes round this time', comment: 'Subtask: its turn is now' })
  const { after } = round
  const day = dayLabel(round.date, today)

  return plural(after, { one: `Next time: ${day}`, other: `In # times: ${day}` })
}

/** A section's heading in the reader's language. */
export function sectionTitle(
  heading: SectionKind,
  today: CalendarDate,
  listTitle: (id: string | null) => string,
) {
  switch (heading.kind) {
    case 'all':
      return ''
    case 'past':
      return t({ message: 'Overdue', comment: 'Section of tasks whose date has passed' })
    case 'overdue':
      return t({ message: 'Past deadline', comment: 'Section of tasks whose deadline has passed' })
    case 'today':
      return t({ message: 'Today', comment: 'Section of tasks for today' })
    case 'tomorrow':
      return t({ message: 'Tomorrow', comment: 'Section of tasks for tomorrow' })
    case 'later':
      return t({ message: 'Later', comment: 'Section of tasks for later dates' })
    case 'noDate':
      return t({ message: 'No date', comment: 'Section of tasks without a date' })
    case 'noDeadline':
      return t({ message: 'No deadline', comment: 'Section of tasks without a deadline' })
    case 'starredRecently':
      return t({
        message: 'Starred recently',
        comment: 'Section of tasks starred in the last month',
      })
    case 'starredEarlier':
      return t({ message: 'Starred earlier', comment: 'Section of tasks starred over a month ago' })
    case 'notStarred':
      return t({ message: 'Not starred', comment: 'Section of tasks without a star' })
    case 'date':
      return dayLabel(heading.date, today)
    case 'list':
      return heading.listId === null
        ? t({ message: 'No list', comment: 'Section of tasks in no list' })
        : listTitle(heading.listId)
  }
}

/** The list sorts, for the sort sheet, in Google Tasks' order. */
export const sortLabels = {
  manual: msg({ message: 'Relevance', comment: 'Sort option: the order the user arranged' }),
  date: msg({ message: 'Date', comment: 'Sort option: by date' }),
  deadline: msg({ message: 'Deadline', comment: 'Sort option: by deadline' }),
  starred: msg({
    message: 'Starred recently',
    comment: 'Sort option: most recently starred first',
  }),
  title: msg({ message: 'Title', comment: 'Sort option: alphabetically' }),
}
