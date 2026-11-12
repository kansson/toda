import type {
  cadenceValidator,
  conditionValidator,
  Infer,
  listValidator,
  operationValidator,
  repeatValidator,
  sortValidator,
  taskValidator,
} from '../convex/schema.ts'

// Values only from the dependency-free constants, so the app bundles none of the server code.
export { DEFAULT_LIST_ID, NOTES_MAX, TITLE_MAX } from '../convex/constants.ts'

/** A list as the app mirrors it. */
export type ListRow = Infer<typeof listValidator>

/** A task as the app mirrors it. */
export type TaskRow = Infer<typeof taskValidator>

export type Repeat = Infer<typeof repeatValidator>

/** How often a subtask of a repeating task comes round. */
export type Cadence = Infer<typeof cadenceValidator>

/** A condition on the dates a repeat falls on. */
export type Condition = Infer<typeof conditionValidator>

export type ListSort = Infer<typeof sortValidator>

/** One write in an outbox transaction, as `sync.apply` takes it. */
export type Operation = Infer<typeof operationValidator>

export type { ErrorCode } from '../convex/errors.ts'
