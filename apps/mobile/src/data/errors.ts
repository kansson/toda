import type { ErrorCode } from '@toda/backend/model'
import { ConvexError } from 'convex/values'
import { z } from 'zod'

const refusalSchema = z.object({ code: z.string(), message: z.string() })

/** The code a server refusal carries, or null for anything else, such as a lost connection. */
export function refusalCode(error: Error): ErrorCode | null {
  if (!(error instanceof ConvexError)) return null
  const parsed = refusalSchema.safeParse(error.data)

  // SAFETY: the server only throws the codes `ErrorCode` lists (`convex/errors.ts`).
  return parsed.success ? (parsed.data.code as ErrorCode) : null
}
