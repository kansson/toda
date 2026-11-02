import { useAuthActions, useAuthToken } from '@convex-dev/auth/react'
import { useLingui } from '@lingui/react/macro'
import { api } from '@toda/backend/convex'
import { useConvex, useConvexAuth } from 'convex/react'
import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { forgetDevice, deviceCredential, saveDeviceCredential } from './device-credential'
import { refusalCode } from './errors'

const wakers = new Set<() => void>()

/** Tries a failed sign-in again now rather than after its backoff, as Retry on a notice does. */
export function retrySignIn() {
  for (const wake of wakers) wake()
}

/**
 * Keeps the phone signed in to its account. With no session it signs in with the device
 * credential, which returns to the same account every time; only the first launch creates one,
 * with its default list named in the phone's language. An account deleted meanwhile is forgotten
 * and the phone starts a new one. Everything the app shows works without a session; writes wait
 * in the outbox until there is one.
 */
export function DeviceSession() {
  const { t } = useLingui()
  const { isLoading, isAuthenticated } = useConvexAuth()
  const token = useAuthToken()
  const { setSession } = useAuthActions()
  const convex = useConvex()

  const defaultListTitle = t({
    message: 'My Tasks',
    comment: 'Name of the list every account starts with',
  })

  const signIn = useCallback(async () => {
    const credential = await deviceCredential()
    await saveDeviceCredential(credential)

    try {
      const { tokens } = await convex.mutation(api.auth.signInWithDevice, {
        secret: credential.secret,
        defaultListTitle,
      })

      await setSession(tokens)
    } catch (error) {
      // The account was deleted from another phone: start over as a new account.
      if (error instanceof Error && refusalCode(error) === 'ACCOUNT_GONE') await forgetDevice()
      throw error
    }
  }, [convex, defaultListTitle, setSession])

  useRetried(!isLoading && !isAuthenticated && token === null ? signIn : null)

  return null
}

/** Runs the task until it succeeds, retrying quietly with backoff while in the foreground. */
function useRetried(task: (() => Promise<void>) | null) {
  // One request across effect restarts, including Strict Mode.
  const pending = useRef<Promise<void> | null>(null)

  useEffect(() => {
    if (!task) return

    let cancelled = false
    let done = false
    let delay = 2_000
    let timer: ReturnType<typeof setTimeout> | undefined

    const attempt = async () => {
      if (cancelled || done || AppState.currentState !== 'active') return
      clearTimeout(timer)
      const request = (pending.current ??= task())

      try {
        await request
        done = true
      } catch (error) {
        if (__DEV__) console.warn('[auth] sign-in failed', error)

        if (!cancelled) {
          timer = setTimeout(() => void attempt(), delay)
          delay = Math.min(delay * 2, 60_000)
        }
      } finally {
        if (pending.current === request) pending.current = null
      }
    }

    void attempt()
    const wake = () => void attempt()
    wakers.add(wake)

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void attempt()
    })

    return () => {
      cancelled = true
      clearTimeout(timer)
      wakers.delete(wake)
      subscription.remove()
    }
  }, [task])
}
