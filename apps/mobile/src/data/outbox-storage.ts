import type { StorageAdapter } from '@tanstack/offline-transactions/react-native'
import { SQLiteStorage } from 'expo-sqlite/kv-store'

/**
 * The outbox of writes not yet confirmed, in its own SQLite key-value file, so they outlive the
 * app being closed, the phone restarting and days offline.
 */
export class OutboxStorage implements StorageAdapter {
  private readonly store: SQLiteStorage

  constructor(databaseName: string) {
    this.store = new SQLiteStorage(databaseName)
  }

  get(key: string) {
    return this.store.getItemAsync(key)
  }

  set(key: string, value: string) {
    return this.store.setItemAsync(key, value)
  }

  async delete(key: string) {
    await this.store.removeItemAsync(key)
  }

  keys() {
    return this.store.getAllKeysAsync()
  }

  async clear() {
    await this.store.clearAsync()
  }
}
