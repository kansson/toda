import { ConvexError } from 'convex/values'

/**
 * Codes the app acts on. `UNAUTHENTICATED` keeps an outbox write queued until the session is
 * back; every other refusal undoes the write on the phone.
 */
export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'ACCOUNT_GONE'
  | 'INVALID'
  | 'PAIRING_CODE_INVALID'
  | 'DEVICE_IN_USE'
  | 'TOO_MANY_ROWS'

export function refusal(code: ErrorCode, message: string = code) {
  return new ConvexError({ code, message })
}
