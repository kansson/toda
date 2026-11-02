import { getAuthUserId, setupConvexAuth } from '@convex-dev/auth/server'
import { components, internal } from './_generated/api'
import { deviceAccountId, normalizePairingCode, sha256Hex } from './crypto'
import { refusal } from './errors'
import { v, type Infer } from './schema'
import type { deviceProfileValidator } from './users'

const DAY_SECONDS = 24 * 60 * 60

// Devices have no password to fall back on. Long refresh tokens and hourly access tokens keep
// rotations rare, so a lost rotation response rarely strands a session.
const auth = setupConvexAuth({
  component: components.auth,
  accessTokenTtlSeconds: 60 * 60,
  refreshTokenTtlSeconds: 400 * DAY_SECONDS,
})

export const { signOut, refreshSession, isAuthenticated } = auth

// The annotation keeps the generated API types from depending on themselves. `bindProvider` is
// the auth package's API for custom sign-in methods, typed under the internal-types condition.
type DeviceProfile = Infer<typeof deviceProfileValidator>

const device: ReturnType<typeof auth.bindProvider<'device', DeviceProfile>> = auth.bindProvider({
  name: 'device',
  createUser: internal.users.createDevice,
})

const tokensValidator = v.object({
  status: v.literal('complete'),
  tokens: v.object({
    accessToken: v.string(),
    accessTokenExpiresAt: v.number(),
    refreshToken: v.string(),
    refreshTokenExpiresAt: v.number(),
    userId: v.string(),
  }),
})

/**
 * Signs a device in with its own random credential, kept in the phone's secure storage. The
 * same credential always returns to the same account; an unknown one starts a new account with
 * its default list. An account deleted meanwhile is refused with `ACCOUNT_GONE`, and the phone
 * starts over with a new credential.
 */
export const signInWithDevice = device.authMutation({
  args: { secret: v.string(), defaultListTitle: v.string() },
  returns: tokensValidator,
  handler: async (ctx, { secret, defaultListTitle }) => {
    const providerAccountId = await deviceAccountId(secret)
    const userId = await ctx.convexAuth.resolveUserId(providerAccountId)

    if (!userId) {
      const tokens = await ctx.convexAuth.completeSignUp({
        providerAccountId,
        profile: { defaultListTitle },
      })

      return { status: 'complete' as const, tokens }
    }

    if (!(await ctx.runQuery(internal.users.exists, { userId }))) throw refusal('ACCOUNT_GONE')

    const tokens = await ctx.convexAuth.completeSignIn({ providerAccountId, profile: {} })

    return { status: 'complete' as const, tokens }
  },
})

/**
 * Joins this device to the account that made the pairing code, with a new credential. The code
 * works once. The account the device used before loses it, and is deleted when no other device
 * opens it.
 */
export const signInWithPairingCode = device.authMutation({
  args: { code: v.string(), secret: v.string() },
  returns: tokensValidator,
  handler: async (ctx, { code, secret }) => {
    const providerAccountId = await deviceAccountId(secret)

    if (await ctx.convexAuth.resolveUserId(providerAccountId)) throw refusal('DEVICE_IN_USE')

    const previous = await getAuthUserId(ctx)

    const userId = await ctx.runMutation(internal.account.consumePairingCode, {
      codeHash: await sha256Hex(`pairing:${normalizePairingCode(code)}`),
      previous,
    })

    await ctx.convexAuth.signUpWithoutSession({ providerAccountId, profile: { userId } })

    const tokens = await ctx.convexAuth.completeSignIn({ providerAccountId, profile: {} })

    return { status: 'complete' as const, tokens }
  },
})
