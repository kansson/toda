import { describe, expect, it } from 'vitest'
import { newTask } from '@/tasks/model'
import { defaultRepeat } from '@/tasks/recurrence'
import { toOperations } from './operations'

const task = newTask('t1', { listId: 'default', title: 'Water plants' }, 7)

describe('toOperations', () => {
  it('sends every field of an insert but the server-kept ones', () => {
    const [operation] = toOperations([
      { type: 'insert', collectionId: 'tasks', key: 't1', modified: task, changes: task },
    ])

    expect(operation).toMatchObject({ table: 'tasks', type: 'insert', clientId: 't1' })
    expect(operation?.type === 'insert' && Object.keys(operation.value)).not.toContain('updatedAt')
    expect(operation?.type === 'insert' && Object.keys(operation.value)).not.toContain('clientId')
  })

  it('sends only what changed, whole, including a value cleared to null', () => {
    const repeat = defaultRepeat('day', 3)
    const modified = { ...task, repeat, dueDate: null, updatedAt: 99 }

    expect(
      toOperations([
        {
          type: 'update',
          collectionId: 'tasks',
          key: 't1',
          modified,
          changes: { repeat: { interval: 3 }, dueDate: null, updatedAt: 99 },
        },
      ]),
    ).toEqual([
      { table: 'tasks', type: 'update', clientId: 't1', value: { dueDate: null, repeat } },
    ])
  })

  it('sends deletes by key and refuses unknown collections', () => {
    expect(
      toOperations([
        { type: 'delete', collectionId: 'lists', key: 'l', modified: {}, changes: {} },
      ]),
    ).toEqual([{ table: 'lists', type: 'delete', clientId: 'l' }])
    expect(() =>
      toOperations([{ type: 'delete', collectionId: 'x', key: 'l', modified: {}, changes: {} }]),
    ).toThrow()
  })
})
