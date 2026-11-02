import { refusal } from './errors'

const DEVICE_SECRET = /^[0-9a-f]{64}$/u

/** Pairing codes avoid letters and digits that read alike (0/O, 1/I/L). */
export const PAIRING_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export const PAIRING_CODE_LENGTH = 8

export async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * The account identity of a device credential: its hash, so the database never holds a
 * credential that could sign in.
 */
export async function deviceAccountId(secret: string) {
  if (!DEVICE_SECRET.test(secret)) throw refusal('INVALID', 'Invalid device credential')

  return await sha256Hex(`device:${secret}`)
}

/** A code as typed: spaces and dashes dropped, case ignored. */
export function normalizePairingCode(code: string) {
  return code.replaceAll(/[\s-]/gu, '').toUpperCase()
}

export function randomPairingCode() {
  const bytes = new Uint8Array(PAIRING_CODE_LENGTH)
  crypto.getRandomValues(bytes)

  // 31 symbols: the small modulo bias leaves about 39 bits per code, ample for ten minutes.
  return Array.from(bytes, (byte) => PAIRING_ALPHABET[byte % PAIRING_ALPHABET.length]).join('')
}
