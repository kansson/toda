import { typedV } from 'convex-helpers/validators'
import { defineSchema, defineTable } from 'convex/server'
// The schema is the one module that builds validators from `convex/values`; every function
// imports the schema-derived `v` below instead.
// oxlint-disable-next-line no-restricted-imports
import { v } from 'convex/values'

export type { Infer } from 'convex/values'

export { DEFAULT_LIST_ID } from './constants'

/** How a list orders its open tasks; each list remembers its own. */
export const sortValidator = v.union(
  v.literal('manual'),
  v.literal('date'),
  v.literal('deadline'),
  v.literal('starred'),
  v.literal('title'),
)

/** Days of the week, Monday first: 0 is Monday and 6 is Sunday. */
const weekdayValidator = v.number()

/**
 * A repeat schedule. `anchor` says what the next date counts from when a task is completed:
 * `due` keeps a fixed schedule, as Google Tasks does; `completion` counts the interval from the
 * day it was done, so finishing late moves every later date with it.
 */
export const repeatValidator = v.object({
  unit: v.union(v.literal('day'), v.literal('week'), v.literal('month'), v.literal('year')),
  interval: v.number(),
  /** Weekly repeats: the days it falls on; empty means the due date's own weekday. */
  weekdays: v.array(weekdayValidator),
  /** Monthly repeats: a day of the month (-1 for the last) or the nth weekday (-1 for the last). */
  monthly: v.union(
    v.null(),
    v.object({ kind: v.literal('day'), day: v.number() }),
    v.object({ kind: v.literal('weekday'), week: v.number(), weekday: weekdayValidator }),
  ),
  anchor: v.union(v.literal('due'), v.literal('completion')),
  end: v.union(
    v.object({ kind: v.literal('never') }),
    v.object({ kind: v.literal('on'), date: v.string() }),
    v.object({ kind: v.literal('after'), count: v.number() }),
  ),
})

/** What a client may set on a list; `clientId` is its identity on every device. */
export const listFields = {
  title: v.string(),
  position: v.number(),
  sort: sortValidator,
  createdAt: v.number(),
}

/**
 * What a client may set on a task. Dates are calendar dates (`YYYY-MM-DD`) and times of day
 * (`HH:MM`) in the phone's own time zone, so a task due on Friday stays due on Friday wherever
 * the phone travels. References name the other row's `clientId`, which exists before the row
 * reaches the server.
 */
export const taskFields = {
  /** The list it is in, or null for a task in no list. */
  listId: v.union(v.string(), v.null()),
  parentId: v.union(v.string(), v.null()),
  title: v.string(),
  notes: v.string(),
  position: v.number(),
  dueDate: v.union(v.string(), v.null()),
  dueTime: v.union(v.string(), v.null()),
  deadline: v.union(v.string(), v.null()),
  starredAt: v.union(v.number(), v.null()),
  completedAt: v.union(v.number(), v.null()),
  repeat: v.union(repeatValidator, v.null()),
  /** The first task of a repeating series; every later occurrence carries it. */
  seriesId: v.union(v.string(), v.null()),
  /** Which occurrence of its series this is, from 1. */
  occurrence: v.number(),
  createdAt: v.number(),
}

export const listValidator = v.object({
  clientId: v.string(),
  ...listFields,
  updatedAt: v.number(),
})

export const taskValidator = v.object({
  clientId: v.string(),
  ...taskFields,
  updatedAt: v.number(),
})

/**
 * One write from a phone's outbox. Inserts are upserts by `clientId`, so a replayed or doubled
 * insert lands once; updates carry only the fields that changed.
 */
export const operationValidator = v.union(
  v.object({
    table: v.literal('lists'),
    type: v.literal('insert'),
    clientId: v.string(),
    value: v.object(listFields),
  }),
  v.object({
    table: v.literal('lists'),
    type: v.literal('update'),
    clientId: v.string(),
    value: v.object(listFields).partial(),
  }),
  v.object({ table: v.literal('lists'), type: v.literal('delete'), clientId: v.string() }),
  v.object({
    table: v.literal('tasks'),
    type: v.literal('insert'),
    clientId: v.string(),
    value: v.object(taskFields),
  }),
  v.object({
    table: v.literal('tasks'),
    type: v.literal('update'),
    clientId: v.string(),
    value: v.object(taskFields).partial(),
  }),
  v.object({ table: v.literal('tasks'), type: v.literal('delete'), clientId: v.string() }),
)

const schema = defineSchema({
  users: defineTable({
    createdAt: v.number(),
    /** How many device credentials open this account; the last one to leave deletes it. */
    devices: v.number(),
    /** Tasks the account keeps, kept by every write so the limit needs no count. */
    tasks: v.number(),
  }),
  lists: defineTable({ userId: v.id('users'), ...listValidator.fields })
    .index('by_user', ['userId'])
    .index('by_user_client', ['userId', 'clientId']),
  tasks: defineTable({ userId: v.id('users'), ...taskValidator.fields })
    .index('by_user', ['userId'])
    .index('by_user_client', ['userId', 'clientId'])
    .index('by_user_list', ['userId', 'listId'])
    .index('by_user_parent', ['userId', 'parentId']),
  /** Outbox transactions already applied, so a replay after a lost answer changes nothing. */
  receipts: defineTable({ userId: v.id('users'), key: v.string(), appliedAt: v.number() })
    .index('by_user_key', ['userId', 'key'])
    .index('by_appliedAt', ['appliedAt']),
  /** Short-lived codes that let another phone join this account. */
  pairingCodes: defineTable({ userId: v.id('users'), codeHash: v.string(), expiresAt: v.number() })
    .index('by_codeHash', ['codeHash'])
    .index('by_user', ['userId'])
    .index('by_expiresAt', ['expiresAt']),
})

const vv = typedV(schema)

export { vv as v }

export default schema
