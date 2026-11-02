import { addDays, type CalendarDate, daysBetween } from './dates'
import type { ListSort, Task } from './model'

/** A task as a row: top-level or a subtask under its parent. */
export type Row = { task: Task; depth: 0 | 1 }

/** Section headings by meaning; the screen words them. */
export type SectionKind =
  | { kind: 'all' }
  | { kind: 'past' }
  | { kind: 'today' }
  | { kind: 'tomorrow' }
  | { kind: 'later' }
  | { kind: 'noDate' }
  | { kind: 'overdue' }
  | { kind: 'noDeadline' }
  | { kind: 'starredRecently' }
  | { kind: 'starredEarlier' }
  | { kind: 'notStarred' }
  | { kind: 'date'; date: CalendarDate }
  /** A list's tasks, or with null those in no list. */
  | { kind: 'list'; listId: string | null }

export type Section = { key: string; heading: SectionKind; rows: Row[] }

/** How long a star counts as recent, as Google Tasks sorts it. */
const RECENT_STAR_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Whether a task shows in lists yet. A repeating task's later occurrences wait until their day,
 * so a series shows one open occurrence at a time; a new repeating task shows at once.
 */
export function isVisible(task: Task, today: CalendarDate) {
  return !(
    task.occurrence > 1 &&
    task.completedAt === null &&
    task.dueDate !== null &&
    task.dueDate > today
  )
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

function byPosition(a: Task, b: Task) {
  return (
    a.position - b.position || a.createdAt - b.createdAt || a.clientId.localeCompare(b.clientId)
  )
}

function byDue(a: Task, b: Task) {
  return (
    (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
    (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99') ||
    byPosition(a, b)
  )
}

function byDeadline(a: Task, b: Task) {
  return (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') || byDue(a, b)
}

function byStar(a: Task, b: Task) {
  return (b.starredAt ?? 0) - (a.starredAt ?? 0) || byPosition(a, b)
}

function byTitle(a: Task, b: Task) {
  return collator.compare(a.title, b.title) || byPosition(a, b)
}

const comparators: Record<ListSort, (a: Task, b: Task) => number> = {
  manual: byPosition,
  date: byDue,
  deadline: byDeadline,
  starred: byStar,
  title: byTitle,
}

function dayHeading(date: CalendarDate | null, today: CalendarDate): SectionKind {
  if (date === null) return { kind: 'noDate' }
  const days = daysBetween(today, date)

  if (days < 0) return { kind: 'past' }

  if (days === 0) return { kind: 'today' }

  if (days === 1) return { kind: 'tomorrow' }

  return { kind: 'later' }
}

function deadlineHeading(date: CalendarDate | null, today: CalendarDate): SectionKind {
  if (date === null) return { kind: 'noDeadline' }
  const heading = dayHeading(date, today)

  return heading.kind === 'past' ? { kind: 'overdue' } : heading
}

function starHeading(task: Task, now: number): SectionKind {
  if (task.starredAt === null) return { kind: 'notStarred' }

  return now - task.starredAt <= RECENT_STAR_MS
    ? { kind: 'starredRecently' }
    : { kind: 'starredEarlier' }
}

function headingKey(heading: SectionKind) {
  return heading.kind === 'date'
    ? `date:${heading.date}`
    : heading.kind === 'list'
      ? `list:${heading.listId}`
      : heading.kind
}

/** Rows grouped by consecutive headings, keeping the order they come in. */
function group(entries: { heading: SectionKind; rows: Row[] }[]) {
  const sections: Section[] = []

  for (const entry of entries) {
    const key = headingKey(entry.heading)
    const last = sections[sections.length - 1]

    if (last?.key === key) last.rows.push(...entry.rows)
    else sections.push({ key, heading: entry.heading, rows: [...entry.rows] })
  }

  return sections
}

export type ListView = {
  /** Open tasks, in sections by the list's sort; one untitled section in its own order. */
  open: Section[]
  /** Done top-level tasks with their subtasks, most recently done first. */
  completed: Row[]
  /** How many tasks the Completed heading counts, subtasks done under open tasks excluded. */
  completedCount: number
}

/**
 * A list's tasks as its screen shows them: open top-level tasks sorted and sectioned by the
 * list's sort, each followed by its subtasks in their own order (open first, then done), and the
 * done ones below. Later occurrences of a repeating task wait for their day.
 */
export function listView(
  tasks: readonly Task[],
  sort: ListSort,
  today: CalendarDate,
  now: number,
): ListView {
  const children = new Map<string, Task[]>()
  const parents: Task[] = []

  for (const task of tasks) {
    if (!isVisible(task, today)) continue

    if (task.parentId === null) {
      parents.push(task)
    } else {
      const siblings = children.get(task.parentId) ?? []
      siblings.push(task)
      children.set(task.parentId, siblings)
    }
  }

  const subtaskRows = (parent: Task, done: boolean) =>
    (children.get(parent.clientId) ?? [])
      .filter((task) => done || task.completedAt === null)
      .slice()
      .sort(
        (a, b) =>
          Number(a.completedAt !== null) - Number(b.completedAt !== null) || byPosition(a, b),
      )
      .map((task): Row => ({ task, depth: 1 }))

  const open = parents
    .filter((task) => task.completedAt === null)
    .slice()
    .sort(comparators[sort])

  const heading = (task: Task): SectionKind =>
    sort === 'date'
      ? dayHeading(task.dueDate, today)
      : sort === 'deadline'
        ? deadlineHeading(task.deadline, today)
        : sort === 'starred'
          ? starHeading(task, now)
          : { kind: 'all' }

  const sections = group(
    open.map((task) => ({
      heading: heading(task),
      rows: [{ task, depth: 0 as const }, ...subtaskRows(task, true)],
    })),
  )

  const done = parents
    .filter((task) => task.completedAt !== null)
    .slice()
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))

  return {
    open: sections,
    completed: done.flatMap((task) => [{ task, depth: 0 as const }, ...subtaskRows(task, true)]),
    completedCount: done.length,
  }
}

/** Open tasks with a date up to today, overdue first, across lists. */
export function todayView(tasks: readonly Task[], today: CalendarDate): Section[] {
  const due = tasks
    .filter(
      (task) =>
        task.completedAt === null &&
        task.dueDate !== null &&
        task.dueDate <= today &&
        isVisible(task, today),
    )
    .slice()
    .sort(byDue)

  return group(
    due.map((task) => ({ heading: dayHeading(task.dueDate, today), rows: [{ task, depth: 0 }] })),
  )
}

/** Open tasks dated after today, by day, for the coming weeks and then later. */
export function upcomingView(tasks: readonly Task[], today: CalendarDate, days = 14): Section[] {
  const horizon = addDays(today, days)

  const upcoming = tasks
    .filter((task) => task.completedAt === null && task.dueDate !== null && task.dueDate > today)
    .slice()
    .sort(byDue)

  return group(
    upcoming.map((task) => ({
      heading: task.dueDate! <= horizon ? { kind: 'date', date: task.dueDate! } : { kind: 'later' },
      rows: [{ task, depth: 0 }],
    })),
  )
}

/** Open starred tasks, most recently starred first. */
export function starredView(tasks: readonly Task[], today: CalendarDate, now: number): Section[] {
  const starred = tasks
    .filter(
      (task) => task.completedAt === null && task.starredAt !== null && isVisible(task, today),
    )
    .slice()
    .sort(byStar)

  return group(
    starred.map((task) => ({ heading: starHeading(task, now), rows: [{ task, depth: 0 }] })),
  )
}

function folded(text: string) {
  return text.normalize('NFKD').replaceAll(/\p{M}/gu, '').toLocaleLowerCase()
}

/**
 * The tasks whose title or details hold every word of the query, ignoring case and accents, and
 * the task over each subtask found, so the main screen's views show them where they belong. Every
 * task for a query of no words.
 */
export function matchingTasks(tasks: readonly Task[], query: string): readonly Task[] {
  const words = folded(query).split(/\s+/u).filter(Boolean)

  if (words.length === 0) return tasks

  const found = new Set(
    tasks.flatMap((task) => {
      const text = folded(`${task.title}\n${task.notes}`)

      return words.every((word) => text.includes(word)) ? [task.clientId] : []
    }),
  )

  const parents = new Set(
    tasks.flatMap((task) =>
      found.has(task.clientId) && task.parentId !== null ? [task.parentId] : [],
    ),
  )

  return tasks.filter((task) => found.has(task.clientId) || parents.has(task.clientId))
}

/** How many open, visible top-level tasks each list has, for the overview. */
export function openCounts(tasks: readonly Task[], today: CalendarDate) {
  const counts = new Map<string | null, number>()

  for (const task of tasks) {
    if (task.parentId === null && task.completedAt === null && isVisible(task, today))
      counts.set(task.listId, (counts.get(task.listId) ?? 0) + 1)
  }

  return counts
}

/** What the main screen shows of the tasks in scope: everything open, or one view of them. */
export type Filter = 'none' | 'today' | 'upcoming' | 'starred' | 'completed'

/**
 * The tasks in scope (one list, or every list) as the main screen shows them for a filter and a
 * sort. With no filter, open tasks in the sort's sections, subtasks under their task; across every
 * list in My order, grouped by list in `listOrder`, those in no list last. Today, Upcoming and
 * Starred keep their own sections and order them by the sort unless it is My order. Completed
 * lists done tasks, most recently done first in My order.
 */
export function browseView(
  tasks: readonly Task[],
  filter: Filter,
  sort: ListSort,
  today: CalendarDate,
  now: number,
  listOrder: readonly string[] | null,
): Section[] {
  const sorted = (sections: Section[]) =>
    sort === 'manual'
      ? sections
      : sections.map((section) => ({
          ...section,
          rows: section.rows.slice().sort((a, b) => comparators[sort](a.task, b.task)),
        }))

  switch (filter) {
    case 'today':
      return sorted(todayView(tasks, today))
    case 'upcoming':
      return sorted(upcomingView(tasks, today))
    case 'starred':
      return sorted(starredView(tasks, today, now))
    case 'completed': {
      const done = listView(tasks, sort, today, now).completed.filter((row) => row.depth === 0)

      return done.length === 0
        ? []
        : sorted([{ key: 'completed', heading: { kind: 'all' }, rows: done }])
    }

    case 'none':
      if (listOrder === null || sort !== 'manual') return listView(tasks, sort, today, now).open

      return [...listOrder, null].flatMap((listId) => {
        const rows = listView(
          tasks.filter((task) => task.listId === listId),
          'manual',
          today,
          now,
        ).open.flatMap((section) => section.rows)

        return rows.length === 0
          ? []
          : [{ key: `list:${listId ?? ''}`, heading: { kind: 'list' as const, listId }, rows }]
      })
  }
}
