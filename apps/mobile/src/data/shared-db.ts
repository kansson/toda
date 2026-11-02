import { convexClient } from './client'
import { createDb, type Db, deleteLocalData } from './db'
import { getServer, saveServer, setSwitching } from './server'

let opening: Promise<Db> | null = null

/**
 * The one open copy of the account's data in this JavaScript runtime, shared by the screens and
 * by work the app does without them, such as a reminder's Done button while the app is closed:
 * two copies would replay the same outbox twice.
 */
export function openDb() {
  opening ??= (async () => {
    const { server } = getServer()

    if (!server) throw new Error('No server is set')

    return createDb(convexClient(server))
  })().catch((error: Error) => {
    opening = null
    throw error
  })

  return opening
}

/** Closes the copy and deletes it with its outbox, for an account or server change. */
export async function resetDb() {
  const previous = opening

  opening = null

  if (previous) await (await previous.catch(() => null))?.close()
  await deleteLocalData()
}

/**
 * Moves the phone to another server. The screens close first, then the copy of the old server's
 * data goes with its outbox, which belongs to the old account; the app opens again on the new
 * server, and the device credential signs in there. If deleting fails, the phone stays where it
 * was.
 */
export async function switchServer(server: string) {
  setSwitching(true)

  try {
    // The screens' live queries go first: a collection cleaned up under one throws.
    await new Promise((resolve) => setTimeout(resolve, 0))
    await resetDb()
    saveServer(server)
  } finally {
    setSwitching(false)
  }
}
