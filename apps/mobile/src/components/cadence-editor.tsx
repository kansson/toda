import { plural } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { type ReactNode, useState } from 'react'
import { animateContentSize, fillMaxWidth, padding, verticalScroll } from '@/lib/compose-modifiers'
import { Column, Switch } from '@/lib/compose-ui'
import {
  type Cadence,
  dueEveryTime,
  everyCadence,
  type Lean,
  nextDue,
  type ScheduleCadence,
  scheduleCadence,
} from '@/tasks/cadence'
import type { CalendarDate } from '@/tasks/dates'
import type { Repeat, Task } from '@/tasks/model'
import { ChoiceDialog, TextDialog } from '@/ui/dialogs'
import {
  cadenceLabel,
  dayLabel,
  everyLabel,
  everyTimesLabel,
  leanLabel,
  leewayLabel,
  nextDueLabel,
} from '@/ui/format'
import { SummaryCard } from '@/ui/primitives'
import { PrimaryAction } from '@/ui/screen'
import { Sheet } from '@/ui/sheets'
import { DatePicker } from './date-pickers'
import { IntervalDialog } from './repeat-editor'
import { SettingCard } from './setting-cards'

const MAX_TIMES = 999

const MAX_LEEWAY = 365

/** The most later starts offered for a subtask due every few times. */
const MAX_STARTS = 7

const LEANS: readonly Lean[] = ['closest', 'before', 'after']

type Kind = 'always' | Cadence['kind']

type Dialog = 'kind' | 'count' | 'start' | 'interval' | 'next' | 'lean' | 'leeway' | null

type Card = { key: string; node: (index: number, total: number) => ReactNode }

/** A schedule a step longer than the task's own repeat, as a subtask's own one usually is. */
function longerUnit(repeat: Repeat | null): Repeat['unit'] {
  switch (repeat?.unit) {
    case 'month':
    case 'year':
      return 'year'
    case 'week':
      return 'month'
    default:
      return 'week'
  }
}

/**
 * Sets when a subtask of a repeating task is due, in one run of cards with the answer summed up
 * below them, saved from the check in the sheet's title bar: every time (the default), once every
 * few times its task repeats, starting this time or a few times on, or on a schedule of its own.
 * A subtask on its own schedule lands on one of its task's dates around each of its own: the
 * closest, never late (the one before) or never early (the one after), where a leeway of days
 * lets the other side's date take it when that one is nearer. Its dates stay fixed or count from
 * when it was last done. A schedule the task keeps up with anyway says it is due every time.
 */
export function CadenceEditor({
  subtask,
  parent,
  today,
  onSave,
  onDismiss,
}: {
  subtask: Task
  /** The repeating task it belongs to. */
  parent: Task
  today: CalendarDate
  /** The cadence, or null for every time. */
  onSave: (cadence: Cadence | null) => void
  onDismiss: () => void
}) {
  const { t } = useLingui()
  const initial = subtask.cadence ?? null
  // A repeating task always has a date; today stands in should it have lost it.
  const start = parent.dueDate ?? today
  const [kind, setKind] = useState<Kind>(initial?.kind ?? 'always')
  const [count, setCount] = useState(initial?.kind === 'every' ? initial.count : 2)

  // How many of the task's times come before it is due, kept from a cadence already set.
  const [after, setAfter] = useState(() =>
    initial?.kind === 'every' ? (nextDue(subtask, parent, today)?.after ?? 0) : 0,
  )

  const [schedule, setSchedule] = useState<ScheduleCadence>(() =>
    initial?.kind === 'schedule' ? initial : scheduleCadence(longerUnit(parent.repeat), 1, start),
  )

  const [dialog, setDialog] = useState<Dialog>(null)

  const cadence: Cadence | null =
    kind === 'every'
      ? everyCadence(parent, count, Math.min(after, count - 1))
      : kind === 'schedule'
        ? schedule
        : null

  const due = cadence ? nextDue({ ...subtask, cadence }, parent, today) : null
  const everyTime = cadence !== null && dueEveryTime(cadence, parent, today)
  const nextDay = dayLabel(schedule.next, today)
  const fixed = schedule.anchor !== 'completion'

  const kindLabels: Record<Kind, string> = {
    always: t({ message: 'Every time', comment: 'Subtask cadence: whenever its task repeats' }),
    every: t({
      message: 'Every few times',
      comment: 'Subtask cadence: once every so many times its task repeats',
    }),
    schedule: t({
      message: 'On its own schedule',
      comment: 'Subtask cadence: its own interval, landing on its task’s dates',
    }),
  }

  const startLabel = (offset: number) =>
    offset === 0
      ? t({ message: 'Starting this time', comment: 'Subtask cadence: first due now' })
      : plural(offset, { one: 'Starting next time', other: 'Starting # times from now' })

  const updateSchedule = (patch: Partial<ScheduleCadence>) =>
    setSchedule((current) => ({ ...current, ...patch }))

  const everyCards: Card[] = [
    {
      key: 'count',
      node: (index, total) => (
        <SettingCard
          key='count'
          glyph='history'
          index={index}
          count={total}
          label={everyTimesLabel(count)}
          value={everyTimesLabel(count)}
          onPress={() => setDialog('count')}
        />
      ),
    },
    {
      key: 'start',
      node: (index, total) => (
        <SettingCard
          key='start'
          glyph='upcoming'
          index={index}
          count={total}
          label={startLabel(after)}
          value={startLabel(Math.min(after, count - 1))}
          onPress={() => setDialog('start')}
        />
      ),
    },
  ]

  const leewayCard: Card = {
    key: 'leeway',
    node: (index, total) => (
      <SettingCard
        key='leeway'
        glyph='time'
        index={index}
        count={total}
        label={
          schedule.lean === 'after'
            ? t({
                message: 'Not even a day early',
                comment: 'Subtask cadence editor: no leeway for a never-early one',
              })
            : t({
                message: 'Not even a day late',
                comment: 'Subtask cadence editor: no leeway for a never-late one',
              })
        }
        value={schedule.leeway === 0 ? null : leewayLabel(schedule.lean, schedule.leeway)}
        onPress={() => setDialog('leeway')}
        clear={{
          label: t({
            message: 'No leeway',
            comment: 'Subtask cadence editor: keeps it strictly on its side',
          }),
          onPress: () => updateSchedule({ leeway: 0 }),
        }}
      />
    ),
  }

  const scheduleCards: Card[] = [
    {
      key: 'fixed',
      node: (index, total) => (
        <SettingCard
          key='fixed'
          glyph='date'
          index={index}
          count={total}
          label={t({
            message: 'Fixed schedule',
            comment: 'Repeat editor switch: keep the dates instead of counting from done',
          })}
          onPress={() => updateSchedule({ anchor: fixed ? 'completion' : 'due' })}
          trailing={
            <Switch
              value={fixed}
              onCheckedChange={(checked) =>
                updateSchedule({ anchor: checked ? 'due' : 'completion' })
              }
            />
          }
        />
      ),
    },
    {
      key: 'interval',
      node: (index, total) => (
        <SettingCard
          key='interval'
          glyph='repeat'
          index={index}
          count={total}
          label={everyLabel(schedule.unit, schedule.interval)}
          value={everyLabel(schedule.unit, schedule.interval)}
          onPress={() => setDialog('interval')}
        />
      ),
    },
    {
      key: 'next',
      node: (index, total) => (
        <SettingCard
          key='next'
          glyph='today'
          index={index}
          count={total}
          label={nextDay}
          value={t({
            message: `Next on its schedule: ${nextDay}`,
            comment: 'Subtask cadence editor: the date of its own schedule it is next for',
          })}
          onPress={() => setDialog('next')}
        />
      ),
    },
    {
      key: 'lean',
      node: (index, total) => (
        <SettingCard
          key='lean'
          glyph='week'
          index={index}
          count={total}
          label={leanLabel(schedule.lean)}
          value={leanLabel(schedule.lean)}
          onPress={() => setDialog('lean')}
        />
      ),
    },
    ...(schedule.lean === 'closest' ? [] : [leewayCard]),
  ]

  const cards: Card[] = [
    {
      key: 'kind',
      node: (index, total) => (
        <SettingCard
          key='kind'
          glyph='repeat'
          index={index}
          count={total}
          label={kindLabels[kind]}
          value={kindLabels[kind]}
          onPress={() => setDialog('kind')}
        />
      ),
    },
    ...(kind === 'every' ? everyCards : kind === 'schedule' ? scheduleCards : []),
  ]

  return (
    <Sheet
      tall
      title={t({ message: 'When it’s due', comment: 'Title of the subtask cadence editor' })}
      action={(close) => (
        <PrimaryAction
          glyph='check'
          label={t({ message: 'Done', comment: 'Saves the subtask cadence' })}
          onPress={() => {
            onSave(cadence)
            close()
          }}
        />
      )}
      onDismiss={onDismiss}
    >
      {() => (
        <Column
          modifiers={[fillMaxWidth(), verticalScroll(), padding(16, 0, 16, 24)]}
          verticalArrangement={{ spacedBy: 16 }}
        >
          <Column
            modifiers={[fillMaxWidth(), animateContentSize()]}
            verticalArrangement={{ spacedBy: 2 }}
          >
            {cards.map((entry, index) => entry.node(index, cards.length))}
          </Column>
          <SummaryCard
            glyph='repeat'
            title={
              cadence
                ? cadenceLabel(cadence)
                : t({
                    message: 'Due every time the task repeats',
                    comment: 'Subtask cadence summary: no cadence of its own',
                  })
            }
            message={
              cadence === null
                ? undefined
                : everyTime
                  ? t({
                      message:
                        'The task repeats less often than this, so it’s due every time anyway.',
                      comment: 'Subtask cadence summary: its schedule is as often as its task',
                    })
                  : nextDueLabel(due, today)
            }
          />
          {dialog === 'kind' ? (
            <ChoiceDialog
              title={t({
                message: 'When it’s due',
                comment: 'Dialog title: how often a subtask is due',
              })}
              options={(['always', 'every', 'schedule'] as const).map((value) => ({
                value,
                label: kindLabels[value],
              }))}
              selected={kind}
              onSelect={setKind}
              onDismiss={() => setDialog(null)}
            />
          ) : null}
          {dialog === 'count' ? (
            <TextDialog
              title={t({
                message: 'Once every how many times?',
                comment: 'Dialog title: every how many times a subtask is due',
              })}
              label={t({ message: 'Times', comment: 'Label of how many times, as in every 3' })}
              initialValue={String(count)}
              number={MAX_TIMES}
              confirmLabel={t({ message: 'OK', comment: 'Confirms a dialog' })}
              onConfirm={(value) => {
                const times = Number(value)

                if (times === 1) setKind('always')
                else setCount(times)
              }}
              onDismiss={() => setDialog(null)}
            />
          ) : null}
          {dialog === 'start' ? (
            <ChoiceDialog
              title={t({
                message: 'First due',
                comment: 'Dialog title: which time a subtask is first due',
              })}
              options={Array.from({ length: Math.min(count, MAX_STARTS) }, (_, offset) => ({
                value: offset,
                label: startLabel(offset),
              }))}
              selected={Math.min(after, count - 1)}
              onSelect={setAfter}
              onDismiss={() => setDialog(null)}
            />
          ) : null}
          {dialog === 'interval' ? (
            <IntervalDialog
              interval={schedule.interval}
              unit={schedule.unit}
              onConfirm={(interval, unit) => updateSchedule({ interval, unit })}
              onDismiss={() => setDialog(null)}
            />
          ) : null}
          {dialog === 'next' ? (
            <DatePicker
              value={schedule.next}
              // A date picked anew starts the schedule from it.
              onPick={(date) => updateSchedule({ next: date, from: date })}
              onDismiss={() => setDialog(null)}
            />
          ) : null}
          {dialog === 'lean' ? (
            <ChoiceDialog
              title={t({
                message: 'Lands on',
                comment: 'Dialog title: which of the task’s dates a subtask schedule takes',
              })}
              options={LEANS.map((lean) => ({ value: lean, label: leanLabel(lean) }))}
              selected={schedule.lean}
              onSelect={(lean) => updateSchedule({ lean })}
              onDismiss={() => setDialog(null)}
            />
          ) : null}
          {dialog === 'leeway' ? (
            <TextDialog
              title={
                schedule.lean === 'after'
                  ? t({
                      message: 'How early is fine?',
                      comment: 'Dialog title: leeway of a never-early subtask, in days',
                    })
                  : t({
                      message: 'How late is fine?',
                      comment: 'Dialog title: leeway of a never-late subtask, in days',
                    })
              }
              message={
                schedule.lean === 'after'
                  ? t({
                      message:
                        'It can land this many days early instead, when that’s nearer than landing late.',
                      comment: 'Leeway dialog for a never-early subtask',
                    })
                  : t({
                      message:
                        'It can land this many days late instead, when that’s nearer than landing early.',
                      comment: 'Leeway dialog for a never-late subtask',
                    })
              }
              label={t({ message: 'Days', comment: 'Label of a number of days' })}
              initialValue={schedule.leeway === 0 ? '' : String(schedule.leeway)}
              number={MAX_LEEWAY}
              confirmLabel={t({ message: 'OK', comment: 'Confirms a dialog' })}
              onConfirm={(value) => updateSchedule({ leeway: Number(value) })}
              onDismiss={() => setDialog(null)}
            />
          ) : null}
        </Column>
      )}
    </Sheet>
  )
}
