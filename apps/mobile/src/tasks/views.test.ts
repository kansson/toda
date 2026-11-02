import { describe, expect, it } from 'vitest'
import { momentOf } from './dates'
import { newTask, type Task } from './model'
import { browseView, listView, matchingTasks, starredView, todayView, upcomingView } from './views'

const today = '2026-11-03'

const now = momentOf(today, '12:00').getTime()

const task = (clientId: string, fields: Partial<Task> = {}) =>
  newTask(clientId, { listId: 'default', title: clientId, ...fields }, 1)

const ids = (rows: { task: Task }[]) => rows.map((row) => row.task.clientId)

describe('a list', () => {
  it('keeps its own order, each task followed by its subtasks, open ones first', () => {
    const view = listView(
      [
        task('b', { position: 2 }),
        task('a', { position: 1 }),
        task('a2', { parentId: 'a', position: 2 }),
        task('a1', { parentId: 'a', position: 1, completedAt: 5 }),
        task('a3', { parentId: 'a', position: 3 }),
      ],
      'manual',
      today,
      now,
    )

    expect(view.open).toHaveLength(1)
    expect(ids(view.open[0]!.rows)).toEqual(['a', 'a2', 'a3', 'a1', 'b'])
  })

  it('sections by date, as Past, Today, Tomorrow, Later and No date', () => {
    const view = listView(
      [
        task('none'),
        task('later', { dueDate: '2026-11-20' }),
        task('past', { dueDate: '2026-11-01' }),
        task('today', { dueDate: today, dueTime: '09:00' }),
        task('tomorrow', { dueDate: '2026-11-04' }),
      ],
      'date',
      today,
      now,
    )

    expect(view.open.map((section) => section.heading.kind)).toEqual([
      'past',
      'today',
      'tomorrow',
      'later',
      'noDate',
    ])
  })

  it('moves done tasks below, most recent first, with their subtasks', () => {
    const view = listView(
      [
        task('old', { completedAt: 1 }),
        task('new', { completedAt: 2 }),
        task('sub', { parentId: 'new', completedAt: 2 }),
      ],
      'manual',
      today,
      now,
    )

    expect(ids(view.completed)).toEqual(['new', 'sub', 'old'])
    expect(view.completedCount).toBe(2)
  })

  it('holds back a repeating task’s next occurrence until its day', () => {
    const view = listView(
      [
        task('next', { occurrence: 2, dueDate: '2026-11-06' }),
        task('first', { dueDate: '2026-11-06' }),
      ],
      'manual',
      today,
      now,
    )

    expect(ids(view.open.flatMap((section) => section.rows))).toEqual(['first'])
  })

  it('sorts stars recent first and titles alphabetically, numbers by value', () => {
    const starred = listView(
      [
        task('x'),
        task('old', { starredAt: now - 40 * 864e5 }),
        task('new', { starredAt: now - 1000 }),
      ],
      'starred',
      today,
      now,
    )

    expect(starred.open.map((section) => section.heading.kind)).toEqual([
      'starredRecently',
      'starredEarlier',
      'notStarred',
    ])

    const titles = listView([task('Task 10'), task('task 9'), task('Äpple')], 'title', today, now)
    expect(ids(titles.open[0]!.rows)).toEqual(['Äpple', 'task 9', 'Task 10'])
  })
})

describe('smart views', () => {
  it('gathers what is due up to today, overdue first', () => {
    const sections = todayView(
      [
        task('t', { dueDate: today }),
        task('o', { dueDate: '2026-10-30' }),
        task('f', { dueDate: '2026-11-05' }),
      ],
      today,
    )

    expect(sections.map((section) => [section.heading.kind, ids(section.rows)])).toEqual([
      ['past', ['o']],
      ['today', ['t']],
    ])
  })

  it('lists what comes by day, and later beyond two weeks', () => {
    const sections = upcomingView(
      [task('soon', { dueDate: '2026-11-05' }), task('far', { dueDate: '2027-01-01' })],
      today,
    )

    expect(sections.map((section) => section.key)).toEqual(['date:2026-11-05', 'later'])
  })

  it('shows open starred tasks only', () => {
    expect(
      ids(
        starredView(
          [task('s', { starredAt: 5 }), task('d', { starredAt: 5, completedAt: 6 })],
          today,
          now,
        )[0]!.rows,
      ),
    ).toEqual(['s'])
  })

  it('finds every word, ignoring case and accents', () => {
    const tasks = [
      task('a', { title: 'Köp mjölk' }),
      task('b', { title: 'Call mum', notes: 'about the MILK', listId: 'home' }),
      task('c', { title: 'Mjölk?' }),
    ]

    expect(matchingTasks(tasks, 'mjolk kop').map((found) => found.clientId)).toEqual(['a'])
    expect(matchingTasks(tasks, ' MILK ').map((found) => found.clientId)).toEqual(['b'])
    expect(matchingTasks(tasks, '  ')).toHaveLength(3)
  })

  it('keeps the task over a subtask found', () => {
    const tasks = [
      task('p', { title: 'Party' }),
      task('s', { title: 'Buy balloons', parentId: 'p' }),
      task('o', { title: 'Order cake', parentId: 'p' }),
    ]

    expect(matchingTasks(tasks, 'balloons').map((found) => found.clientId)).toEqual(['p', 's'])
  })
})

describe('browseView', () => {
  const titles = (sections: ReturnType<typeof browseView>) =>
    sections.map((section) => [section.key, section.rows.map((row) => row.task.title)])

  it('groups every list in My order by list, those in no list last', () => {
    const tasks = [
      task('loose', { listId: null }),
      task('work', { listId: 'work', position: 1 }),
      task('home', { listId: 'home' }),
    ]

    expect(titles(browseView(tasks, 'none', 'manual', today, now, ['home', 'work']))).toEqual([
      ['list:home', ['home']],
      ['list:work', ['work']],
      ['list:', ['loose']],
    ])
  })

  it('lists done tasks under Completed, most recently done first', () => {
    const tasks = [
      task('early', { completedAt: 1 }),
      task('late', { completedAt: 5 }),
      task('open'),
    ]

    expect(titles(browseView(tasks, 'completed', 'manual', today, now, null))).toEqual([
      ['completed', ['late', 'early']],
    ])
  })

  it('orders Today’s sections by the sort unless it is My order', () => {
    const tasks = [
      task('b', { dueDate: today, position: 1 }),
      task('a', { dueDate: today, position: 2 }),
    ]

    expect(titles(browseView(tasks, 'today', 'title', today, now, null))).toEqual([
      ['today', ['a', 'b']],
    ])
  })
})
