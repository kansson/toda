import { describe, expect, it } from 'vitest'
import { sharedTask } from './share'

describe('sharedTask', () => {
  it('takes the subject as the title and the text as details', () => {
    expect(sharedTask('https://example.com', 'An article')).toEqual({
      title: 'An article',
      notes: 'https://example.com',
    })
  })

  it('splits text alone at its first line', () => {
    expect(sharedTask('Buy paint\r\nwhite, 2 l\n\n')).toEqual({
      title: 'Buy paint',
      notes: 'white, 2 l',
    })
    expect(sharedTask(null)).toEqual({ title: '', notes: '' })
  })
})
