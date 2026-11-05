import { useLingui } from '@lingui/react/macro'
import { type ReactNode, useRef, useState } from 'react'
import { useTaskCommands } from '@/components/task-commands'
import { TaskRow } from '@/components/task-row'
import { useActions } from '@/data/provider'
import { useLists, useTaskSet, useToday } from '@/data/queries'
import { fillMaxSize, fillMaxWidth, height } from '@/lib/compose-modifiers'
import { AnimatedVisibility, Box, EnterTransition, ExitTransition } from '@/lib/compose-ui'
import type { ListSort, Task } from '@/tasks/model'
import { browseView, type Filter, matchingTasks, type SectionKind } from '@/tasks/views'
import { sectionTitle } from '@/ui/format'
import type { Glyph } from '@/ui/glyphs'
import { Empty, LoadingPage, SectionHeader } from '@/ui/primitives'
import { BodyCentre, ReorderList } from '../../modules/ui'
import { TASK_ROW_OUTLINE } from './task-row'

type Item = { key: string; draggable: boolean; node: ReactNode }

/** Groups that go without a label when they hold everything shown, as they say nothing then. */
const UNLABELLED: ReadonlySet<SectionKind['kind']> = new Set([
  'all',
  'noDate',
  'noDeadline',
  'notStarred',
])

/**
 * The main screen's tasks: those of one list or every list, for a view and a sort
 * (`browseView`). One list in Relevance with no view is held and dragged into a new order; every
 * other combination is read in its sections, each under a label that folds it away. Rows from
 * several lists say which list they are in.
 */
export function TaskList({
  scope,
  filter,
  sort,
  query = '',
}: {
  /** The ids of the lists shown, in their order; none shows every list. */
  scope: readonly string[]
  filter: Filter
  sort: ListSort
  /** Words to find in a task's title or details; empty finds every task. */
  query?: string
}) {
  const { t } = useLingui()
  const actions = useActions()
  const commands = useTaskCommands()
  const today = useToday()
  const lists = useLists()
  const { tasks: all, loaded } = useTaskSet()
  const lastEmpty = useRef<{ glyph: Glyph; title: string } | null>(null)
  // The groups folded away, by section key, for as long as the screen is open.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())

  const toggleSection = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current)

      if (!next.delete(key)) next.add(key)

      return next
    })

  const tasks = matchingTasks(
    scope.length === 0
      ? all
      : all.filter((task) => task.listId !== null && scope.includes(task.listId)),
    query,
  )

  const listTitle = (id: string | null) => lists.find((list) => list.clientId === id)?.title ?? ''

  const sections = browseView(
    tasks,
    filter,
    sort,
    today,
    Date.now(),
    // Several lists are grouped by list; one is shown as it is.
    scope.length === 0 ? lists.map((list) => list.clientId) : scope.length > 1 ? scope : null,
  )

  const reorderable = scope.length === 1 && filter === 'none' && sort === 'manual'

  // Only the first load waits: the phone's copy is read from disk, then kept live.
  if (!loaded) return <LoadingPage />

  const empty: { glyph: Glyph; title: string } =
    query.trim() !== ''
      ? {
          glyph: 'search',
          title: t({ message: 'Nothing found', comment: 'Search without results' }),
        }
      : filter === 'today'
        ? {
            glyph: 'today',
            title: t({ message: 'Nothing due today', comment: 'Empty Today view' }),
          }
        : filter === 'upcoming'
          ? {
              glyph: 'upcoming',
              title: t({ message: 'Nothing coming up', comment: 'Empty Upcoming view' }),
            }
          : filter === 'starred'
            ? {
                glyph: 'star',
                title: t({ message: 'No starred tasks', comment: 'Empty Starred view' }),
              }
            : filter === 'completed'
              ? {
                  glyph: 'completed',
                  title: t({ message: 'Nothing done yet', comment: 'Empty Completed view' }),
                }
              : {
                  glyph: 'task',
                  title: t({
                    message: 'No tasks',
                    comment: 'Main screen with no tasks and no view chosen',
                  }),
                }

  // What the empty state says: this view's while it is empty, and the last one's while it fades.
  if (sections.length === 0) lastEmpty.current = empty
  const shownEmpty = lastEmpty.current ?? empty

  // A row names its list when it shows tasks of several and its section is not that list already.
  const row = (task: Task, depth: 0 | 1, named: boolean): Item => ({
    key: task.clientId,
    draggable: reorderable && task.completedAt === null,
    node: (
      <TaskRow
        task={task}
        depth={depth}
        today={today}
        listTitle={named ? listTitle(task.listId) : undefined}
        onToggle={() => commands.toggle(task)}
        onStar={() => commands.star(task)}
        onOpen={() => commands.open(task)}
      />
    ),
  })

  const items: Item[] = []

  for (const section of sections) {
    // Every group is labelled, but for one that holds everything shown without saying anything,
    // such as No date when no task shown has a date.
    const labelled = sections.length > 1 || !UNLABELLED.has(section.heading.kind)

    const title =
      filter === 'today' && section.heading.kind === 'today'
        ? t({ message: 'Due today', comment: 'Section of the Today view: tasks dated today' })
        : sectionTitle(section.heading, today, listTitle)

    const folded = labelled && title !== '' && collapsed.has(section.key)

    if (labelled && title)
      items.push({
        key: `section:${section.key}`,
        draggable: false,
        node: (
          <SectionHeader
            title={title}
            count={section.rows.filter((entry) => entry.depth === 0).length}
            collapsed={folded}
            onToggle={() => toggleSection(section.key)}
          />
        ),
      })

    if (folded) continue

    const named = scope.length !== 1 && section.heading.kind !== 'list'

    for (const entry of section.rows) items.push(row(entry.task, entry.depth, named))
  }

  // Room for the floating button over the last row.
  items.push({
    key: 'end',
    draggable: false,
    node: <Box modifiers={[fillMaxWidth(), height(112)]} />,
  })

  // One native list for every view and the empty state over it, so changing a view only changes
  // the rows, which fade and slide into place, rather than drawing another list afresh. Only one
  // list in Relevance has rows to drag.
  return (
    <Box modifiers={[fillMaxSize()]}>
      <ReorderList
        keys={items.map((item) => item.key)}
        draggable={items.map((item) => item.draggable)}
        // Room under the panel's curved top, whose corners are 28 dp, for whatever comes first:
        // its rounded ripple starts below the curve, and then scrolls up into it. A label keeps
        // 8 dp of its own over its ripple; a row has none, so it takes all 28 dp here.
        contentPadding={{ top: items[0]?.key.startsWith('section:') ? 20 : 28 }}
        // A held row is tinted in its own inset, rounded shape, the one its ripple has.
        heldTint={TASK_ROW_OUTLINE}
        onReorder={(key, order) => actions.reorderTask(key, order)}
      >
        {items.map((item) => (
          <Box key={item.key} modifiers={[fillMaxWidth()]}>
            {item.node}
          </Box>
        ))}
      </ReorderList>
      {/*
        Always there, fading in as the last rows fade out and away as rows come back, rather than
        appearing over them at once; it keeps saying what it said while it fades. Centred in what
        the keyboard leaves in view, as while searching.
      */}
      <AnimatedVisibility
        visible={sections.length === 0}
        enterTransition={EnterTransition.fadeIn()}
        exitTransition={ExitTransition.fadeOut()}
        modifiers={[fillMaxSize()]}
      >
        <BodyCentre>
          <Empty glyph={shownEmpty.glyph} title={shownEmpty.title} height='content' />
        </BodyCentre>
      </AnimatedVisibility>
      {commands.prompt}
    </Box>
  )
}
