import { useLingui } from '@lingui/react/macro'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { CadenceEditor } from '@/components/cadence-editor'
import { DatePicker, TimePicker } from '@/components/date-pickers'
import { RepeatEditor } from '@/components/repeat-editor'
import { useConditionTasks } from '@/components/skip-cards'
import {
  FieldCards,
  formPadding,
  SubtaskCards,
  TitleField,
  useDetailsRow,
  useListPicker,
  useSubtaskSettings,
} from '@/components/task-form'
import { useActions } from '@/data/provider'
import { useLists, useToday } from '@/data/queries'
import { fillMaxWidth, padding, verticalScroll } from '@/lib/compose-modifiers'
import { Column, useNativeState } from '@/lib/compose-ui'
import { type Cadence, nextDue, turnCadences } from '@/tasks/cadence'
import { type CalendarDate } from '@/tasks/dates'
import { newTask, NO_LIST, type Repeat, type Task, TITLE_MAX } from '@/tasks/model'
import { ChoiceDialog, ConfirmDialog, TextDialog } from '@/ui/dialogs'
import {
  cadenceLabel,
  dayLabel,
  deadlineLabel,
  nextDueLabel,
  repeatLabel,
  timeLabel,
} from '@/ui/format'
import { Action, PrimaryAction, Screen } from '@/ui/screen'
import { Sheet } from '@/ui/sheets'

type Overlay = 'date' | 'time' | 'deadline' | 'repeat' | 'deadlineRepeat' | 'list' | null

/** A subtask opened before the task exists, and what of it is being set. */
type OpenSubtask = { key: string; with: 'sheet' | 'title' | 'cadence' }

type PendingSubtask = { key: string; title: string; cadence: Cadence | null }

/**
 * A new task on a page of its own, laid out as a task's page in cards: its title and details, its
 * list, date, time, repeat and deadline, its star and subtasks, all set before it exists. Save adds it; leaving the
 * page any other way keeps it too, as a task's page keeps every change, unless it has no title.
 * The keyboard opens on the title.
 */
export function NewTaskScreen() {
  const { t } = useLingui()
  const router = useRouter()
  const actions = useActions()
  const today = useToday()

  // From the main screen's chip, a widget, the launcher or text another app shared.
  const params = useLocalSearchParams<{
    list?: string
    starred?: string
    title?: string
    notes?: string
  }>()

  const lists = useLists()

  const title = useNativeState(params.title ?? '')
  const [notes, setNotes] = useState(params.notes ?? '')
  const details = useDetailsRow(notes, setNotes)
  const [hasTitle, setHasTitle] = useState((params.title ?? '').trim() !== '')
  const [listId, setListId] = useState(params.list ?? NO_LIST)

  const [dueDate, setDueDate] = useState<CalendarDate | null>(null)

  const [dueTime, setDueTime] = useState<string | null>(null)
  const [repeat, setRepeat] = useState<Repeat | null>(null)
  // A new task has no series yet, so every open dated task can be minded.
  const conditionTasks = useConditionTasks()
  const [deadline, setDeadline] = useState<CalendarDate | null>(null)
  const [starred, setStarred] = useState(params.starred === '1')
  const [subtasks, setSubtasks] = useState<PendingSubtask[]>([])
  const [doneWithSubtasks, setDoneWithSubtasks] = useState(false)
  const [turns, setTurns] = useState(false)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [openSubtask, setOpenSubtask] = useState<OpenSubtask | null>(null)
  // What a row of the subtask's sheet opens once the sheet has gone.
  const afterSheet = useRef<OpenSubtask | null>(null)
  const repeating = dueDate !== null && repeat !== null

  // The task as it will be made, so a subtask's cadence counts with its date and repeat.
  const draft: Task = newTask(
    'new',
    { listId: null, title: '', dueDate, repeat, turns: repeating && turns },
    0,
  )

  const draftSubtask = (subtask: PendingSubtask) =>
    newTask(
      subtask.key,
      { listId: null, parentId: 'new', title: subtask.title, cadence: subtask.cadence },
      0,
    )

  // Taking turns, each subtask's place in them, as they will start.
  const turnCadence = new Map(
    turnCadences(draft, subtasks.map(draftSubtask), today).map(({ id, cadence }) => [id, cadence]),
  )

  const subtaskSettings = useSubtaskSettings({
    count: subtasks.length,
    repeating,
    doneWithSubtasks,
    turns,
    onDoneWithSubtasks: setDoneWithSubtasks,
    onTurns: (checked) => {
      setTurns(checked)

      // Taking turns, the task is done with the one whose turn it is.
      if (checked) setDoneWithSubtasks(true)
    },
  })

  const opened = subtasks.find((subtask) => subtask.key === openSubtask?.key)

  const updateSubtask = (key: string, patch: Partial<PendingSubtask>) =>
    setSubtasks((current) =>
      current.map((subtask) => (subtask.key === key ? { ...subtask, ...patch } : subtask)),
    )

  const nextDueOf = (subtask: Task) => nextDue(subtask, draft, today)

  // When a pending subtask is due, where that is not every time.
  const subtaskNote = (subtask: PendingSubtask) => {
    if (!repeating) return null

    if (turns && subtasks.length > 1)
      return nextDueLabel(
        nextDueOf({ ...draftSubtask(subtask), cadence: turnCadence.get(subtask.key) ?? null }),
        today,
      )

    return subtask.cadence ? cadenceLabel(subtask.cadence) : null
  }

  const pickList = useListPicker(lists.length > 0, () => setOverlay('list'))
  const list = lists.find((candidate) => candidate.clientId === listId)

  // Once saved, leaving the page adds nothing more.
  const settled = useRef(false)

  const save = () => {
    if (settled.current || title.value.trim() === '') return
    settled.current = true

    actions.createTask(
      {
        listId: list?.clientId ?? null,
        title: title.value,
        notes: notes.trim(),
        dueDate,
        dueTime: dueDate ? dueTime : null,
        repeat: dueDate ? repeat : null,
        deadline: repeat ? null : deadline,
        starredAt: starred ? Date.now() : null,
        completion: doneWithSubtasks && subtasks.length > 0 ? 'subtasks' : 'self',
        turns: repeating && turns && subtasks.length > 1,
      },
      // A cadence counts only under a repeating task; taking turns sets its own.
      subtasks.map((subtask) => ({
        title: subtask.title,
        cadence: repeating && !turns ? subtask.cadence : null,
      })),
    )
  }

  // A back swipe or Back leaves without Save; the task is kept all the same.
  const savedOnLeave = useRef(save)
  savedOnLeave.current = save

  useEffect(() => () => savedOnLeave.current(), [])

  return (
    <Screen
      title={t({ message: 'New task', comment: 'Title of the new task page' })}
      appBar='large'
      navigation='back'
      actions={
        <>
          <Action
            glyph={starred ? 'starFilled' : 'star'}
            label={
              starred
                ? t({ message: 'Remove star', comment: 'Task page button removing its star' })
                : t({ message: 'Add star', comment: 'Task page button starring it' })
            }
            onPress={() => setStarred(!starred)}
          />
          <PrimaryAction
            glyph='check'
            label={t({ message: 'Save', comment: 'Saves the new task' })}
            // Every task needs a title, so there is nothing to save without one.
            enabled={hasTitle}
            onPress={() => {
              if (!hasTitle) return
              save()
              router.back()
            }}
          />
        </>
      }
    >
      <Column
        modifiers={[fillMaxWidth(), verticalScroll(), formPadding]}
        verticalArrangement={{ spacedBy: 16 }}
      >
        <TitleField title={title} onTitleChange={(value) => setHasTitle(value.trim() !== '')} />
        <FieldCards
          rows={[
            details.row,
            {
              key: 'list',
              glyph: 'list',
              label: t({ message: 'Add to a list', comment: 'Task field: its list, unset' }),
              value: list?.title ?? null,
              onPress: pickList,
              clear: {
                label: t({ message: 'Remove from list', comment: 'Takes a task out of its list' }),
                onPress: () => setListId(NO_LIST),
              },
            },
            {
              key: 'date',
              glyph: 'date',
              label: t({ message: 'Add date', comment: 'Task field: its date, unset' }),
              value: dueDate ? dayLabel(dueDate, today) : null,
              onPress: () => setOverlay('date'),
              clear: {
                label: t({ message: 'Remove date', comment: 'Clears a task’s date' }),
                onPress: () => {
                  setDueDate(null)
                  setDueTime(null)
                  setRepeat(null)
                },
              },
            },
            ...(dueDate
              ? [
                  {
                    key: 'time',
                    glyph: 'time' as const,
                    label: t({ message: 'Add time', comment: 'Task field: its time, unset' }),
                    value: dueTime ? timeLabel(dueTime) : null,
                    onPress: () => setOverlay('time'),
                    clear: {
                      label: t({ message: 'Remove time', comment: 'Clears a task’s time' }),
                      onPress: () => setDueTime(null),
                    },
                  },
                ]
              : []),
            {
              key: 'repeat',
              glyph: 'repeat',
              label: t({ message: 'Repeat', comment: 'Task field: how it repeats, unset' }),
              value: repeat ? repeatLabel(repeat, conditionTasks.titleOf) : null,
              onPress: () => setOverlay(deadline ? 'deadlineRepeat' : 'repeat'),
              clear: {
                label: t({ message: 'Don’t repeat', comment: 'Stops a task repeating' }),
                onPress: () => setRepeat(null),
              },
            },
            ...(repeat
              ? []
              : [
                  {
                    key: 'deadline',
                    glyph: 'deadline' as const,
                    label: t({
                      message: 'Add deadline',
                      comment: 'Task field: its deadline, unset',
                    }),
                    value: deadline ? deadlineLabel(deadline, today) : null,
                    onPress: () => setOverlay('deadline'),
                    clear: {
                      label: t({ message: 'Remove deadline', comment: 'Clears a task’s deadline' }),
                      onPress: () => setDeadline(null),
                    },
                  },
                ]),
          ]}
        />
        <SubtaskCards
          subtasks={subtasks.map((subtask) => ({
            key: subtask.key,
            title: subtask.title,
            done: false,
            note: subtaskNote(subtask),
          }))}
          settings={subtaskSettings}
          onAdd={(value) =>
            setSubtasks((current) => [
              ...current,
              { key: String(Date.now()), title: value, cadence: null },
            ])
          }
          // Opened as a subtask's page is: to rename it or say when it is due.
          onOpen={(key) => setOpenSubtask({ key, with: 'sheet' })}
          onRemove={(key) =>
            setSubtasks((current) => current.filter((subtask) => subtask.key !== key))
          }
        />
      </Column>
      {overlay === 'date' ? (
        <DatePicker value={dueDate} onPick={setDueDate} onDismiss={() => setOverlay(null)} />
      ) : null}
      {overlay === 'time' ? (
        <TimePicker value={dueTime} onPick={setDueTime} onDismiss={() => setOverlay(null)} />
      ) : null}
      {overlay === 'deadline' ? (
        <DatePicker value={deadline} onPick={setDeadline} onDismiss={() => setOverlay(null)} />
      ) : null}
      {overlay === 'repeat' ? (
        <RepeatEditor
          repeat={repeat}
          dueDate={dueDate}
          others={conditionTasks.others}
          titleOf={conditionTasks.titleOf}
          onSave={(chosen, date) => {
            setRepeat(chosen)

            // A repeat moves the task to its first day and takes its deadline.
            if (chosen) {
              setDueDate(date)
              setDeadline(null)
            }
          }}
          onDismiss={() => setOverlay(null)}
        />
      ) : null}
      {overlay === 'deadlineRepeat' ? (
        <ConfirmDialog
          title={t({ message: 'Repeating tasks have no deadline', comment: 'Dialog title' })}
          message={t({
            message: 'Making this task repeat removes its deadline.',
            comment: 'Dialog message',
          })}
          confirmLabel={t({ message: 'Repeat anyway', comment: 'Continues to the repeat editor' })}
          onConfirm={() => setTimeout(() => setOverlay('repeat'), 0)}
          onDismiss={() => setOverlay((current) => (current === 'deadlineRepeat' ? null : current))}
        />
      ) : null}
      {overlay === 'list' ? (
        <ChoiceDialog
          title={t({ message: 'Add to list', comment: 'Dialog choosing the new task’s list' })}
          options={lists.map((option) => ({ value: option.clientId, label: option.title }))}
          selected={list?.clientId ?? NO_LIST}
          onSelect={setListId}
          onDismiss={() => setOverlay(null)}
        />
      ) : null}
      {opened && openSubtask?.with === 'sheet' ? (
        <Sheet
          title={opened.title}
          onDismiss={() => {
            setOpenSubtask(afterSheet.current)
            afterSheet.current = null
          }}
        >
          {(close) => (
            <Column modifiers={[fillMaxWidth(), padding(16, 0, 16, 24)]}>
              <FieldCards
                rows={[
                  {
                    key: 'title',
                    glyph: 'edit',
                    label: t({ message: 'Edit title', comment: 'Task page button renaming it' }),
                    value: opened.title,
                    onPress: () => {
                      afterSheet.current = { key: opened.key, with: 'title' }
                      close()
                    },
                  },
                  ...(repeating && !(turns && subtasks.length > 1)
                    ? [
                        {
                          key: 'cadence',
                          glyph: 'repeat' as const,
                          label: t({
                            message: 'Due every time the task repeats',
                            comment: 'Subtask field: when it is due, unset',
                          }),
                          value: opened.cadence ? cadenceLabel(opened.cadence) : null,
                          onPress: () => {
                            afterSheet.current = { key: opened.key, with: 'cadence' }
                            close()
                          },
                          clear: {
                            label: t({
                              message: 'Due every time',
                              comment: 'Makes a subtask due every time its task repeats',
                            }),
                            onPress: () => updateSubtask(opened.key, { cadence: null }),
                          },
                        },
                      ]
                    : []),
                ]}
              />
            </Column>
          )}
        </Sheet>
      ) : null}
      {opened && openSubtask?.with === 'title' ? (
        <TextDialog
          title={t({ message: 'Edit title', comment: 'Dialog title: renaming a task' })}
          label={t({ message: 'Title', comment: 'Label of a task’s title field' })}
          initialValue={opened.title}
          maxLength={TITLE_MAX}
          confirmLabel={t({ message: 'Save', comment: 'Saves a task’s title' })}
          onConfirm={(value) => {
            if (value.trim() !== '') updateSubtask(opened.key, { title: value.trim() })
          }}
          onDismiss={() => setOpenSubtask(null)}
        />
      ) : null}
      {opened && openSubtask?.with === 'cadence' && repeating ? (
        <CadenceEditor
          subtask={draftSubtask(opened)}
          parent={draft}
          today={today}
          onSave={(cadence) => updateSubtask(opened.key, { cadence })}
          onDismiss={() => setOpenSubtask(null)}
        />
      ) : null}
      {details.dialog}
    </Screen>
  )
}
