import * as SecureStore from 'expo-secure-store'
import { isDeviceSecret, randomDeviceSecret } from './device-secret'

/**
 * Readable once the phone has been unlocked after boot, so a launch or refresh while the screen
 * is locked never looks like a missing session.
 */
export const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
}

// Never renamed: this credential is how the phone returns to its account.
const KEY = 'toda.deviceCredential'

export type DeviceCredential = {
  secret: string
  saved: boolean
}

let credential: Promise<DeviceCredential> | null = null

async function load(): Promise<DeviceCredential> {
  // A failed read throws rather than looking like a first launch, which would start a new account.
  const stored = await SecureStore.getItemAsync(KEY, secureStoreOptions)

  return stored && isDeviceSecret(stored)
    ? { secret: stored, saved: true }
    : { secret: randomDeviceSecret(), saved: false }
}

/** One credential per app run, so every retry reuses the same secret and the same account. */
export function deviceCredential() {
  credential ??= (async () => {
    try {
      return await load()
    } catch (error) {
      credential = null
      throw error
    }
  })()

  return credential
}

/** Saved before the server can create an account for it, so no account is left unreachable. */
export async function saveDeviceCredential(value: DeviceCredential) {
  if (value.saved) return
  await SecureStore.setItemAsync(KEY, value.secret, secureStoreOptions)
  value.saved = true
}

/** Replaces the credential, as when the phone joins another account with a pairing code. */
export async function replaceDeviceCredential(secret: string) {
  await SecureStore.setItemAsync(KEY, secret, secureStoreOptions)
  credential = Promise.resolve({ secret, saved: true })
}

/** Forgets the credential: the next sign-in starts a new account. */
export async function forgetDevice() {
  credential = null
  await SecureStore.deleteItemAsync(KEY, secureStoreOptions)
}

/** A fresh credential, not yet saved, for joining another account. */
export function newDeviceSecret() {
  return randomDeviceSecret()
}

/** Encrypted token storage for the auth client, without biometric prompts. */
export const tokenStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key, secureStoreOptions),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value, secureStoreOptions),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key, secureStoreOptions),
}
