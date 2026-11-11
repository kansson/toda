import { plural } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { type ReactNode, useState } from 'react'
import { animateContentSize, fillMaxWidth, padding, verticalScroll } from '@/lib/compose-modifiers'
import { Column } from '@/lib/compose-ui'
import {
  type Cadence,
  everyCadence,
  type Lean,
  nextRound,
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
  nextRoundLabel,
} from '@/ui/format'
import { SummaryCard } from '@/ui/primitives'
import { PrimaryAction } from '@/ui/screen'
import { Sheet } from '@/ui/sheets'
import { DatePicker } from './date-pickers'
import { IntervalDialog, SettingCard } from './repeat-editor'

const MAX_TIMES = 999

const MAX_LEEWAY = 365

/** The most later starts offered for a subtask coming round every few times. */
const MAX_STARTS = 7

type Kind = 'always' | Cadence['kind']

type Dialog = 'kind' | 'count' | 'start' | 'interval' | 'next' | 'lean' | 'leeway' | null

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
 * Sets when a subtask of a repeating task comes round, in one run of cards with the answer summed
 * up below them, saved from the check in the sheet's title bar: every time (the default), once
 * every few times its task comes round, starting this time or a few times on, or on a schedule of
 * its own. A subtask on its own schedule lands on one of its task's dates around each of its own:
 * the closest, the one before (never late) or the one after (never early), where a leeway of days
 * lets the other side's date take it when that one is nearer.
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

  // How many of the task's times come before it does, kept from a cadence already set.
  const [after, setAfter] = useState(() =>
    initial?.kind === 'every' ? (nextRound(subtask, parent)?.after ?? 0) : 0,
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

  const round = cadence ? nextRound({ ...subtask, cadence }, parent) : null
  const nextDay = dayLabel(schedule.next, today)

  const kindLabels: Record<Kind, string> = {
    always: t({ message: 'Every time', comment: 'Subtask cadence: whenever its task comes round' }),
    every: t({
      message: 'Every few times',
      comment: 'Subtask cadence: once every so many times its task comes round',
    }),
    schedule: t({
      message: 'On a schedule of its own',
      comment: 'Subtask cadence: its own interval, landing on its task’s dates',
    }),
  }

  const startLabel = (offset: number) =>
    offset === 0
      ? t({ message: 'Starting this time', comment: 'Subtask cadence: first comes round now' })
      : plural(offset, { one: 'Starting next time', other: 'Starting in # times' })

  const updateSchedule = (patch: Partial<ScheduleCadence>) =>
    setSchedule((current) => ({ ...current, ...patch }))

  const cards: { key: string; node: (index: number, count: number) => ReactNode }[] = [
    {
      key: 'kind',
      node: (index, total) => (
        <SettingCard
          key='kind'
          glyph='repeat'
          index={index}
          count={total}
          label={t({ message: 'Comes round', comment: 'Subtask cadence editor: how it repeats' })}
          value={kindLabels[kind]}
          onPress={() => setDialog('kind')}
        />
      ),
    },
    ...(kind === 'every'
      ? [
          {
            key: 'count',
            node: (index: number, total: number) => (
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
            node: (index: number, total: number) => (
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
      : []),
    ...(kind === 'schedule'
      ? [
          {
            key: 'interval',
            node: (index: number, total: number) => (
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
            node: (index: number, total: number) => (
              <SettingCard
                key='next'
                glyph='date'
                index={index}
                count={total}
                label={t({
                  message: 'Next date',
                  comment: 'Subtask cadence editor: the date it is next meant for',
                })}
                value={t({
                  message: `Next meant for ${nextDay}`,
                  comment: 'Subtask cadence editor: the date of its own schedule it is next for',
                })}
                onPress={() => setDialog('next')}
              />
            ),
          },
          {
            key: 'lean',
            node: (index: number, total: number) => (
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
          ...(schedule.lean === 'closest'
            ? []
            : [
                {
                  key: 'leeway',
                  node: (index: number, total: number) => (
                    <SettingCard
                      key='leeway'
                      glyph='time'
                      index={index}
                      count={total}
                      label={t({
                        message: 'No leeway',
                        comment:
                          'Subtask cadence editor: never on the other side of its date, unset',
                      })}
                      value={
                        schedule.leeway === 0 ? null : leewayLabel(schedule.lean, schedule.leeway)
                      }
                      onPress={() => setDialog('leeway')}
                      clear={{
                        label: t({
                          message: 'Clear the leeway',
                          comment: 'Subtask cadence editor: keeps it strictly on its side',
                        }),
                        onPress: () => updateSchedule({ leeway: 0 }),
                      }}
                    />
                  ),
                },
              ]),
        ]
      : []),
  ]

  const leanChoices: { value: Lean; label: string }[] = [
    { value: 'closest', label: leanLabel('closest') },
    { value: 'before', label: leanLabel('before') },
    { value: 'after', label: leanLabel('after') },
  ]

  return (
    <Sheet
      tall
      title={t({ message: 'Comes round', comment: 'Title of the subtask cadence editor' })}
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
            {cards.map((card, index) => card.node(index, cards.length))}
          </Column>
          <SummaryCard
            glyph='repeat'
            title={
              cadence
                ? cadenceLabel(cadence)
                : t({
                    message: 'Every time the task comes round',
                    comment: 'Subtask cadence summary: no cadence of its own',
                  })
            }
            message={cadence ? nextRoundLabel(round, today) : undefined}
          />
          {dialog === 'kind' ? (
            <ChoiceDialog
              title={t({ message: 'Comes round', comment: 'Subtask cadence editor: how' })}
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
                message: 'Once every',
                comment: 'Dialog title: every how many times a subtask comes round',
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
                message: 'Starts',
                comment: 'Dialog title: which time a subtask first comes round',
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
              options={leanChoices}
              selected={schedule.lean}
              onSelect={(lean) => updateSchedule({ lean })}
              onDismiss={() => setDialog(null)}
            />
          ) : null}
          {dialog === 'leeway' ? (
            <TextDialog
              title={t({
                message: 'Leeway',
                comment: 'Dialog title: how many days on the other side of its date still do',
              })}
              message={
                schedule.lean === 'after'
                  ? t({
                      message:
                        'A date of the task up to this many days early takes it, if nearer than the next one.',
                      comment: 'Leeway dialog for a subtask that lands on the date after',
                    })
                  : t({
                      message:
                        'A date of the task up to this many days late takes it, if nearer than the one before.',
                      comment: 'Leeway dialog for a subtask that lands on the date before',
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
