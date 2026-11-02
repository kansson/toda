import { usePathname } from 'expo-router'
import { useLayoutEffect } from 'react'
import { setBackPreviewBlocked, setReactNativeBack } from '../../modules/ui'

let blockers = 0

/**
 * While `active`, a back swipe shows no preview of the stack screen below: for wherever a
 * `BackHandler` takes Back for itself, which a committed preview would skip by closing the screen.
 */
export function useBackPreviewBlocked(active: boolean) {
  useLayoutEffect(() => {
    if (!active) {
      return
    }

    blockers += 1
    setBackPreviewBlocked(true)

    return () => {
      blockers -= 1
      setBackPreviewBlocked(blockers > 0)
    }
  }, [active])
}

/**
 * On the tasks screen, the root, Android owns Back, so the system can animate back to the home
 * screen as it does in other apps. Anywhere else React Native keeps it, and a back swipe on a
 * pushed screen previews the one below.
 */
export function SystemBack() {
  const systemOwns = usePathname() === '/'

  useLayoutEffect(() => {
    let frame: number | null = null

    const apply = () => {
      // The activity may not be attached during the first frames.
      if (!setReactNativeBack(!systemOwns)) {
        frame = requestAnimationFrame(apply)
      }
    }

    apply()

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame)
      }

      setReactNativeBack(true)
    }
  }, [systemOwns])

  return null
}
