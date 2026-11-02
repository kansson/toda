/** A task as the list widget shows it, worded by the app. */
export type WidgetTask = {
  id: string
  title: string
  /** When it is due, such as "Today, 14:00"; empty for none. */
  due: string
  overdue: boolean
  starred: boolean
}

/** What one list widget can show: Today, Starred or a list, with its open tasks. */
export type WidgetSource = {
  /** `today`, `starred` or the list's id; each widget keeps the one chosen as it was placed. */
  key: string
  title: string
  /** Opens a new task in it. */
  addLink: string
  tasks: WidgetTask[]
}

/** Everything the widgets draw (`modules/widgets`, `WidgetSnapshot.kt`), in the app's language. */
export type WidgetSnapshot = {
  /** Opens a new task from the New task widget. */
  newTaskLink: string
  /** A task's page, with the task's id after it, for a tap on a task in a widget. */
  taskLink: string
  labels: {
    emptyTitle: string
    newTask: string
    /** Read out for a task's check box. */
    complete: string
  }
  /** Today, Starred and every list, in the order the app shows them. */
  sources: WidgetSource[]
}
