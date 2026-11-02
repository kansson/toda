import { NOTES_MAX, TITLE_MAX } from './model'

/**
 * A task from text shared by another app, as Google Tasks makes one: a subject becomes the title
 * and the text its details; text alone gives its first line as the title and the rest as details.
 */
export function sharedTask(text: string | null, subject: string | null = null) {
  const body = (text ?? '').replaceAll('\r\n', '\n').trim()
  const heading = (subject ?? '').trim()

  if (heading) return { title: heading.slice(0, TITLE_MAX), notes: body.slice(0, NOTES_MAX) }

  const [first = '', ...rest] = body.split('\n')

  return {
    title: first.trim().slice(0, TITLE_MAX),
    notes: rest.join('\n').trim().slice(0, NOTES_MAX),
  }
}
