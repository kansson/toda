import { useAuthActions } from '@convex-dev/auth/react'
import { api } from '@toda/backend/convex'
import { useConvex, useConvexAuth, useQueries } from 'convex/react'
import { z } from 'zod'
import { forgetDevice, newDeviceSecret, replaceDeviceCredential } from './device-credential'
import { useData } from './provider'

/** The account as Settings shows it; anything else, such as a failure, reads as not known yet. */
const meSchema = z.object({ devices: z.number() }).optional().catch(undefined)

/**
 * The account on this phone and the ways to share or leave it. Joining with a pairing code moves
 * the phone to the other phone's account with a new credential, and replaces what this phone
 * kept; leaving or deleting starts a new, empty account.
 */
export function useAccount() {
  const convex = useConvex()
  const { isAuthenticated } = useConvexAuth()
  const { setSession, signOut } = useAuthActions()
  const { reset } = useData()

  // `useQueries` reports a failure instead of throwing it into the screen: the account can end
  // under it, as when this phone joins another one and its old account is deleted.
  const { me: answer } = useQueries(
    isAuthenticated ? { me: { query: api.account.me, args: {} } } : {},
  )

  const me = meSchema.parse(answer)

  return {
    signedIn: isAuthenticated,
    devices: me?.devices ?? null,

    /** A code for another phone to type, valid for ten minutes. */
    createPairingCode() {
      return convex.mutation(api.account.createPairingCode, {})
    },

    /** Joins the account that made the code; throws a refusal for a wrong or used code. */
    async join(code: string) {
      const secret = newDeviceSecret()
      const { tokens } = await convex.mutation(api.auth.signInWithPairingCode, { code, secret })

      await replaceDeviceCredential(secret)
      await setSession(tokens)
      await reset()
    },

    /** This phone leaves its account and starts afresh; the last phone takes the data with it. */
    async leave() {
      await convex.mutation(api.account.leave, {})
      await signOut()
      await forgetDevice()
      await reset()
    },

    /** Deletes the account and all its lists and tasks, on every phone. */
    async deleteAccount() {
      await convex.mutation(api.account.deleteAccount, {})
      await signOut()
      await forgetDevice()
      await reset()
    },
  }
}
