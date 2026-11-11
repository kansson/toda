import { useLingui } from '@lingui/react/macro'
import {
  clickable,
  clip,
  composeGeometry,
  fillMaxWidth,
  offset,
  padding,
} from '@/lib/compose-modifiers'
import { Column, Icon, IconButton, ListItem, Row, Text, useMaterialColors } from '@/lib/compose-ui'
import type { CalendarDate } from '@/tasks/dates'
import type { Task } from '@/tasks/model'
import { deadlineLabel, dueLabel, isOverdue } from '@/ui/format'
import { glyphs } from '@/ui/glyphs'

/**
 * A row's inset from the list's sides and its corners, in dp: where its ripple is drawn, and
 * where it is tinted while held to drag.
 */
export const TASK_ROW_OUTLINE = { inset: 8, corner: 12 }

export type TaskRowProps = {
  task: Task
  depth: 0 | 1
  today: CalendarDate
  /** The task's list, for rows gathered from several lists. */
  listTitle?: string
  /** Open subtasks under it, shown as a count when its subtasks are not listed below it. */
  subtaskCount?: number
  /** A subtask's cadence under its repeating task, such as "Once every 3 times". */
  cadence?: string
  /** The write is still on its way to the server. */
  pending?: boolean
  onToggle: () => void
  onStar: () => void
  onOpen: () => void
}

/**
 * A task in a list: its circle checks it off, its star marks it, and the rest opens it. Below the
 * title, what it carries: when it is due (red once passed), its repeat or, for a subtask, how
 * often it is due, its deadline and details.
 */
export function TaskRow({
  task,
  depth,
  today,
  listTitle,
  subtaskCount = 0,
  cadence,
  pending = false,
  onToggle,
  onStar,
  onOpen,
}: TaskRowProps) {
  const { t } = useLingui()
  const colors = useMaterialColors()
  const done = task.completedAt !== null
  const overdue = isOverdue(task, today)
  const due = dueLabel(task, today)

  const details = [
    listTitle,
    task.deadline && !done ? deadlineLabel(task.deadline, today) : null,
    subtaskCount > 0
      ? t({
          message: `${subtaskCount} subtasks`,
          comment: 'Task row: how many open subtasks it has',
        })
      : null,
  ].filter(Boolean)

  // Every line of the details, under the rest, so none of them is cut off.
  const notes = task.notes.trim()
  const repeats = task.repeat !== null || cadence !== undefined
  const hasMeta = due !== '' || repeats || pending || details.length > 0
  const hasSupporting = hasMeta || notes !== ''

  const title =
    task.title.trim() || t({ message: '(No title)', comment: 'Shown for a task without a title' })

  return (
    <ListItem
      // Compose reads a ListItem's slots once, so a row that gains a line is drawn afresh.
      key={`${task.clientId}:${hasSupporting ? 's' : ''}`}
      // None of its own, so the list's tint shows through it while it is held.
      colors={{ containerColor: 'transparent' }}
      modifiers={[
        fillMaxWidth(),
        // Inset and rounded as a group's label is, so their ripples line up; rows and labels
        // still meet with no space between them.
        padding(TASK_ROW_OUTLINE.inset, 0, TASK_ROW_OUTLINE.inset, 0),
        clip(composeGeometry.RoundedCorner(TASK_ROW_OUTLINE.corner)),
        clickable(onOpen),
        padding(depth === 1 ? 32 : 0, 0, 0, 0),
      ]}
    >
      {/*
        The list item's own 16 dp and the buttons' 12 dp round their icons would leave the circle
        and the star 28 dp inside the ripple's edges; drawn 12 dp outward, with the text after
        them, they sit 16 dp in, as Material has it, and keep their 48 dp to tap.
      */}
      <ListItem.LeadingContent>
        <IconButton onClick={onToggle} modifiers={[offset(-12, 0)]}>
          <Icon
            source={done ? glyphs.completed : glyphs.open}
            size={24}
            tint={done ? colors.primary : overdue ? colors.error : colors.onSurfaceVariant}
            contentDescription={
              done
                ? t({ message: 'Mark not done', comment: 'Task checkbox description when done' })
                : t({ message: 'Mark done', comment: 'Task checkbox description when open' })
            }
          />
        </IconButton>
      </ListItem.LeadingContent>
      <ListItem.HeadlineContent>
        <Text
          color={done ? colors.onSurfaceVariant : colors.onSurface}
          maxLines={3}
          overflow='ellipsis'
          style={{ typography: 'bodyLarge', textDecoration: done ? 'lineThrough' : 'none' }}
          modifiers={[offset(-12, 0)]}
        >
          {title}
        </Text>
      </ListItem.HeadlineContent>
      {hasSupporting ? (
        <ListItem.SupportingContent>
          <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[offset(-12, 0)]}>
            {hasMeta ? (
              <Row verticalAlignment='center' horizontalArrangement={{ spacedBy: 6 }}>
                {due ? (
                  <Text
                    color={overdue ? colors.error : colors.onSurfaceVariant}
                    maxLines={1}
                    style={{ typography: 'bodySmall' }}
                  >
                    {due}
                  </Text>
                ) : null}
                {repeats ? (
                  <Icon source={glyphs.repeat} size={14} tint={colors.onSurfaceVariant} />
                ) : null}
                {cadence ? (
                  <Text
                    color={colors.onSurfaceVariant}
                    maxLines={1}
                    overflow='ellipsis'
                    style={{ typography: 'bodySmall' }}
                  >
                    {cadence}
                  </Text>
                ) : null}
                {pending ? (
                  <Icon source={glyphs.pending} size={14} tint={colors.onSurfaceVariant} />
                ) : null}
                {details.length > 0 ? (
                  <Text
                    color={colors.onSurfaceVariant}
                    maxLines={1}
                    overflow='ellipsis'
                    style={{ typography: 'bodySmall' }}
                  >
                    {(due || cadence ? '· ' : '') + details.join(' · ')}
                  </Text>
                ) : null}
              </Row>
            ) : null}
            {notes ? (
              <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>
                {notes}
              </Text>
            ) : null}
          </Column>
        </ListItem.SupportingContent>
      ) : null}
      <ListItem.TrailingContent>
        {done ? (
          <Row />
        ) : (
          <IconButton onClick={onStar} modifiers={[offset(12, 0)]}>
            <Icon
              source={task.starredAt !== null ? glyphs.starFilled : glyphs.star}
              size={22}
              tint={task.starredAt !== null ? colors.tertiary : colors.onSurfaceVariant}
              contentDescription={
                task.starredAt !== null
                  ? t({ message: 'Remove star', comment: 'Task row button removing its star' })
                  : t({ message: 'Add star', comment: 'Task row button starring it' })
              }
            />
          </IconButton>
        )}
      </ListItem.TrailingContent>
    </ListItem>
  )
}
