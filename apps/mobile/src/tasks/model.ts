import type { ListRow, TaskRow } from '@toda/backend/model'

export type { ListRow, ListSort, Repeat, TaskRow } from '@toda/backend/model'

export { DEFAULT_LIST_ID, NOTES_MAX, TITLE_MAX } from '@toda/backend/model'

/** A choice of list standing for no list, where a choice must be a string. */
export const NO_LIST = ''

/** A task as the app holds it, and as it writes it. */
export type Task = TaskRow

/** A list as the app holds it, and as it writes it. */
export type List = ListRow

/** The fields of a task the app sets when it creates one; the rest have defaults. */
export type NewTask = Pick<Task, 'listId' | 'title'> & Partial<Omit<Task, 'clientId' | 'updatedAt'>>

/** A new task with every field set: open, unstarred, with no date and no repeat. */
export function newTask(clientId: string, fields: NewTask, now: number): Task {
  return {
    clientId,
    parentId: null,
    notes: '',
    position: 0,
    dueDate: null,
    dueTime: null,
    deadline: null,
    starredAt: null,
    completedAt: null,
    repeat: null,
    seriesId: null,
    occurrence: 1,
    createdAt: now,
    updatedAt: now,
    ...fields,
  }
}
