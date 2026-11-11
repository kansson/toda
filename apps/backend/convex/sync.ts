import type { Doc, Id } from './_generated/dataModel'
import { mutation, type MutationCtx } from './_generated/server'
import { refusal } from './errors'
import { MAX_LISTS } from './lists'
import { operationValidator, v, type Infer } from './schema'
import { MAX_TASKS } from './tasks'
import { requireUser } from './users'
import {
  checkCadence,
  checkDate,
  checkFinite,
  checkListTitle,
  checkNotes,
  checkRepeat,
  checkTime,
  checkTitle,
} from './validation'

type Operation = Infer<typeof operationValidator>

/** One outbox transaction holds at most this many writes, such as a list deleted with its tasks. */
const MAX_OPERATIONS = 2000

/** Subtasks of one task removed along with it, and tasks of one list. */
const CASCADE_LIMIT = 5000

function findList(ctx: MutationCtx, userId: Id<'users'>, clientId: string) {
  return ctx.db
    .query('lists')
    .withIndex('by_user_client', (q) => q.eq('userId', userId).eq('clientId', clientId))
    .unique()
}

function findTask(ctx: MutationCtx, userId: Id<'users'>, clientId: string) {
  return ctx.db
    .query('tasks')
    .withIndex('by_user_client', (q) => q.eq('userId', userId).eq('clientId', clientId))
    .unique()
}

function checkListValue(value: Partial<Doc<'lists'>>) {
  if (value.title !== undefined) checkListTitle(value.title)

  if (value.position !== undefined) checkFinite(value.position, 'Position')
}

function checkTaskValue(value: Partial<Doc<'tasks'>>) {
  if (value.title !== undefined) checkTitle(value.title)

  if (value.notes !== undefined) checkNotes(value.notes)

  if (value.position !== undefined) checkFinite(value.position, 'Position')

  if (value.dueDate !== undefined) checkDate(value.dueDate, 'Date')

  if (value.dueTime !== undefined) checkTime(value.dueTime)

  if (value.deadline !== undefined) checkDate(value.deadline, 'Deadline')

  if (value.repeat !== undefined) checkRepeat(value.repeat)

  checkCadence(value.cadence)

  if (
    value.occurrence !== undefined &&
    (!Number.isInteger(value.occurrence) || value.occurrence < 1)
  )
    throw refusal('INVALID', 'Occurrence must be a positive whole number')
}

/** Deletes a task with its subtasks and returns how many tasks went. */
async function deleteTaskWithSubtasks(ctx: MutationCtx, task: Doc<'tasks'>) {
  const subtasks = await ctx.db
    .query('tasks')
    .withIndex('by_user_parent', (q) => q.eq('userId', task.userId).eq('parentId', task.clientId))
    .take(CASCADE_LIMIT)

  await Promise.all(subtasks.map((subtask) => ctx.db.delete(subtask._id)))
  await ctx.db.delete(task._id)

  return subtasks.length + 1
}

/**
 * The relationships a batch may only break midway: once every write has landed, a task's list
 * exists, a time needs a date, and a subtask's parent is a top-level task in the same list.
 */
async function checkTask(ctx: MutationCtx, userId: Id<'users'>, clientId: string) {
  const task = await findTask(ctx, userId, clientId)

  if (!task) return

  if (task.listId !== null && !(await findList(ctx, userId, task.listId)))
    throw refusal('INVALID', 'The list is gone')

  if (task.dueTime !== null && task.dueDate === null)
    throw refusal('INVALID', 'A time needs a date')

  if (task.parentId === null) return
  const parent = await findTask(ctx, userId, task.parentId)

  if (!parent || parent.parentId !== null || parent.listId !== task.listId)
    throw refusal('INVALID', 'A subtask belongs under a task in the same list')
}

/** Applies one write and returns how it changed the account's task count. */
async function applyOperation(
  ctx: MutationCtx,
  userId: Id<'users'>,
  operation: Operation,
  now: number,
): Promise<number> {
  if (operation.table === 'lists') {
    const existing = await findList(ctx, userId, operation.clientId)

    if (operation.type === 'delete') {
      if (!existing) return 0

      const tasks = await ctx.db
        .query('tasks')
        .withIndex('by_user_list', (q) => q.eq('userId', userId).eq('listId', operation.clientId))
        .take(CASCADE_LIMIT)

      await Promise.all(tasks.map((task) => ctx.db.delete(task._id)))
      await ctx.db.delete(existing._id)

      return -tasks.length
    }

    checkListValue(operation.value)

    if (existing) {
      // An update of a list deleted elsewhere lands nowhere; it never brings the list back.
      await ctx.db.patch(existing._id, { ...operation.value, updatedAt: now })
    } else if (operation.type === 'insert') {
      await ctx.db.insert('lists', {
        ...operation.value,
        userId,
        clientId: operation.clientId,
        updatedAt: now,
      })
      await checkListLimit(ctx, userId)
    }

    return 0
  }

  const existing = await findTask(ctx, userId, operation.clientId)

  if (operation.type === 'delete')
    return existing ? -(await deleteTaskWithSubtasks(ctx, existing)) : 0

  checkTaskValue(operation.value)

  if (existing) {
    await ctx.db.patch(existing._id, { ...operation.value, updatedAt: now })

    return 0
  }

  if (operation.type !== 'insert') return 0

  await ctx.db.insert('tasks', {
    ...operation.value,
    userId,
    clientId: operation.clientId,
    updatedAt: now,
  })

  return 1
}

/** Lists are few, so they are counted whenever one is added. */
async function checkListLimit(ctx: MutationCtx, userId: Id<'users'>) {
  const lists = await ctx.db
    .query('lists')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .take(MAX_LISTS + 1)

  if (lists.length > MAX_LISTS) throw refusal('TOO_MANY_ROWS')
}

/**
 * Applies one transaction from a phone's outbox, all of it or none. The phone sends it again
 * until it hears back, so a transaction already applied (its `idempotencyKey` has a receipt)
 * changes nothing the second time.
 */
export const apply = mutation({
  args: { idempotencyKey: v.string(), operations: v.array(operationValidator) },
  returns: v.null(),
  handler: async (ctx, { idempotencyKey, operations }) => {
    const user = await requireUser(ctx)

    if (operations.length > MAX_OPERATIONS) throw refusal('INVALID', 'Too many changes at once')

    const receipt = await ctx.db
      .query('receipts')
      .withIndex('by_user_key', (q) => q.eq('userId', user._id).eq('key', idempotencyKey))
      .unique()

    if (receipt) return null

    const now = Date.now()
    const touchedTasks = new Set<string>()
    let taskDelta = 0

    for (const operation of operations) {
      taskDelta += await applyOperation(ctx, user._id, operation, now)

      if (operation.table === 'tasks' && operation.type !== 'delete')
        touchedTasks.add(operation.clientId)
    }

    for (const clientId of touchedTasks) await checkTask(ctx, user._id, clientId)

    if (taskDelta !== 0) {
      const tasks = Math.max(0, user.tasks + taskDelta)

      if (taskDelta > 0 && tasks > MAX_TASKS) throw refusal('TOO_MANY_ROWS')
      await ctx.db.patch(user._id, { tasks })
    }

    await ctx.db.insert('receipts', { userId: user._id, key: idempotencyKey, appliedAt: now })

    return null
  },
})
