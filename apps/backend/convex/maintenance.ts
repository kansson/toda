import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { v } from './schema'

/**
 * Receipts are kept long past any outbox a phone could still replay: an outbox write waits at
 * most as long as the phone stays offline, and 90 days is far beyond that.
 */
const RECEIPT_TTL_MS = 90 * 24 * 60 * 60 * 1000

const BATCH = 500

/** Deletes old receipts and expired pairing codes, continuing while there are more. */
export const prune = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now()

    const receipts = await ctx.db
      .query('receipts')
      .withIndex('by_appliedAt', (q) => q.lt('appliedAt', now - RECEIPT_TTL_MS))
      .take(BATCH)

    const codes = await ctx.db
      .query('pairingCodes')
      .withIndex('by_expiresAt', (q) => q.lt('expiresAt', now))
      .take(BATCH)

    await Promise.all([...receipts, ...codes].map((row) => ctx.db.delete(row._id)))

    if (receipts.length === BATCH || codes.length === BATCH)
      await ctx.scheduler.runAfter(0, internal.maintenance.prune, {})

    return null
  },
})
