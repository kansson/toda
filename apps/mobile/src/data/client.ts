import { ConvexReactClient } from 'convex/react'

let current: { server: string; client: ConvexReactClient } | null = null

/**
 * One reactive Convex client per runtime, for the screens and the outbox alike. Another server
 * closes the previous one's client.
 */
export function convexClient(server: string) {
  if (current?.server !== server) {
    void current?.client.close()
    current = { server, client: new ConvexReactClient(server, { unsavedChangesWarning: false }) }
  }

  return current.client
}
