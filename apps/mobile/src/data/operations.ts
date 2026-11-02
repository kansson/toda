import type { Operation } from '@toda/backend/model'
import type { List, Task } from '@/tasks/model'

/** The part of a TanStack DB mutation that says what to send. */
export type PendingMutation = {
  type: 'insert' | 'update' | 'delete'
  collectionId: string
  key: string | number
  modified: object
  changes: object
}

const listFields = ['title', 'position', 'sort', 'createdAt'] as const satisfies (keyof List)[]

const taskFields = [
  'listId',
  'parentId',
  'title',
  'notes',
  'position',
  'dueDate',
  'dueTime',
  'deadline',
  'starredAt',
  'completedAt',
  'repeat',
  'seriesId',
  'occurrence',
  'createdAt',
] as const satisfies (keyof Task)[]

function pick<T extends object, K extends keyof T>(row: T, keys: readonly K[]): Pick<T, K> {
  // SAFETY: every key is copied from `row`, so the result has exactly the picked fields.
  return Object.fromEntries(keys.map((key) => [key, row[key]])) as Pick<T, K>
}

/**
 * One outbox transaction as `sync.apply` takes it: inserts carry every field, updates only those
 * that changed, at their whole new value, so a nested repeat rule is never sent in part.
 */
export function toOperations(mutations: readonly PendingMutation[]): Operation[] {
  return mutations.map((mutation): Operation => {
    const clientId = String(mutation.key)

    if (mutation.collectionId === 'lists') {
      // SAFETY: the lists collection only holds lists.
      const row = mutation.modified as List

      if (mutation.type === 'delete') return { table: 'lists', type: 'delete', clientId }

      if (mutation.type === 'insert')
        return { table: 'lists', type: 'insert', clientId, value: pick(row, listFields) }

      const changed = listFields.filter((field) => field in mutation.changes)

      return { table: 'lists', type: 'update', clientId, value: pick(row, changed) }
    }

    if (mutation.collectionId !== 'tasks')
      throw new Error(`Unknown collection ${mutation.collectionId}`)

    // SAFETY: the tasks collection only holds tasks.
    const row = mutation.modified as Task

    if (mutation.type === 'delete') return { table: 'tasks', type: 'delete', clientId }

    if (mutation.type === 'insert')
      return { table: 'tasks', type: 'insert', clientId, value: pick(row, taskFields) }

    const changed = taskFields.filter((field) => field in mutation.changes)

    return { table: 'tasks', type: 'update', clientId, value: pick(row, changed) }
  })
}
