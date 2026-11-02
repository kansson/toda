import { internal } from './_generated/api'
import { internalMutation, mutation, query } from './_generated/server'
import { randomPairingCode, sha256Hex } from './crypto'
import { refusal } from './errors'
import { v } from './schema'
import { releaseDevice, requireUser } from './users'

/** How long a pairing code works. */
export const PAIRING_TTL_MS = 10 * 60 * 1000

/** Rows deleted per transaction while purging an account; the rest continue in the next. */
const PURGE_BATCH = 500

/**
 * A code that lets another phone join this account, replacing any code made before. It works
 * once, for ten minutes.
 */
export const createPairingCode = mutation({
  args: {},
  returns: v.object({ code: v.string(), expiresAt: v.number() }),
  handler: async (ctx) => {
    const user = await requireUser(ctx)

    const earlier = await ctx.db
      .query('pairingCodes')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .take(10)

    await Promise.all(earlier.map((code) => ctx.db.delete(code._id)))

    const code = randomPairingCode()
    const expiresAt = Date.now() + PAIRING_TTL_MS

    await ctx.db.insert('pairingCodes', {
      userId: user._id,
      codeHash: await sha256Hex(`pairing:${code}`),
      expiresAt,
    })

    return { code, expiresAt }
  },
})

/**
 * Uses up a pairing code for a phone joining its account, and lets go of the account the phone
 * used before, which is deleted when no other phone opens it. Throws for a code that is unknown,
 * expired or the phone's own account's.
 */
export const consumePairingCode = internalMutation({
  args: { codeHash: v.string(), previous: v.union(v.id('users'), v.null()) },
  returns: v.id('users'),
  handler: async (ctx, { codeHash, previous }) => {
    const pairing = await ctx.db
      .query('pairingCodes')
      .withIndex('by_codeHash', (q) => q.eq('codeHash', codeHash))
      .unique()

    if (!pairing || pairing.expiresAt < Date.now() || pairing.userId === previous)
      throw refusal('PAIRING_CODE_INVALID')

    if (!(await ctx.db.get(pairing.userId))) throw refusal('PAIRING_CODE_INVALID')
    await ctx.db.delete(pairing._id)

    if (previous) await releaseDevice(ctx, previous)

    return pairing.userId
  },
})

/** The account as Settings shows it: how many phones share it. */
export const me = query({
  args: {},
  returns: v.object({ devices: v.number(), createdAt: v.number() }),
  handler: async (ctx) => {
    const user = await requireUser(ctx)

    return { devices: user.devices, createdAt: user.createdAt }
  },
})

/**
 * This phone leaves its account: the account's lists and tasks go with the last phone to leave.
 * The phone forgets its credential and starts over as a new account.
 */
export const leave = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    await releaseDevice(ctx, user._id)

    return null
  },
})

/** Deletes the account and everything in it now, for every phone that shares it. */
export const deleteAccount = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    await ctx.db.patch(user._id, { devices: 0 })
    await ctx.scheduler.runAfter(0, internal.account.purge, { userId: user._id })

    return null
  },
})

/**
 * Deletes an account's rows a batch at a time, then the account itself. Signed-in phones lose
 * access as soon as the account is gone.
 */
export const purge = internalMutation({
  args: { userId: v.id('users') },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const batches = [
      () =>
        ctx.db
          .query('tasks')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(PURGE_BATCH),
      () =>
        ctx.db
          .query('lists')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(PURGE_BATCH),
      () =>
        ctx.db
          .query('receipts')
          .withIndex('by_user_key', (q) => q.eq('userId', userId))
          .take(PURGE_BATCH),
      () =>
        ctx.db
          .query('pairingCodes')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(PURGE_BATCH),
    ]

    for (const batch of batches) {
      const rows = await batch()

      if (rows.length > 0) {
        await Promise.all(rows.map((row) => ctx.db.delete(row._id)))
        await ctx.scheduler.runAfter(0, internal.account.purge, { userId })

        return null
      }
    }

    if (await ctx.db.get(userId)) await ctx.db.delete(userId)

    return null
  },
})
