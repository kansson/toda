import { paginationOptsValidator, paginationResultValidator } from 'convex/server'
import type { Doc } from './_generated/dataModel'
import { query } from './_generated/server'
import { refusal } from './errors'
import { taskValidator, type Infer } from './schema'
import { requireUser } from './users'

/** The tasks one account may keep, open and completed together. */
export const MAX_TASKS = 10_000

/** The largest page the app asks for. */
const MAX_PAGE = 500

export function clientTask({
  _id: _,
  _creationTime: _created,
  userId: _user,
  ...task
}: Doc<'tasks'>): Infer<typeof taskValidator> {
  return task
}

/**
 * The caller's tasks, completed ones included, oldest first, a page at a time: the app mirrors
 * every page and filters and sorts on the phone. Each page is its own subscription, so a change
 * re-sends one page rather than every task. It throws while signed out, as an empty answer would
 * clear the phone's copy.
 */
export const page = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(taskValidator),
  handler: async (ctx, { paginationOpts }) => {
    const user = await requireUser(ctx)

    if (
      !Number.isInteger(paginationOpts.numItems) ||
      paginationOpts.numItems < 1 ||
      paginationOpts.numItems > MAX_PAGE
    )
      throw refusal('INVALID', 'Page size must be 1 to 500')

    const result = await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .paginate(paginationOpts)

    return { ...result, page: result.page.map(clientTask) }
  },
})
