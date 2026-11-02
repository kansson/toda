import { type NativeStackNavigationProp, useNavigation, useRouter } from 'expo-router'
import { useEffect } from 'react'

/** The routes a link's stand-in leaves on the stack, and the search params a page takes. */
type LinkedRoutes = {
  index: undefined
  new: Record<string, string>
  'task/[id]': Record<string, string>
}

/**
 * A link's stand-in page, such as `/add` or `/open/<id>` from a widget. Android delivers the link
 * as the app comes back and before its window has drawn; a page pushed then opens, but later
 * leaves without its exit transition. So the stand-in shows nothing for the two frames it takes
 * the window to draw, then drops whatever lay between the main screen and itself, such as the
 * page a widget opened before, and becomes the page linked to: Back returns to the tasks, and
 * opening the same link again never piles one page on another. The routes kept keep their keys,
 * so neither the main screen nor the stand-in is drawn afresh.
 */
export function useLinkStandIn(pathname: '/new' | '/task/[id]', params: Record<string, string>) {
  const router = useRouter()
  const navigation = useNavigation<NativeStackNavigationProp<LinkedRoutes>>()
  const key = JSON.stringify(params)

  useEffect(() => {
    let second = 0

    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        const state = navigation.getState()
        const main = state.routes.find((route) => route.name === 'index')
        const self = state.routes[state.routes.length - 1]

        if (main && self && state.routes.length > 2) {
          navigation.reset({ ...state, index: 1, routes: [main, self] })
        }

        router.replace({ pathname, params: JSON.parse(key) })
      })
    })

    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [navigation, router, pathname, key])
}
