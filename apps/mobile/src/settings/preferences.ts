import Storage from 'expo-sqlite/kv-store'
import { useSyncExternalStore } from 'react'
import { z } from 'zod'

/**
 * The phone's own choices, kept on the phone and never synced: they belong to the device, as the
 * theme and its reminders do.
 */
const preferencesSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).catch('system'),
  /** When the morning digest of the day's tasks comes, `HH:MM`, or null for none. */
  digestTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/u)
    .nullable()
    .catch('09:00'),
  /** Ask before completing a task with open subtasks. */
  confirmSubtasks: z.boolean().catch(true),
  updateChannel: z.enum(['stable', 'nightly']).catch('stable'),
  updatesCheckedAt: z.number().catch(0),
  /** The version code of an update put off, not offered again until asked for. */
  updateDeclined: z.number().catch(0),
  /** The lists whose tasks the main screen shows, by id; none shows every list. */
  scopes: z.array(z.string()).catch([]),
  /** The view tapped on over them, if any. */
  view: z.enum(['none', 'today', 'upcoming', 'starred', 'completed']).catch('none'),
  /** The sort unless exactly one list is shown, which keeps its own. */
  sort: z.enum(['manual', 'date', 'deadline', 'starred', 'title']).catch('manual'),
})

export type Preferences = z.infer<typeof preferencesSchema>

const KEY = 'toda.preferences'

/** The stored JSON; unreadable preferences fall back to the defaults rather than stop the app. */
const storedSchema = z
  .string()
  .transform((text) => {
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  })
  .pipe(z.looseObject({}).catch({}))

function read(): Preferences {
  return preferencesSchema.parse(storedSchema.parse(Storage.getItemSync(KEY) ?? '{}'))
}

let current = read()

const listeners = new Set<() => void>()

export function getPreferences() {
  return current
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
  current = { ...current, [key]: value }
  Storage.setItemSync(KEY, JSON.stringify(current))

  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function usePreferences() {
  return useSyncExternalStore(subscribe, getPreferences)
}
