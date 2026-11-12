import { useLingui } from '@lingui/react/macro'
import { useMemo, useRef } from 'react'
import { useAllTasks } from '@/data/queries'
import { doneDayChoices, nextDueIfDone } from '@/tasks/completion'
import { seriesOf, seriesSchedules } from '@/tasks/conditions'
import type { CalendarDate } from '@/tasks/dates'
import type { Task } from '@/tasks/model'
import { datePhrase, dayLabel } from '@/ui/format'
import { MenuRows, Sheet } from '@/ui/sheets'

/**
 * Asks which day a late repeating task was done: today, each day back to its own date, or
 * another day from a calendar. Each choice says when the task comes back if it is taken, so
 * marking yesterday's forgotten one done brings today's.
 */
export function DoneDaySheet({
  task,
  today,
  onPick,
  onPickAnother,
  onDismiss,
}: {
  task: Task
  today: CalendarDate
  onPick: (day: CalendarDate) => void
  /** Another day was asked for: the calendar opens once the sheet has gone. */
  onPickAnother: () => void
  onDismiss: () => void
}) {
  const { t } = useLingui()
  // Another day opens the calendar only once the sheet has closed, not over it.
  const another = useRef(false)
  const tasks = useAllTasks()
  // When the tasks its repeat's conditions name are due, so each day says when it really is back.
  const schedules = useMemo(() => seriesSchedules(tasks, seriesOf(task)), [tasks, task])

  // What taking a day does: when the task comes back, and whether it was done on its own day.
  const note = (day: CalendarDate) => {
    const next = nextDueIfDone(task, day, schedules)

    if (next === null)
      return t({
        message: 'Its last time',
        comment: 'Done-day sheet: the repeating task ends if done on this day',
      })
    const when = datePhrase(next, today)

    return day === task.dueDate
      ? t({
          message: `On its day · back ${when}`,
          comment: 'Done-day sheet: the day it was due; then when it comes back if done that day',
        })
      : t({
          message: `Back ${when}`,
          comment: 'Done-day sheet: when the repeating task comes back if done on this day',
        })
  }

  return (
    <Sheet
      title={t({
        message: 'When did you do it?',
        comment: 'Title of the sheet asking which day a late repeating task was done',
      })}
      onDismiss={() => (another.current ? onPickAnother() : onDismiss())}
    >
      {(close) => (
        <MenuRows
          close={close}
          rows={[
            ...doneDayChoices(task, today).map((day) => ({
              key: day,
              label: dayLabel(day, today),
              note: note(day),
              onPress: () => onPick(day),
            })),
            {
              key: 'another',
              glyph: 'date' as const,
              label: t({
                message: 'Another day…',
                comment: 'Done-day sheet: pick the day it was done from a calendar',
              }),
              onPress: () => {
                another.current = true
              },
            },
          ]}
        />
      )}
    </Sheet>
  )
}
