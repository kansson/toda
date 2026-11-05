import type { CalendarDate } from '../tasks/dates'
import type { ListSort, Task } from '../tasks/model'
import { browseView, listView } from '../tasks/views'

/** Where a list widget's tasks come from: Today, Starred or one list. */
export type WidgetView = { kind: 'today' } | { kind: 'starred' } | { kind: 'list'; listId: string }

/**
 * A view's open top-level tasks in one sort, as the app's main screen orders them: Today and
 * Starred keep their own sections and sort within them, a list sorts and sections as its page.
 */
export function viewTasks(
  tasks: readonly Task[],
  view: WidgetView,
  sort: ListSort,
  today: CalendarDate,
  now: number,
): Task[] {
  const sections =
    view.kind === 'list'
      ? listView(
          tasks.filter((task) => task.listId === view.listId),
          sort,
          today,
          now,
        ).open
      : browseView(tasks, view.kind, sort, today, now, null)

  return sections.flatMap((section) =>
    section.rows.filter((row) => row.depth === 0).map((row) => row.task),
  )
}

/** A view's tasks for a widget: each once, and every sort's order of them by id. */
export type SortedTasks = { tasks: Task[]; orders: Record<ListSort, string[]> }

/**
 * A view's tasks in every sort, at most `limit` in each: each task once, those of `sort` first
 * and in its order, and every sort's order by task id, so a widget can show any of them.
 */
export function sortedTasks(
  ordered: (sort: ListSort) => Task[],
  sort: ListSort,
  limit: number,
): SortedTasks {
  const tasks = new Map<string, Task>()

  const order = (option: ListSort) => {
    const shown = ordered(option).slice(0, limit)

    for (const task of shown) if (!tasks.has(task.clientId)) tasks.set(task.clientId, task)

    return shown.map((task) => task.clientId)
  }

  const first = order(sort)
  const pick = (option: ListSort) => (option === sort ? first : order(option))

  // In the sort sheet's order, so the tasks only other sorts show come in that order too.
  const orders = {
    manual: pick('manual'),
    date: pick('date'),
    deadline: pick('deadline'),
    starred: pick('starred'),
    title: pick('title'),
  }

  return { tasks: [...tasks.values()], orders }
}
