import Constants from 'expo-constants'
import { z } from 'zod'

const extraSchema = z.object({
  defaultServer: z.url().optional(),
  appVariant: z.enum(['development', 'preview', 'production']),
})

const extra = extraSchema.parse(Constants.expoConfig?.extra)

/**
 * The server a development build starts on (`config/backend.ts`). Preview and production builds
 * have none: the phone asks for one, so no deployment is built into a published app.
 */
export const defaultServer = extra.defaultServer ?? null

export const appVariant = extra.appVariant
