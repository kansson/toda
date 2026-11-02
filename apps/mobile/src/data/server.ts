import Storage from 'expo-sqlite/kv-store'
import { useSyncExternalStore } from 'react'
import { z } from 'zod'
import { appVariant, defaultServer } from '@/lib/config'
import { request } from '@/lib/http'
import { parseServer } from './server-address'

/**
 * The Convex deployment this phone syncs with, kept on the phone: a published build carries none,
 * so whoever installs it brings their own. `switching` is set while the phone moves to another.
 */
export type ServerState = { server: string | null; switching: boolean }

const KEY = 'toda.server'

/** Plain `http` only in development, for a backend on the computer. */
export const allowHttp = appVariant === 'development'

function read() {
  const stored = Storage.getItemSync(KEY)

  return (stored === null ? null : parseServer(stored, true)) ?? defaultServer
}

let state: ServerState = { server: read(), switching: false }

const listeners = new Set<() => void>()

function update(next: Partial<ServerState>) {
  state = { ...state, ...next }

  for (const listener of listeners) listener()
}

export function getServer() {
  return state
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function useServer() {
  return useSyncExternalStore(subscribe, getServer)
}

/** Marks the move to another server as begun or ended; the app's data is closed meanwhile. */
export function setSwitching(switching: boolean) {
  update({ switching })
}

export function saveServer(server: string) {
  Storage.setItemSync(KEY, server)
  update({ server })
}

/** A Convex deployment answers `/version` with its build, a single word. */
const versionSchema = z
  .string()
  .trim()
  .regex(/^[\w.+-]{1,200}$/u)

/** Whether the address answers as a Convex deployment does; false when it can't be reached. */
export async function isConvexServer(server: string) {
  try {
    return await request(
      `${server}/version`,
      {},
      async (response) => response.ok && versionSchema.safeParse(await response.text()).success,
      10_000,
    )
  } catch {
    return false
  }
}
