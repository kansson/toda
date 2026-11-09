import type { ListSort } from '@/tasks/model'

/** A task as the list widget shows it, worded by the app. */
export type WidgetTask = {
  id: string
  title: string
  /** When it is due, such as "Today, 14:00"; empty for none. */
  due: string
  overdue: boolean
  starred: boolean
  /**
   * A repeating task's date (`YYYY-MM-DD`), empty for any other: once it has passed, the check
   * box opens `doneLink` to ask in the app which day it was done, rather than completing it.
   */
  asksAfter: string
}

/** What one list widget can show: Today, Starred or a list, with its open tasks. */
export type WidgetSource = {
  /** `today`, `starred` or the list's id; each widget keeps the one chosen as it was placed. */
  key: string
  title: string
  /** Opens a new task in it. */
  addLink: string
  /** The sort a widget shows it in until it is given one: the list's own, or My order. */
  sort: ListSort
  /** Its tasks, each once, in `sort`'s order and then those only another sort shows. */
  tasks: WidgetTask[]
  /** Every sort's tasks, by id, in that sort's order. */
  orders: Record<ListSort, string[]>
}

/**
 * Everything the widgets draw (`modules/widgets`, `WidgetSnapshot.kt`), in the app's language.
 * `updateWidgets` adds `completedRound`, which `storeSnapshot` reads and does not keep.
 */
export type WidgetSnapshot = {
  /** Opens a new task from the New task widget. */
  newTaskLink: string
  /** A task's page, with the task's id after it, for a tap on a task in a widget. */
  taskLink: string
  /** Asks in the app which day a late repeating task was done, with the task's id after it. */
  doneLink: string
  labels: {
    emptyTitle: string
    newTask: string
    /** Read out for a task's check box. */
    complete: string
    /** The sorts a widget can be given, named as the app's sort sheet names them, in its order. */
    sorts: { key: ListSort; label: string }[]
  }
  /** Today, Starred and every list, in the order the app shows them. */
  sources: WidgetSource[]
}
