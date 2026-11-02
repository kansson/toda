import NetInfo from '@react-native-community/netinfo'
import type { OnlineDetector } from '@tanstack/offline-transactions/react-native'
import type { ConvexReactClient } from 'convex/react'
import { AppState } from 'react-native'

/**
 * Online means the Convex connection is up, which is what replaying the outbox needs. Any sign
 * that it may be back (the connection, the network, the app returning to the foreground) wakes
 * the outbox, which tries again at once instead of after its backoff.
 */
export function convexOnlineDetector(client: ConvexReactClient): OnlineDetector {
  const listeners = new Set<() => void>()

  const notify = () => {
    for (const listener of listeners) listener()
  }

  let connected = client.connectionState().isWebSocketConnected

  const stopConvex = client.subscribeToConnectionState((state) => {
    if (state.isWebSocketConnected && !connected) notify()
    connected = state.isWebSocketConnected
  })

  const stopNetwork = NetInfo.addEventListener((state) => {
    if (state.isConnected) notify()
  })

  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') notify()
  })

  return {
    subscribe: (listener) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
    notifyOnline: notify,
    isOnline: () => client.connectionState().isWebSocketConnected,
    dispose: () => {
      stopConvex()
      stopNetwork()
      appState.remove()
      listeners.clear()
    },
  }
}
