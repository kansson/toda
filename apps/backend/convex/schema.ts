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

const unitValidator = v.union(
  v.literal('day'),
  v.literal('week'),
  v.literal('month'),
  v.literal('year'),
)

/**
 * A condition on the dates a repeat falls on. Each one either narrows them to the days it names
 * (`except: false`, "only") or leaves those days out (`except: true`); a date stays on the
 * schedule when every "only" condition holds and no "except" one does.
 *
 * - `weekdays`: days of the week.
 * - `months`: months of the year, 1 for January.
 * - `dates`: the days from `from` to `to`, both included, such as a holiday.
 * - `task`: the days another task is due, named by its series (its first occurrence's
 *   `clientId`, which every later occurrence carries as `seriesId`), so it keeps meaning the same
 *   task as it repeats. A series that no longer exists holds on no day.
 */
export const conditionValidator = v.union(
  v.object({
    kind: v.literal('weekdays'),
    weekdays: v.array(weekdayValidator),
    except: v.boolean(),
  }),
  v.object({ kind: v.literal('months'), months: v.array(v.number()), except: v.boolean() }),
  v.object({ kind: v.literal('dates'), from: v.string(), to: v.string(), except: v.boolean() }),
  v.object({ kind: v.literal('task'), seriesId: v.string(), except: v.boolean() }),
)

/**
 * A repeat schedule. `anchor` says what the next date counts from when a task is completed:
 * `due` keeps a fixed schedule, as Google Tasks does; `completion` counts the interval from the
 * day it was done, so finishing late moves every later date with it.
 */
export const repeatValidator = v.object({
  unit: unitValidator,
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
  /**
   * Days the schedule keeps to or leaves out (see `conditionValidator`). Optional, so rules
   * written before conditions existed stay valid.
   */
  conditions: v.optional(v.array(conditionValidator)),
})

/**
 * How often a subtask of a repeating task comes round; without one it comes every time. Its
 * task's occurrences carry it from one to the next, and a subtask that does not come round in an
 * occurrence rests there, hidden and left open when the task is done.
 *
 * - `every`: every `count`th occurrence of its task, counting from occurrence `from`.
 * - `schedule`: a schedule of its own, every `interval` units from `from`, that lands on one of
 *   its task's dates: `next` is the date it is next meant for. `lean` picks which of the task's
 *   dates around it takes it: the closest, the last on or before it (never late), or the first on
 *   or after it (never early); `leeway` lets a date that many days on the other side take it
 *   instead, where that is closer. `anchor` counts its dates as a repeat does: `due` (or none)
 *   keeps them fixed, `completion` counts each from the day it was last done.
 */
export const cadenceValidator = v.union(
  v.object({ kind: v.literal('every'), count: v.number(), from: v.number() }),
  v.object({
    kind: v.literal('schedule'),
    unit: unitValidator,
    interval: v.number(),
    from: v.string(),
    next: v.string(),
    lean: v.union(v.literal('closest'), v.literal('before'), v.literal('after')),
    leeway: v.number(),
    anchor: v.optional(v.union(v.literal('due'), v.literal('completion'))),
  }),
)

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
  /**
   * A subtask's own cadence within its task's repeat, or null for every time. Optional, so rows
   * written before it existed, and by app versions that know nothing of it, stay valid.
   */
  cadence: v.optional(v.union(cadenceValidator, v.null())),
  /**
   * How a task with subtasks is done: `self` (or none) when it is checked off itself; `subtasks`
   * when checking off the last of its subtasks due this time does it too. Optional, as `cadence`.
   */
  completion: v.optional(v.union(v.literal('self'), v.literal('subtasks'))),
  /**
   * Whether a repeating task's subtasks take turns, one each time in their order. Each carries
   * the `every` cadence that makes it so, kept in step as subtasks come and go; optional, as
   * `cadence`.
   */
  turns: v.optional(v.boolean()),
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
