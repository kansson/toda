import { query } from './_generated/server'
import { refusal } from './errors'
import { listValidator, v } from './schema'
import { requireUser } from './users'

/** Far more lists than anyone keeps; past it the app is told rather than shown a part. */
export const MAX_LISTS = 1000

/**
 * Every list of the caller, in full: the app mirrors this query. It throws while signed out, as
 * an empty answer would clear the copy kept on the phone.
 */
export const mine = query({
  args: {},
  returns: v.array(listValidator),
  handler: async (ctx) => {
    const user = await requireUser(ctx)

    const rows = await ctx.db
      .query('lists')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .take(MAX_LISTS + 1)

    if (rows.length > MAX_LISTS) throw refusal('TOO_MANY_ROWS')

    return rows.map(({ clientId, title, position, sort, createdAt, updatedAt }) => ({
      clientId,
      title,
      position,
      sort,
      createdAt,
      updatedAt,
    }))
  },
})
