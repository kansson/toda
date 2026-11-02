import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { api } from '@toda/backend/convex'
import { useConvexAuth } from 'convex/react'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { createActions, type Actions } from './actions'
import { convexClient } from './client'
import type { Db } from './db'
import { tokenStorage } from './device-credential'
import { DeviceSession } from './session'
import { openDb, resetDb } from './shared-db'

type DataContextValue = {
  db: Db
  actions: Actions
  /** Drops the phone's copy and outbox and starts again, after the account changed. */
  reset: () => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

type DbState =
  | { status: 'opening' }
  | { status: 'open'; db: Db }
  | { status: 'failed'; error: Error }

/**
 * Opens the account's data on the phone and keeps it in step with the session: a collection whose
 * first answer came before the session (and so was refused) loads again once the phone is signed
 * in.
 */
function DbProvider({
  children,
  fallback,
  onRefused,
}: {
  children: ReactNode
  fallback: (error: Error | null, retry: () => void) => ReactNode
  onRefused: () => void
}) {
  const { isAuthenticated } = useConvexAuth()
  const [generation, setGeneration] = useState(0)
  const [state, setState] = useState<DbState>({ status: 'opening' })

  useEffect(() => {
    let alive = true

    setState({ status: 'opening' })

    openDb().then(
      (db) => {
        if (alive) setState({ status: 'open', db })
      },
      (error: Error) => {
        if (alive) setState({ status: 'failed', error })
      },
    )

    return () => {
      alive = false
    }
  }, [generation])

  const db = state.status === 'open' ? state.db : null
  // Bumped when collections that failed recover, to mount the screens' queries afresh.
  const [epoch, setEpoch] = useState(0)

  // A collection whose first load was refused, as on the first launch before the phone has
  // signed in, loads again once there is a session. The screens' live queries gave up with it,
  // so they are mounted again over the reloaded collections.
  useEffect(() => {
    if (!db || !isAuthenticated) return

    const failed = [db.lists, db.tasks].filter(
      (collection) => collection.utils.getSyncError() !== undefined,
    )

    if (failed.length === 0) return

    void Promise.allSettled(failed.map((collection) => collection.reload())).then(() =>
      setEpoch((value) => value + 1),
    )
  }, [db, isAuthenticated])

  // The screens' live queries go first: a collection cleaned up under one throws.
  const reset = useCallback(async () => {
    setState({ status: 'opening' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    await resetDb()
    setGeneration((value) => value + 1)
  }, [])

  const value = useMemo(
    () => (db ? { db, actions: createActions(db, onRefused), reset } : null),
    [db, onRefused, reset],
  )

  if (!value)
    return fallback(state.status === 'failed' ? state.error : null, () =>
      setGeneration((count) => count + 1),
    )

  return (
    <DataContext.Provider key={epoch} value={value}>
      {children}
    </DataContext.Provider>
  )
}

/**
 * The account and its data on the phone's server: the session on the device credential, the
 * Convex client with its tokens in secure storage, and the lists and tasks on the phone.
 */
export function DataProvider({
  server,
  children,
  fallback,
  onRefused,
}: {
  server: string
  children: ReactNode
  fallback: (error: Error | null, retry: () => void) => ReactNode
  onRefused: () => void
}) {
  return (
    <ConvexAuthProvider
      client={convexClient(server)}
      api={{ refreshSession: api.auth.refreshSession, signOut: api.auth.signOut }}
      storage={tokenStorage}
      ambientSignIns={[]}
    >
      <DeviceSession />
      <DbProvider fallback={fallback} onRefused={onRefused}>
        {children}
      </DbProvider>
    </ConvexAuthProvider>
  )
}

export function useData() {
  const context = useContext(DataContext)

  if (!context) throw new Error('The app’s data is not open')

  return context
}

export function useActions() {
  return useData().actions
}
