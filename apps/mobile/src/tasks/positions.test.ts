import { describe, expect, it } from 'vitest'
import { between, placeInOrder, topPosition } from './positions'

describe('positions', () => {
  it('puts an item between its neighbours with one write', () => {
    const siblings = [
      { id: 'a', position: 0 },
      { id: 'b', position: 1 },
      { id: 'c', position: 2 },
    ]

    expect(placeInOrder(siblings, ['a', 'c', 'b'], 'c')).toEqual([{ id: 'c', position: 0.5 }])
    expect(placeInOrder(siblings, ['c', 'a', 'b'], 'c')).toEqual([{ id: 'c', position: -1 }])
    expect(placeInOrder(siblings, ['b', 'c', 'a'], 'a')).toEqual([{ id: 'a', position: 3 }])
  })

  it('ignores keys that are not siblings, such as headers and other parents’ subtasks', () => {
    const siblings = [
      { id: 'a', position: 0 },
      { id: 'b', position: 1 },
    ]

    expect(placeInOrder(siblings, ['header', 'b', 'x', 'a'], 'b')).toEqual([
      { id: 'b', position: -1 },
    ])
  })

  it('renumbers the run once neighbours are too close to tell apart', () => {
    const siblings = [
      { id: 'a', position: 0 },
      { id: 'b', position: 1e-9 },
      { id: 'c', position: 5 },
    ]

    expect(placeInOrder(siblings, ['a', 'c', 'b'], 'c')).toEqual([
      { id: 'c', position: 1 },
      { id: 'b', position: 2 },
    ])
  })

  it('places new items above everything', () => {
    expect(topPosition([{ id: 'a', position: 3 }])).toBe(2)
    expect(between(undefined, undefined)).toBe(0)
  })
})
