import * as ExpoCrypto from 'expo-crypto'

/**
 * TanStack DB names every transaction and outbox entry with `crypto.randomUUID`, which Hermes
 * lacks; Expo's crypto module fills it from the platform's secure random source. Imported first,
 * before anything that creates a collection.
 */
// SAFETY: the global object may lack `crypto` on Hermes, which this type allows for.
const target = globalThis as { crypto?: Partial<Crypto> }

target.crypto ??= {}

if (target.crypto.getRandomValues === undefined)
  // SAFETY: expo-crypto implements the Web Crypto signature for integer typed arrays.
  target.crypto.getRandomValues = ExpoCrypto.getRandomValues as Crypto['getRandomValues']

if (target.crypto.randomUUID === undefined)
  // SAFETY: expo-crypto returns a v4 UUID string, which is what the Web Crypto type promises.
  target.crypto.randomUUID = ExpoCrypto.randomUUID as Crypto['randomUUID']
