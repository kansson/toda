import { plural } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { type ReactNode, useEffect, useState } from 'react'
import {
  animateContentSize,
  alpha,
  fillMaxWidth,
  height,
  matchParentSize,
  menuAnchor,
  padding,
  size,
  verticalScroll,
  weight,
} from '@/lib/compose-modifiers'
import {
  AlertDialog,
  Box,
  Column,
  DropdownMenuItem,
  ExposedDropdownMenu,
  ExposedDropdownMenuBox,
  Icon,
  Row,
  Switch,
  Text,
  TextButton,
  TextField,
  useMaterialColors,
  useNativeState,
} from '@/lib/compose-ui'
import { type CalendarDate, daysInMonth, localDate, parts, weekday } from '@/tasks/dates'
import type { Repeat } from '@/tasks/model'
import { defaultRepeat, fixedRepeat, intervalRepeat, snap } from '@/tasks/recurrence'
import { ChoiceDialog, TextDialog } from '@/ui/dialogs'
import {
  everyLabel,
  fullDate,
  ordinalWeekLabel,
  repeatLabel,
  weekdayName,
  weekdaysPhrase,
} from '@/ui/format'
import { glyphs } from '@/ui/glyphs'
import { SummaryCard } from '@/ui/primitives'
import { PrimaryAction } from '@/ui/screen'
import { Sheet } from '@/ui/sheets'
import { AnimatedRotation } from '../../modules/ui'
import { DatePicker } from './date-pickers'
import { ChecklistDialog, SettingCard } from './setting-cards'
import { type OtherTask, SkipCards } from './skip-cards'

const MAX_INTERVAL = 999

const MAX_TIMES = 9999

type Units = Repeat['unit']

type Dialog = 'interval' | 'weekdays' | 'monthly' | 'ends' | 'endDate' | 'endCount' | null

/** A unit as it reads after a number, singular or plural with it: "day" after 1, "days" after 5. */
function unitWord(unit: Units, count: number) {
  switch (unit) {
    case 'day':
      return plural(count, { one: 'day', other: 'days' })
    case 'week':
      return plural(count, { one: 'week', other: 'weeks' })
    case 'month':
      return plural(count, { one: 'month', other: 'months' })
    case 'year':
      return plural(count, { one: 'year', other: 'years' })
  }
}

const UNITS: Units[] = ['day', 'week', 'month', 'year']

/**
 * How often, as a number and a unit chosen together. A new repeat has no number yet and counts in
 * days until another unit is chosen; there is always one.
 */
export function IntervalDialog({
  interval,
  unit,
  onConfirm,
  onDismiss,
}: {
  interval: number | null
  unit: Units | null
  onConfirm: (interval: number, unit: Units) => void
  onDismiss: () => void
}) {
  const { t } = useLingui()
  const initial = interval === null ? '' : String(interval)
  const text = useNativeState(initial)
  // The cursor starts after what is already there.
  const selection = useNativeState({ start: initial.length, end: initial.length })
  const [value, setValue] = useState(initial)
  const [chosen, setChosen] = useState<Units>(unit ?? 'day')
  const amount = Number(value.trim())

  const valid =
    value.trim() !== '' && Number.isInteger(amount) && amount >= 1 && amount <= MAX_INTERVAL

  const [menu, setMenu] = useState(false)
  const colors = useMaterialColors()
  // The unit agrees with the number typed, and reads as plural until there is one.
  const count = Number.isInteger(amount) && amount >= 1 ? amount : 2
  const unitText = useNativeState(unitWord(chosen, count))

  // The read-only unit field follows the unit chosen and the number typed.
  useEffect(() => {
    unitText.value = unitWord(chosen, count)
  }, [unitText, chosen, count])

  const submit = () => {
    if (!valid) return
    onConfirm(amount, chosen)
    onDismiss()
  }

  return (
    <AlertDialog onDismissRequest={onDismiss}>
      <AlertDialog.Title>
        <Text style={{ typography: 'headlineSmall' }}>
          {t({ message: 'Repeats every', comment: 'Dialog title: how often a task repeats' })}
        </Text>
      </AlertDialog.Title>
      <AlertDialog.Text>
        {/* The number and, beside it, the unit, chosen from Material's exposed dropdown menu. */}
        <Row horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth()]}>
          <TextField
            value={text}
            selection={selection}
            singleLine
            autoFocus
            maxLength={String(MAX_INTERVAL).length}
            keyboardOptions={{ keyboardType: 'number', imeAction: 'done' }}
            keyboardActions={{ onDone: submit }}
            onValueChange={setValue}
            modifiers={[weight(1)]}
          >
            <TextField.Label>
              <Text>{t({ message: 'Number', comment: 'Label of how many days or weeks' })}</Text>
            </TextField.Label>
          </TextField>
          <ExposedDropdownMenuBox expanded={menu} onExpandedChange={setMenu}>
            {/*
              As wide as the longest unit's word and the arrow, so the field never changes width:
              a text field asks for 280 dp at the least, so an invisible copy of every word, laid
              over one another, sets the width and the field fills exactly that. The box is the
              menu's anchor, as Compose takes one only from the menu box's own children.
            */}
            <Box modifiers={[menuAnchor('primaryNotEditable')]}>
              <Row
                verticalAlignment='center'
                modifiers={[height(56), padding(16, 0, 0, 0), alpha(0)]}
              >
                <Box>
                  {UNITS.flatMap((option) =>
                    [1, 2].map((amount) => (
                      <Text
                        key={`${option}${amount}`}
                        maxLines={1}
                        style={{ typography: 'bodyLarge' }}
                      >
                        {unitWord(option, amount)}
                      </Text>
                    )),
                  )}
                </Box>
                <Box modifiers={[size(52, 24)]} />
              </Row>
              <TextField value={unitText} readOnly singleLine modifiers={[matchParentSize()]}>
                <TextField.Label>
                  <Text>
                    {t({ message: 'Unit', comment: 'Label of days, weeks, months or years' })}
                  </Text>
                </TextField.Label>
                <TextField.TrailingIcon>
                  <AnimatedRotation turned={menu}>
                    <Icon source={glyphs.expand} size={24} tint={colors.onSurfaceVariant} />
                  </AnimatedRotation>
                </TextField.TrailingIcon>
              </TextField>
            </Box>
            <ExposedDropdownMenu expanded={menu} onDismissRequest={() => setMenu(false)}>
              {UNITS.map((option) => (
                <DropdownMenuItem
                  key={option}
                  onClick={() => {
                    setChosen(option)
                    setMenu(false)
                  }}
                >
                  <DropdownMenuItem.Text>
                    <Text>{unitWord(option, count)}</Text>
                  </DropdownMenuItem.Text>
                </DropdownMenuItem>
              ))}
            </ExposedDropdownMenu>
          </ExposedDropdownMenuBox>
        </Row>
      </AlertDialog.Text>
      <AlertDialog.ConfirmButton>
        <TextButton enabled={valid} onClick={submit}>
          <Text>{t({ message: 'OK', comment: 'Confirms a dialog' })}</Text>
        </TextButton>
      </AlertDialog.ConfirmButton>
      <AlertDialog.DismissButton>
        <TextButton onClick={onDismiss}>
          <Text>{t({ message: 'Cancel', comment: 'Closes a dialog without changes' })}</Text>
        </TextButton>
      </AlertDialog.DismissButton>
    </AlertDialog>
  )
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

/** The days of the week a fixed weekly repeat falls on, ticked in a list; at least one. */
function WeekdaysDialog({
  weekdays,
  onConfirm,
  onDismiss,
}: {
  weekdays: number[]
  onConfirm: (weekdays: number[]) => void
  onDismiss: () => void
}) {
  const { t } = useLingui()

  return (
    <ChecklistDialog
      title={t({ message: 'Repeats on', comment: 'Dialog title: the weekdays of a weekly repeat' })}
      options={WEEKDAYS.map((day) => ({ value: day, label: weekdayName(day) }))}
      chosen={weekdays}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
    />
  )
}

/**
 * Sets how a task repeats, in one run of cards with the rule summed up below them, saved from the
 * check in the sheet's title bar. A repeat counts from when each occurrence is done (the default:
 * finishing a three-day chore a day late brings it back three days later) or keeps a fixed
 * schedule, which may fall on chosen weekdays or a day of the month. How often and when it ends
 * are chosen in dialogs, with nothing chosen for a new repeat; a set one opens its own dialog
 * again and is cleared with its button. Without how often, Done leaves the task not repeating.
 */
export function RepeatEditor({
  repeat: initial,
  dueDate,
  others = [],
  titleOf = (seriesId: string) =>
    others.find((other) => other.seriesId === seriesId)?.title ?? null,
  onSave,
  onDismiss,
}: {
  repeat: Repeat | null
  /** The task's date; a repeat needs one, and starts on today when it has none. */
  dueDate: CalendarDate | null
  /** The tasks its conditions can mind, the task itself not among them. */
  others?: readonly OtherTask[]
  /** The title of the task a condition minds, or null once it is gone. */
  titleOf?: (seriesId: string) => string | null
  /** The rule and the date the task should have for it, or null to stop repeating. */
  onSave: (repeat: Repeat | null, dueDate: CalendarDate) => void
  onDismiss: () => void
}) {
  const { t } = useLingui()
  const start = dueDate ?? localDate()
  const [repeat, setRepeat] = useState<Repeat>(initial ?? defaultRepeat('week'))
  // Whether how often has been chosen; a new repeat starts without it.
  const [chosen, setChosen] = useState(initial !== null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const first = snap(repeat, start)
  const fixed = repeat.anchor === 'due'

  const update = (patch: Partial<Repeat>) => {
    const merged = { ...repeat, ...patch }

    setRepeat(merged.anchor === 'due' ? fixedRepeat(merged, start) : intervalRepeat(merged))
  }

  const { year, month, day } = parts(start)
  const startWeekday = weekday(start)
  const week = Math.min(4, Math.ceil(day / 7))
  const isLastWeek = day + 7 > daysInMonth(year, month)

  const monthlyChoices = [
    {
      value: 'day' as const,
      label: t({ message: `On day ${day}`, comment: 'Monthly repeat on a day number' }),
    },
    {
      value: 'weekday' as const,
      label: t({
        message: `On the ${ordinalWeekLabel(week)} ${weekdayName(startWeekday)}`,
        comment: 'Monthly repeat on e.g. the second Tuesday',
      }),
    },
    ...(isLastWeek
      ? [
          {
            value: 'last' as const,
            label: t({
              message: `On the last ${weekdayName(startWeekday)}`,
              comment: 'Monthly repeat on e.g. the last Friday',
            }),
          },
        ]
      : []),
  ]

  const monthly =
    repeat.monthly?.kind === 'weekday' ? (repeat.monthly.week === -1 ? 'last' : 'weekday') : 'day'

  const endLabel =
    repeat.end.kind === 'never'
      ? null
      : repeat.end.kind === 'on'
        ? t({ message: `Ends on ${fullDate(repeat.end.date)}`, comment: 'Repeat ends on a date' })
        : plural(repeat.end.count, { one: 'Ends after # time', other: 'Ends after # times' })

  const cards: { key: string; node: (index: number, count: number) => ReactNode }[] = [
    {
      key: 'fixed',
      node: (index, count) => (
        <SettingCard
          key='fixed'
          glyph='date'
          index={index}
          count={count}
          label={t({
            message: 'Fixed schedule',
            comment: 'Repeat editor switch: keep the dates instead of counting from done',
          })}
          onPress={() => update({ anchor: fixed ? 'completion' : 'due' })}
          trailing={
            <Switch
              value={fixed}
              onCheckedChange={(checked) => update({ anchor: checked ? 'due' : 'completion' })}
            />
          }
        />
      ),
    },
    {
      key: 'interval',
      node: (index, count) => (
        <SettingCard
          key='interval'
          glyph='repeat'
          index={index}
          count={count}
          label={t({ message: 'Repeats every', comment: 'Repeat editor: the interval, unset' })}
          value={chosen ? everyLabel(repeat.unit, repeat.interval) : null}
          onPress={() => setDialog('interval')}
          clear={{
            label: t({ message: 'Clear how often', comment: 'Clears a repeat’s interval' }),
            onPress: () => setChosen(false),
          }}
        />
      ),
    },
    ...(chosen && fixed && repeat.unit === 'week'
      ? [
          {
            key: 'weekdays',
            node: (index: number, count: number) => (
              <SettingCard
                key='weekdays'
                glyph='week'
                index={index}
                count={count}
                label={t({
                  message: 'On',
                  comment: 'Repeat editor: the weekdays of a weekly repeat',
                })}
                value={t({
                  message: `On ${weekdaysPhrase(repeat.weekdays)}`,
                  comment: 'Repeat editor: the weekdays of a weekly repeat, as in On Mon, Thu',
                })}
                onPress={() => setDialog('weekdays')}
              />
            ),
          },
        ]
      : []),
    ...(chosen && fixed && repeat.unit === 'month'
      ? [
          {
            key: 'monthly',
            node: (index: number, count: number) => (
              <SettingCard
                key='monthly'
                glyph='today'
                index={index}
                count={count}
                label={t({ message: 'On', comment: 'Repeat editor: which day of the month' })}
                value={monthlyChoices.find((choice) => choice.value === monthly)?.label ?? ''}
                onPress={() => setDialog('monthly')}
              />
            ),
          },
        ]
      : []),
    {
      key: 'ends',
      node: (index, count) => (
        <SettingCard
          key='ends'
          glyph='deadline'
          index={index}
          count={count}
          label={t({ message: 'Ends', comment: 'Repeat editor: when the repeat ends, unset' })}
          value={endLabel}
          onPress={() =>
            setDialog(
              repeat.end.kind === 'on'
                ? 'endDate'
                : repeat.end.kind === 'after'
                  ? 'endCount'
                  : 'ends',
            )
          }
          clear={{
            label: t({ message: 'Clear the end', comment: 'Makes a repeat go on for good' }),
            onPress: () => update({ end: { kind: 'never' } }),
          }}
        />
      ),
    },
  ]

  return (
    <Sheet
      tall
      title={t({ message: 'Repeat', comment: 'Title of the repeat editor' })}
      action={(close) => (
        <PrimaryAction
          glyph='check'
          label={t({ message: 'Done', comment: 'Saves the repeat' })}
          onPress={() => {
            onSave(chosen ? repeat : null, first)
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
          {chosen ? (
            <SkipCards
              repeat={repeat}
              weekly={fixed && repeat.unit === 'week'}
              others={others}
              titleOf={titleOf}
              onChange={(conditions) => setRepeat({ ...repeat, conditions })}
            />
          ) : null}
          {chosen ? <SummaryCard glyph='repeat' title={repeatLabel(repeat, titleOf)} /> : null}
          {dialog === 'interval' ? (
            <IntervalDialog
              interval={chosen ? repeat.interval : null}
              unit={chosen ? repeat.unit : null}
              onConfirm={(interval, unit) => {
                setChosen(true)
                update(
                  unit === repeat.unit
                    ? { interval }
                    : { interval, unit, weekdays: [], monthly: null },
                )
              }}
              onDismiss={() => setDialog(null)}
            />
          ) : null}
          {dialog === 'weekdays' ? (
            <WeekdaysDialog
              weekdays={repeat.weekdays}
              onConfirm={(weekdays) => update({ weekdays })}
              onDismiss={() => setDialog(null)}
            />
          ) : null}
          {dialog === 'monthly' ? (
            <ChoiceDialog
              title={t({ message: 'On', comment: 'Repeat editor: which day of the month' })}
              options={monthlyChoices}
              selected={monthly}
              onSelect={(choice) =>
                update({
                  monthly:
                    choice === 'day'
                      ? { kind: 'day', day }
                      : {
                          kind: 'weekday',
                          week: choice === 'last' ? -1 : week,
                          weekday: startWeekday,
                        },
                })
              }
              onDismiss={() => setDialog(null)}
            />
          ) : null}
          {dialog === 'ends' ? (
            <ChoiceDialog
              title={t({ message: 'Ends', comment: 'Repeat editor: when the repeat ends' })}
              options={[
                {
                  value: 'on',
                  label: t({ message: 'On a date', comment: 'Repeat ends on a date' }),
                },
                {
                  value: 'after',
                  label: t({
                    message: 'After a number of times',
                    comment: 'Repeat ends after a count',
                  }),
                },
              ]}
              selected={repeat.end.kind}
              // The next dialog opens once this one has gone.
              onSelect={(kind) =>
                setTimeout(() => setDialog(kind === 'on' ? 'endDate' : 'endCount'), 0)
              }
              onDismiss={() => setDialog((current) => (current === 'ends' ? null : current))}
            />
          ) : null}
          {dialog === 'endDate' ? (
            <DatePicker
              value={repeat.end.kind === 'on' ? repeat.end.date : first}
              onPick={(date) => update({ end: { kind: 'on', date } })}
              onDismiss={() => setDialog(null)}
            />
          ) : null}
          {dialog === 'endCount' ? (
            <TextDialog
              title={t({
                message: 'Ends after',
                comment: 'Dialog title: how many times it repeats',
              })}
              label={t({ message: 'Times', comment: 'Label of how many times a task repeats' })}
              initialValue={repeat.end.kind === 'after' ? String(repeat.end.count) : ''}
              number={MAX_TIMES}
              confirmLabel={t({ message: 'OK', comment: 'Confirms a dialog' })}
              onConfirm={(value) => update({ end: { kind: 'after', count: Number(value) } })}
              onDismiss={() => setDialog(null)}
            />
          ) : null}
        </Column>
      )}
    </Sheet>
  )
}
