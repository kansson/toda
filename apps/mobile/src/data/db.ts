import { convexCollectionOptions, type ConvexCollectionUtils } from '@tanstack/convex-db-collection'
import { convexPaginatedCollectionOptions } from '@tanstack/convex-db-collection'
import { convexMutationCodec } from '@tanstack/convex-db-collection/offline'
import { createCollection } from '@tanstack/db'
import {
  createExpoSQLitePersistence,
  persistedCollectionOptions,
} from '@tanstack/expo-db-sqlite-persistence'
import {
  type LeaderElection,
  NonRetriableError,
  type OfflineConfig,
  startOfflineExecutor,
} from '@tanstack/offline-transactions/react-native'
import { api } from '@toda/backend/convex'
import type { ConvexReactClient } from 'convex/react'
import { deleteDatabaseAsync, openDatabaseAsync } from 'expo-sqlite'
import type { List, Task } from '@/tasks/model'
import { refusalCode } from './errors'
import { convexOnlineDetector } from './online'
import { toOperations } from './operations'
import { OutboxStorage } from './outbox-storage'

/** Never renamed: the synced copy of the account's lists and tasks. */
const CACHE_FILE = 'toda-cache.db'

/** Never renamed: the writes still to send. */
const OUTBOX_FILE = 'toda-outbox.db'

/**
 * Raised whenever the shape of a stored row changes; the copy on the phone is then dropped and
 * synced again. The outbox is unaffected.
 */
const SCHEMA_VERSION = 3

/** The phone's one JavaScript runtime always owns the outbox; there are no tabs to share it. */
const alwaysLeader: LeaderElection = {
  requestLeadership: async () => true,
  releaseLeadership: () => {},
  isLeader: () => true,
  onLeadershipChange: () => () => {},
}

/**
 * The account's data on the phone: TanStack DB collections mirroring the Convex queries, kept in
 * SQLite so the app opens offline with everything in it, and an outbox that sends every write as
 * one idempotent Convex transaction once the connection is back, in the order they were made.
 */
export async function createDb(client: ConvexReactClient) {
  const database = await openDatabaseAsync(CACHE_FILE)
  const persistence = createExpoSQLitePersistence({ database })

  const listsSource = convexCollectionOptions({
    id: 'lists',
    client,
    query: api.lists.mine,
    queryArgs: {},
    getKey: (list: List) => list.clientId,
  })

  // Shows what is stored at once, and the server's answer over it once it arrives.
  const initialRender = { strategy: 'network-first', networkTimeoutMs: 0 } as const

  const lists = createCollection(
    persistedCollectionOptions<List, string, never, ConvexCollectionUtils>({
      ...listsSource,
      persistence,
      schemaVersion: SCHEMA_VERSION,
      initialRender,
    }),
  )

  // A page per subscription, so a change re-sends its own page rather than every task.
  const tasksSource = convexPaginatedCollectionOptions({
    id: 'tasks',
    client,
    query: api.tasks.page,
    queryArgs: {},
    pageSize: 250,
    getKey: (task: Task) => task.clientId,
  })

  const tasks = createCollection(
    persistedCollectionOptions<Task, string, never, ConvexCollectionUtils>({
      ...tasksSource,
      persistence,
      schemaVersion: SCHEMA_VERSION,
      initialRender,
    }),
  )

  // Every offline action uses this one function: one transaction, one atomic Convex mutation.
  const applyOperations: OfflineConfig['mutationFns'][string] = async ({
    transaction,
    idempotencyKey,
  }) => {
    const operations = toOperations(
      transaction.mutations.map((mutation) => ({
        type: mutation.type,
        collectionId: mutation.collection.id,
        key: mutation.key,
        modified: mutation.modified,
        changes: mutation.changes,
      })),
    )

    try {
      await client.mutation(api.sync.apply, { idempotencyKey, operations })
    } catch (error) {
      // Until the session is back the write waits; any other refusal undoes it on the phone.
      if (error instanceof Error && refusalCode(error) === 'UNAUTHENTICATED') throw error

      throw new NonRetriableError(error instanceof Error ? error.message : String(error))
    }

    // The change stays drawn as pending until the subscriptions show it, so nothing flickers.
    await Promise.all([lists.utils.awaitSync(), tasks.utils.awaitSync()])
  }

  // Subscribed before the outbox replays, so a replay can wait for its own change to arrive.
  void lists.preload().catch(() => undefined)
  void tasks.preload().catch(() => undefined)

  const executor = startOfflineExecutor({
    collections: { lists, tasks },
    mutationFns: { applyOperations },
    storage: new OutboxStorage(OUTBOX_FILE),
    mutationCodec: convexMutationCodec,
    leaderElection: alwaysLeader,
    onlineDetector: convexOnlineDetector(client),
    shouldRetry: (error) => (refusalCode(error) === 'UNAUTHENTICATED' ? true : undefined),
    onStorageFailure: (failure) => {
      if (__DEV__) console.warn('[outbox] storage failure', failure)
    },
  })

  // Until it has loaded the outbox, a write would not be kept; nothing writes before this.
  await executor.waitForInit()

  return {
    lists,
    tasks,
    executor,
    /** Stops syncing and closes the files, as before switching accounts. */
    async close() {
      executor.dispose()
      await Promise.allSettled([lists.cleanup(), tasks.cleanup()])
      await database.closeAsync()
    },
  }
}

export type Db = Awaited<ReturnType<typeof createDb>>

/** Deletes the phone's copy and its unsent writes, after the account changed. */
export async function deleteLocalData() {
  await Promise.allSettled([deleteDatabaseAsync(CACHE_FILE), deleteDatabaseAsync(OUTBOX_FILE)])
}
