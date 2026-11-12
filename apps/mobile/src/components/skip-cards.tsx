import { useLingui } from '@lingui/react/macro'
import { useMemo, useState } from 'react'
import { useAllTasks } from '@/data/queries'
import { animateContentSize, fillMaxWidth } from '@/lib/compose-modifiers'
import { Column } from '@/lib/compose-ui'
import {
  mindableTasks,
  seriesTitles,
  type SkipSet,
  skipConditions,
  skipSet,
} from '@/tasks/conditions'
import type { CalendarDate } from '@/tasks/dates'
import type { Repeat } from '@/tasks/model'
import { ChoiceDialog } from '@/ui/dialogs'
import {
  monthName,
  periodEndLabel,
  periodStartLabel,
  skippedMonthsLabel,
  skippedWeekdaysLabel,
  taskModeLabel,
  weekdayName,
} from '@/ui/format'
import { GroupTitle } from '@/ui/primitives'
import { DatePicker } from './date-pickers'
import { ChecklistDialog, SettingCard } from './setting-cards'

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/** A task a repeat's conditions can mind: its series, and its title. */
export type OtherTask = { seriesId: string; title: string }

/**
 * The tasks a repeat's conditions can mind, for the editor, and the title of any task one names;
 * `self` is the task's own series, never among them.
 */
export function useConditionTasks(self?: string) {
  const { t } = useLingui()
  const tasks = useAllTasks()
  const untitled = t({ message: '(No title)', comment: 'Shown for a task without a title' })

  return useMemo(() => {
    const titles = seriesTitles(tasks)

    const others: OtherTask[] = mindableTasks(tasks, self).map(({ seriesId, task }) => ({
      seriesId,
      title: task.title.trim() || untitled,
    }))

    const titleOf = (seriesId: string) => {
      const title = titles.get(seriesId)

      return title === undefined ? null : title.trim() || untitled
    }

    return { others, titleOf }
  }, [tasks, self, untitled])
}

/** A card of the group, before its place in it is known. */
type CardProps = Omit<Parameters<typeof SettingCard>[0], 'index' | 'count'> & { key: string }

type Dialog = 'weekdays' | 'months' | 'from' | 'to' | 'task' | 'mode' | null

/**
 * The days a repeat skips, as cards in the repeat sheet laid out as its others: each shows what
 * it skips, or what it sets dimmed while it skips nothing, opens one dialog and is cleared with
 * its button. Days of the week (not on a fixed weekly repeat, whose days are chosen already),
 * months, a run of days with its first and last day, and another task, whose days it skips so
 * the two take turns, or keeps to.
 */
export function SkipCards({
  repeat,
  weekly,
  start,
  others,
  titleOf,
  onChange,
}: {
  repeat: Repeat
  /** A fixed weekly repeat, which falls on chosen weekdays and so skips none. */
  weekly: boolean
  /** The repeat's first date, where a run of days starts. */
  start: CalendarDate
  others: readonly OtherTask[]
  titleOf: (seriesId: string) => string | null
  onChange: (conditions: Repeat['conditions']) => void
}) {
  const { t } = useLingui()
  const [dialog, setDialog] = useState<Dialog>(null)
  const set = skipSet(repeat.conditions)
  const close = () => setDialog(null)

  const update = (patch: Partial<SkipSet>) => onChange(skipConditions({ ...set, ...patch }))

  const taskTitle = set.task ? titleOf(set.task.seriesId) : null

  const cards: CardProps[] = []

  if (!weekly)
    cards.push({
      key: 'weekdays',
      glyph: 'week',
      label: t({ message: 'Skip days of the week', comment: 'Repeat sheet card, unset' }),
      value: set.weekdays.length > 0 ? skippedWeekdaysLabel(set.weekdays) : null,
      onPress: () => setDialog('weekdays'),
      clear: {
        label: t({ message: 'Skip no days of the week', comment: 'Clears skipped weekdays' }),
        onPress: () => update({ weekdays: [] }),
      },
    })

  cards.push(
    {
      key: 'months',
      glyph: 'date',
      label: t({ message: 'Skip months', comment: 'Repeat sheet card, unset' }),
      value: set.months.length > 0 ? skippedMonthsLabel(set.months) : null,
      onPress: () => setDialog('months'),
      clear: {
        label: t({ message: 'Skip no months', comment: 'Clears skipped months' }),
        onPress: () => update({ months: [] }),
      },
    },
    {
      key: 'from',
      glyph: 'upcoming',
      label: t({
        message: 'Skip a period',
        comment: 'Repeat sheet card, unset: a run of days it skips, such as a holiday',
      }),
      value: set.period ? periodStartLabel(set.period.from) : null,
      onPress: () => setDialog('from'),
      clear: {
        label: t({ message: 'Skip no period', comment: 'Clears the run of days a repeat skips' }),
        onPress: () => update({ period: null }),
      },
    },
  )

  if (set.period)
    cards.push({
      key: 'to',
      glyph: 'deadline',
      label: '',
      value: periodEndLabel(set.period.to),
      onPress: () => setDialog('to'),
    })

  if (others.length > 0 || set.task)
    cards.push({
      key: 'task',
      glyph: 'turns',
      label: t({
        message: 'Take turns with another task',
        comment: 'Repeat sheet card, unset: skip the days another task is due',
      }),
      value: set.task
        ? (taskTitle ??
          t({
            message: 'A task that is gone',
            comment: 'Repeat sheet: the task it minded was deleted',
          }))
        : null,
      onPress: () => setDialog('task'),
      clear: {
        label: t({ message: 'Mind no other task', comment: 'Clears the task a repeat minds' }),
        onPress: () => update({ task: null }),
      },
    })

  if (set.task)
    cards.push({
      key: 'mode',
      glyph: 'repeat',
      label: '',
      value: taskModeLabel(set.task.except),
      onPress: () => setDialog('mode'),
    })

  return (
    <Column modifiers={[fillMaxWidth()]} verticalArrangement={{ spacedBy: 8 }}>
      <GroupTitle title={t({ message: 'Skip', comment: 'Repeat sheet heading: days it skips' })} />
      <Column
        modifiers={[fillMaxWidth(), animateContentSize()]}
        verticalArrangement={{ spacedBy: 2 }}
      >
        {cards.map(({ key, ...card }, index) => (
          <SettingCard key={key} {...card} index={index} count={cards.length} />
        ))}
      </Column>
      {dialog === 'weekdays' ? (
        <ChecklistDialog
          title={t({ message: 'Skip on', comment: 'Dialog title: weekdays a repeat skips' })}
          options={WEEKDAYS.map((day) => ({ value: day, label: weekdayName(day) }))}
          chosen={set.weekdays}
          allowNone
          allowAll={false}
          onConfirm={(weekdays) => update({ weekdays })}
          onDismiss={close}
        />
      ) : null}
      {dialog === 'months' ? (
        <ChecklistDialog
          title={t({ message: 'Skip in', comment: 'Dialog title: months a repeat skips' })}
          options={MONTHS.map((month) => ({ value: month, label: monthName(month) }))}
          chosen={set.months}
          allowNone
          allowAll={false}
          onConfirm={(months) => update({ months })}
          onDismiss={close}
        />
      ) : null}
      {dialog === 'from' ? (
        <DatePicker
          value={set.period?.from ?? start}
          onPick={(from) => {
            const to = set.period && set.period.to >= from ? set.period.to : from

            update({ period: { from, to } })

            // A new run of days asks for its last day next, once this picker has gone.
            if (!set.period) setTimeout(() => setDialog('to'), 0)
          }}
          onDismiss={() => setDialog((current) => (current === 'from' ? null : current))}
        />
      ) : null}
      {dialog === 'to' && set.period ? (
        <DatePicker
          value={set.period.to}
          onPick={(to) =>
            update({
              period:
                set.period && to < set.period.from
                  ? { from: to, to: set.period.from }
                  : { from: set.period?.from ?? to, to },
            })
          }
          onDismiss={close}
        />
      ) : null}
      {dialog === 'task' ? (
        <ChoiceDialog
          title={t({
            message: 'Take turns with',
            comment: 'Dialog title: the task whose days a repeat skips',
          })}
          options={others.map((other) => ({ value: other.seriesId, label: other.title }))}
          selected={set.task?.seriesId ?? null}
          onSelect={(seriesId) => update({ task: { seriesId, except: set.task?.except ?? true } })}
          onDismiss={close}
        />
      ) : null}
      {dialog === 'mode' && set.task ? (
        <ChoiceDialog
          title={t({
            message: 'On the days it’s due',
            comment: 'Dialog title: what a repeat does on another task’s days',
          })}
          options={[
            {
              value: 'skip',
              label: taskModeLabel(true),
              description: t({
                message: 'The two take turns.',
                comment: 'Explains skipping another task’s days',
              }),
            },
            {
              value: 'only',
              label: taskModeLabel(false),
              description: t({
                message: 'It goes with the other task.',
                comment: 'Explains keeping to another task’s days',
              }),
            },
          ]}
          selected={set.task.except ? 'skip' : 'only'}
          onSelect={(mode) => {
            if (set.task) update({ task: { ...set.task, except: mode === 'skip' } })
          }}
          onDismiss={close}
        />
      ) : null}
    </Column>
  )
}
