import { getAuthUserId } from '@convex-dev/auth/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import { refusal } from './errors'
import { DEFAULT_LIST_ID, v } from './schema'

/** The caller's own account; a deleted account never comes back through an old token. */
export async function requireUser(ctx: QueryCtx) {
  const id = await getAuthUserId(ctx)
  const user = id ? await ctx.db.get(id) : null

  if (!user) throw refusal('UNAUTHENTICATED')

  return user
}

export const deviceProfileValidator = v.object({
  /** Set when the device joins an existing account with a pairing code. */
  userId: v.optional(v.id('users')),
  /** The default list's name in the phone's language, for a new account. */
  defaultListTitle: v.optional(v.string()),
})

/**
 * Creates the account for a device credential the server has not seen: a new account with its
 * default list, or the account a pairing code named, which gains a device.
 */
export const createDevice = internalMutation({
  args: {
    provider: v.object({
      name: v.literal('device'),
      accountId: v.string(),
      profile: deviceProfileValidator,
    }),
  },
  returns: v.id('users'),
  handler: async (ctx, { provider: { profile } }) => {
    if (profile.userId) {
      const user = await ctx.db.get(profile.userId)

      if (!user) throw refusal('ACCOUNT_GONE')
      await ctx.db.patch(user._id, { devices: user.devices + 1 })

      return user._id
    }

    const now = Date.now()
    const userId = await ctx.db.insert('users', { createdAt: now, devices: 1, tasks: 0 })
    const title = profile.defaultListTitle?.trim().slice(0, 1023) || 'My Tasks'

    await ctx.db.insert('lists', {
      userId,
      clientId: DEFAULT_LIST_ID,
      title,
      position: 0,
      sort: 'manual',
      createdAt: now,
      updatedAt: now,
    })

    return userId
  },
})

/** A device leaves its account; the last device to leave takes the account's data with it. */
export async function releaseDevice(ctx: MutationCtx, userId: Id<'users'>) {
  const user = await ctx.db.get(userId)

  if (!user) return

  if (user.devices > 1) {
    await ctx.db.patch(userId, { devices: user.devices - 1 })

    return
  }

  await ctx.scheduler.runAfter(0, internal.account.purge, { userId })
}

/** Whether a signed-in identity still has its account. */
export const exists = internalQuery({
  args: { userId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { userId }) => {
    const id = ctx.db.normalizeId('users', userId)

    return id !== null && (await ctx.db.get(id)) !== null
  },
})
