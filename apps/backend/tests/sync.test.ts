import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api, internal } from '../convex/_generated/api'
import type { Id } from '../convex/_generated/dataModel'
import schema, {
  type conditionValidator,
  DEFAULT_LIST_ID,
  type Infer,
  type taskValidator,
} from '../convex/schema'

const modules = {
  './_generated/api.ts': () => import('../convex/_generated/api'),
  './_generated/server.ts': () => import('../convex/_generated/server'),
  './account.ts': () => import('../convex/account'),
  './lists.ts': () => import('../convex/lists'),
  './maintenance.ts': () => import('../convex/maintenance'),
  './sync.ts': () => import('../convex/sync'),
  './tasks.ts': () => import('../convex/tasks'),
  './users.ts': () => import('../convex/users'),
}

const device = (userId?: Id<'users'>) => ({
  provider: {
    name: 'device' as const,
    accountId: 'account',
    profile: userId ? { userId } : { defaultListTitle: 'Att göra' },
  },
})

async function signedIn() {
  const t = convexTest(schema, modules)
  const userId = await t.mutation(internal.users.createDevice, device())

  return { t, userId, as: t.withIdentity({ subject: userId }) }
}

type Condition = Infer<typeof conditionValidator>

type TaskValue = Omit<Infer<typeof taskValidator>, 'clientId' | 'updatedAt'>

/** A daily repeat counted from completion, with the conditions given, or with none. */
function daily(conditions?: Condition[]) {
  const repeat: NonNullable<TaskValue['repeat']> = {
    unit: 'day',
    interval: 1,
    weekdays: [],
    monthly: null,
    anchor: 'completion',
    end: { kind: 'never' },
  }

  if (conditions !== undefined) repeat.conditions = conditions

  return repeat
}

const task = (clientId: string, value: Partial<TaskValue> = {}) => ({
  table: 'tasks' as const,
  type: 'insert' as const,
  clientId,
  value: {
    listId: DEFAULT_LIST_ID,
    parentId: null,
    title: clientId,
    notes: '',
    position: 1,
    dueDate: null,
    dueTime: null,
    deadline: null,
    starredAt: null,
    completedAt: null,
    repeat: null,
    seriesId: null,
    occurrence: 1,
    createdAt: 1,
    ...value,
  },
})

async function allTasks(as: Awaited<ReturnType<typeof signedIn>>['as']) {
  const result = await as.query(api.tasks.page, { paginationOpts: { numItems: 100, cursor: null } })

  return result.page
}

describe('accounts', () => {
  it('starts a new account with its default list, named in the phone’s language', async () => {
    const { as } = await signedIn()

    expect(await as.query(api.lists.mine, {})).toMatchObject([
      { clientId: DEFAULT_LIST_ID, title: 'Att göra', sort: 'manual' },
    ])
  })

  it('refuses to read while signed out rather than answering with nothing', async () => {
    const t = convexTest(schema, modules)

    await expect(t.query(api.lists.mine, {})).rejects.toThrow()
  })
})

describe('sync.apply', () => {
  it('applies a transaction once, however often it is sent', async () => {
    const { as } = await signedIn()
    const args = { idempotencyKey: 'k1', operations: [task('a')] }

    await as.mutation(api.sync.apply, args)
    await as.mutation(api.sync.apply, {
      idempotencyKey: 'k2',
      operations: [{ table: 'tasks', type: 'update', clientId: 'a', value: { title: 'renamed' } }],
    })
    // The first transaction again, after its answer was lost: it must not undo the rename.
    await as.mutation(api.sync.apply, args)

    expect(await allTasks(as)).toMatchObject([{ clientId: 'a', title: 'renamed' }])
  })

  it('treats a doubled insert as one row and never resurrects a deleted one', async () => {
    const { as } = await signedIn()

    await as.mutation(api.sync.apply, { idempotencyKey: '1', operations: [task('a'), task('a')] })
    await as.mutation(api.sync.apply, {
      idempotencyKey: '2',
      operations: [
        { table: 'tasks', type: 'delete', clientId: 'a' },
        { table: 'tasks', type: 'update', clientId: 'a', value: { title: 'late edit' } },
      ],
    })

    expect(await allTasks(as)).toEqual([])
  })

  it('deletes subtasks with their task and tasks with their list', async () => {
    const { as } = await signedIn()

    await as.mutation(api.sync.apply, {
      idempotencyKey: '1',
      operations: [
        {
          table: 'lists',
          type: 'insert',
          clientId: 'home',
          value: { title: 'Home', position: 1, sort: 'manual', createdAt: 1 },
        },
        task('parent'),
        task('child', { parentId: 'parent' }),
        task('chore', { listId: 'home' }),
      ],
    })

    await as.mutation(api.sync.apply, {
      idempotencyKey: '2',
      operations: [
        { table: 'tasks', type: 'delete', clientId: 'parent' },
        { table: 'lists', type: 'delete', clientId: 'home' },
      ],
    })

    expect(await allTasks(as)).toEqual([])
    expect((await as.query(api.lists.mine, {})).map((list) => list.clientId)).toEqual([
      DEFAULT_LIST_ID,
    ])
  })

  it('lets a batch break relationships midway, as when a task moves with its subtasks', async () => {
    const { as } = await signedIn()

    await as.mutation(api.sync.apply, {
      idempotencyKey: '1',
      operations: [
        {
          table: 'lists',
          type: 'insert',
          clientId: 'work',
          value: { title: 'Work', position: 1, sort: 'manual', createdAt: 1 },
        },
        task('parent'),
        task('child', { parentId: 'parent' }),
      ],
    })

    await as.mutation(api.sync.apply, {
      idempotencyKey: '2',
      operations: [
        { table: 'tasks', type: 'update', clientId: 'child', value: { listId: 'work' } },
        { table: 'tasks', type: 'update', clientId: 'parent', value: { listId: 'work' } },
      ],
    })

    expect((await allTasks(as)).map((row) => row.listId)).toEqual(['work', 'work'])
  })

  it.each([
    [
      'a subtask of a subtask',
      [task('a'), task('b', { parentId: 'a' }), task('c', { parentId: 'b' })],
    ],
    ['a task in a missing list', [task('a', { listId: 'nowhere' })]],
    ['a date that does not exist', [task('a', { dueDate: '2026-02-30' })]],
    ['a time without a date', [task('a', { dueTime: '09:00' })]],
    ['a title over 1023 characters', [task('a', { title: 'x'.repeat(1024) })]],
    [
      'a repeat every zero days',
      [
        task('a', {
          dueDate: '2026-11-01',
          repeat: {
            unit: 'day',
            interval: 0,
            weekdays: [],
            monthly: null,
            anchor: 'completion',
            end: { kind: 'never' },
          },
        }),
      ],
    ],
    [
      'a subtask that comes round every zero times',
      [task('a'), task('b', { parentId: 'a', cadence: { kind: 'every', count: 0, from: 1 } })],
    ],
    [
      'a subtask schedule meant for a day that does not exist',
      [
        task('a'),
        task('b', {
          parentId: 'a',
          cadence: {
            kind: 'schedule',
            unit: 'month',
            interval: 1,
            from: '2026-11-01',
            next: '2026-11-31',
            lean: 'closest',
            leeway: 0,
          },
        }),
      ],
    ],
    [
      'a repeat condition on no weekdays',
      [
        task('a', {
          dueDate: '2026-11-01',
          repeat: daily([{ kind: 'weekdays', weekdays: [], except: true }]),
        }),
      ],
    ],
    [
      'a repeat condition in a thirteenth month',
      [
        task('a', {
          dueDate: '2026-11-01',
          repeat: daily([{ kind: 'months', months: [13], except: false }]),
        }),
      ],
    ],
    [
      'a repeat condition whose days end before they start',
      [
        task('a', {
          dueDate: '2026-11-01',
          repeat: daily([{ kind: 'dates', from: '2026-12-27', to: '2026-12-20', except: true }]),
        }),
      ],
    ],
  ])('refuses %s, writing nothing', async (_, operations) => {
    const { as } = await signedIn()

    await expect(
      as.mutation(api.sync.apply, { idempotencyKey: 'bad', operations }),
    ).rejects.toThrow()
    expect(await allTasks(as)).toEqual([])
  })

  it('keeps a repeat’s conditions and how a task is done, and takes rows without them', async () => {
    const { as } = await signedIn()

    const repeat = daily([
      { kind: 'weekdays', weekdays: [6], except: true },
      { kind: 'months', months: [4, 5, 6, 7, 8, 9], except: false },
      { kind: 'dates', from: '2026-12-20', to: '2026-12-27', except: true },
      { kind: 'task', seriesId: 'gym', except: true },
    ])

    await as.mutation(api.sync.apply, {
      idempotencyKey: '1',
      operations: [
        task('a', { dueDate: '2026-11-01', repeat, completion: 'subtasks' }),
        task('b', { dueDate: '2026-11-01', repeat: daily() }),
      ],
    })

    const [a, b] = await allTasks(as)

    expect(a).toMatchObject({ repeat, completion: 'subtasks' })
    expect(b?.repeat).not.toHaveProperty('conditions')
    expect(b).not.toHaveProperty('completion')
  })

  it('keeps a subtask’s cadence, clears it with null and takes rows without one', async () => {
    const { as } = await signedIn()

    const cadence = {
      kind: 'schedule' as const,
      unit: 'month' as const,
      interval: 1,
      from: '2026-12-01',
      next: '2026-12-01',
      lean: 'before' as const,
      leeway: 2,
      anchor: 'completion' as const,
    }

    await as.mutation(api.sync.apply, {
      idempotencyKey: '1',
      operations: [task('a'), task('b', { parentId: 'a', cadence })],
    })

    expect(await allTasks(as)).toMatchObject([{ clientId: 'a' }, { clientId: 'b', cadence }])
    expect((await allTasks(as))[0]).not.toHaveProperty('cadence')

    await as.mutation(api.sync.apply, {
      idempotencyKey: '2',
      operations: [{ table: 'tasks', type: 'update', clientId: 'b', value: { cadence: null } }],
    })

    expect((await allTasks(as))[1]?.cadence).toBeNull()
  })

  it('deletes any list, the first one too, with its tasks', async () => {
    const { as } = await signedIn()

    await as.mutation(api.sync.apply, { idempotencyKey: '1', operations: [task('a')] })
    await as.mutation(api.sync.apply, {
      idempotencyKey: '2',
      operations: [{ table: 'lists', type: 'delete', clientId: DEFAULT_LIST_ID }],
    })

    expect(await allTasks(as)).toEqual([])
  })

  it('keeps a task in no list', async () => {
    const { as } = await signedIn()

    await as.mutation(api.sync.apply, {
      idempotencyKey: '1',
      operations: [
        task('loose', { listId: null }),
        task('sub', { listId: null, parentId: 'loose' }),
      ],
    })

    expect((await allTasks(as)).map((row) => [row.clientId, row.listId])).toEqual([
      ['loose', null],
      ['sub', null],
    ])
  })

  it('keeps each account’s rows to itself, even under the same client id', async () => {
    const first = await signedIn()
    const secondId = await first.t.mutation(internal.users.createDevice, device())
    const second = first.t.withIdentity({ subject: secondId })

    await first.as.mutation(api.sync.apply, { idempotencyKey: '1', operations: [task('same')] })
    await second.mutation(api.sync.apply, {
      idempotencyKey: '1',
      operations: [task('same', { title: 'theirs' })],
    })

    expect(await allTasks(first.as)).toMatchObject([{ title: 'same' }])
    expect(await allTasks(second)).toMatchObject([{ title: 'theirs' }])
  })

  it('counts tasks as they come and go', async () => {
    const { t, as, userId } = await signedIn()

    await as.mutation(api.sync.apply, {
      idempotencyKey: '1',
      operations: [task('a'), task('b', { parentId: 'a' }), task('c')],
    })
    await as.mutation(api.sync.apply, {
      idempotencyKey: '2',
      operations: [{ table: 'tasks', type: 'delete', clientId: 'a' }],
    })

    expect((await t.run((ctx) => ctx.db.get(userId)))?.tasks).toBe(1)
  })
})

describe('pairing', () => {
  it('joins a phone to the account once, and deletes the account it leaves', async () => {
    const { t, as, userId } = await signedIn()
    const otherId = await t.mutation(internal.users.createDevice, device())
    const { code } = await as.mutation(api.account.createPairingCode, {})
    const { sha256Hex } = await import('../convex/crypto')
    const codeHash = await sha256Hex(`pairing:${code}`)

    expect(
      await t.mutation(internal.account.consumePairingCode, { codeHash, previous: otherId }),
    ).toBe(userId)
    await expect(
      t.mutation(internal.account.consumePairingCode, { codeHash, previous: null }),
    ).rejects.toThrow()

    // createDevice runs for the joining credential and counts it.
    await t.mutation(internal.users.createDevice, device(userId))
    await t.finishAllScheduledFunctions(() => {})

    expect(await t.run((ctx) => ctx.db.get(userId))).toMatchObject({ devices: 2 })
    expect(await t.run((ctx) => ctx.db.get(otherId))).toBeNull()
    expect(await t.run((ctx) => ctx.db.query('lists').collect())).toHaveLength(1)
  })

  it('deletes everything in an account on request', async () => {
    const { t, as, userId } = await signedIn()

    await as.mutation(api.sync.apply, { idempotencyKey: '1', operations: [task('a')] })
    await as.mutation(api.account.deleteAccount, {})
    await t.finishAllScheduledFunctions(() => {})

    expect(await t.run((ctx) => ctx.db.get(userId))).toBeNull()
    expect(await t.run((ctx) => ctx.db.query('tasks').collect())).toEqual([])
    await expect(as.query(api.lists.mine, {})).rejects.toThrow()
  })
})
