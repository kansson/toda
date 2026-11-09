import { plural } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { DatePicker, TimePicker } from '@/components/date-pickers'
import { RepeatEditor } from '@/components/repeat-editor'
import { useTaskCommands } from '@/components/task-commands'
import {
  FieldCards,
  formPadding,
  SubtaskCards,
  useDetailsRow,
  useListPicker,
} from '@/components/task-form'
import { useActions } from '@/data/provider'
import { useLists, useTask, useToday } from '@/data/queries'
import { fillMaxWidth, verticalScroll } from '@/lib/compose-modifiers'
import { Column, FilledTonalButton, Row, Text, useMaterialColors } from '@/lib/compose-ui'
import { localDate } from '@/tasks/dates'
import { NO_LIST, TITLE_MAX } from '@/tasks/model'
import { ChoiceDialog, ConfirmDialog, TextDialog } from '@/ui/dialogs'
import { datePhrase, dayLabel, deadlineLabel, isOverdue, repeatLabel, timeLabel } from '@/ui/format'
import { Empty, Fab } from '@/ui/primitives'
import { Action, Screen } from '@/ui/screen'

type Overlay =
  | 'title'
  | 'date'
  | 'time'
  | 'deadline'
  | 'repeat'
  | 'list'
  | 'delete'
  | 'deadlineRepeat'
  | null

/**
 * A task's page: its title in the large app bar, renamed in a dialog, then the new task page's
 * cards for its details, list, date, time, repeat and deadline, its subtasks, and Done. Every
 * change is saved as it is made; deleting asks first.
 */
export function TaskScreen() {
  const { t } = useLingui()
  const router = useRouter()
  const colors = useMaterialColors()
  // `done` comes from a late repeating task's check box in a widget (`/done/<id>`).
  const { id, done: checkedInWidget } = useLocalSearchParams<{ id: string; done?: string }>()
  const actions = useActions()
  const commands = useTaskCommands()
  const today = useToday()

  const lists = useLists()

  const { task, subtasks } = useTask(id)
  const [overlay, setOverlay] = useState<Overlay>(null)

  // Checked off in a widget: checked off here once it has loaded, so a late repeating task asks
  // which day it was done and, once told, the page goes back to the tasks; closing the question
  // leaves it open on its page. One done since is left as it is.
  const checkedOff = useRef(false)

  useEffect(() => {
    if (checkedInWidget !== '1' || !task || checkedOff.current) return
    checkedOff.current = true
    router.setParams({ done: undefined })

    if (task.completedAt === null) commands.toggle(task, () => router.back())
  }, [checkedInWidget, task, commands, router])

  const pickList = useListPicker(lists.length > 0, () => setOverlay('list'))

  const details = useDetailsRow(task?.notes ?? '', (value) => {
    if (task) actions.updateTask(task.clientId, { notes: value })
  })

  if (!task) {
    return (
      <Screen title='' navigation='back'>
        <Empty
          glyph='warning'
          height='fill'
          title={t({ message: 'This task is gone', comment: 'Opened a deleted task' })}
        />
      </Screen>
    )
  }

  const done = task.completedAt !== null
  const list = lists.find((candidate) => candidate.clientId === task.listId)
  const isSubtask = task.parentId !== null

  return (
    <Screen
      title={
        task.title || t({ message: '(No title)', comment: 'Shown for a task without a title' })
      }
      appBar='large'
      navigation='back'
      actions={
        <>
          <Action
            glyph='edit'
            label={t({ message: 'Edit title', comment: 'Task page button renaming it' })}
            onPress={() => setOverlay('title')}
          />
          <Action
            glyph={task.starredAt !== null ? 'starFilled' : 'star'}
            label={
              task.starredAt !== null
                ? t({ message: 'Remove star', comment: 'Task page button removing its star' })
                : t({ message: 'Add star', comment: 'Task page button starring it' })
            }
            onPress={() => commands.star(task)}
          />
          <Action
            glyph='delete'
            label={t({ message: 'Delete task', comment: 'Task page button deleting it' })}
            onPress={() => setOverlay('delete')}
          />
        </>
      }
      floatingAction={
        done ? (
          <Fab
            glyph='open'
            label={t({ message: 'Mark not done', comment: 'Task page button reopening it' })}
            onPress={() => commands.toggle(task)}
          />
        ) : (
          <Fab
            glyph='check'
            label={t({ message: 'Mark done', comment: 'Task page button completing it' })}
            onPress={() => commands.toggle(task, () => router.back())}
          />
        )
      }
    >
      <Column
        modifiers={[fillMaxWidth(), verticalScroll(), formPadding]}
        verticalArrangement={{ spacedBy: 16 }}
      >
        <FieldCards
          rows={[
            details.row,
            ...(isSubtask
              ? []
              : [
                  {
                    key: 'list',
                    glyph: 'list' as const,
                    label: t({ message: 'Add to a list', comment: 'Task field: its list, unset' }),
                    value: list?.title ?? null,
                    onPress: pickList,
                    clear: {
                      label: t({
                        message: 'Remove from list',
                        comment: 'Takes a task out of its list',
                      }),
                      onPress: () => actions.moveToList(task.clientId, null),
                    },
                  },
                  {
                    key: 'date',
                    glyph: 'date' as const,
                    label: t({ message: 'Add date', comment: 'Task field: its date, unset' }),
                    value: task.dueDate ? dayLabel(task.dueDate, today) : null,
                    urgent: !done && isOverdue({ ...task, dueTime: null }, today),
                    onPress: () => setOverlay('date'),
                    clear: {
                      label: t({ message: 'Remove date', comment: 'Clears a task’s date' }),
                      onPress: () =>
                        actions.updateTask(task.clientId, {
                          dueDate: null,
                          dueTime: null,
                          repeat: null,
                        }),
                    },
                  },
                ]),
            ...(!isSubtask && task.dueDate
              ? [
                  {
                    key: 'time',
                    glyph: 'time' as const,
                    label: t({ message: 'Add time', comment: 'Task field: its time, unset' }),
                    value: task.dueTime ? timeLabel(task.dueTime) : null,
                    urgent: !done && isOverdue(task, today),
                    onPress: () => setOverlay('time'),
                    clear: {
                      label: t({ message: 'Remove time', comment: 'Clears a task’s time' }),
                      onPress: () => actions.updateTask(task.clientId, { dueTime: null }),
                    },
                  },
                ]
              : []),
            ...(isSubtask
              ? []
              : [
                  {
                    key: 'repeat',
                    glyph: 'repeat' as const,
                    label: t({ message: 'Repeat', comment: 'Task field: how it repeats, unset' }),
                    value: task.repeat ? repeatLabel(task.repeat) : null,
                    onPress: () => setOverlay(task.deadline ? 'deadlineRepeat' : 'repeat'),
                    clear: {
                      label: t({ message: 'Don’t repeat', comment: 'Stops a task repeating' }),
                      onPress: () => actions.updateTask(task.clientId, { repeat: null }),
                    },
                  },
                ]),
            ...(isSubtask || task.repeat
              ? []
              : [
                  {
                    key: 'deadline',
                    glyph: 'deadline' as const,
                    label: t({
                      message: 'Add deadline',
                      comment: 'Task field: its deadline, unset',
                    }),
                    value: task.deadline ? deadlineLabel(task.deadline, today) : null,
                    urgent: !done && task.deadline !== null && task.deadline < today,
                    onPress: () => setOverlay('deadline'),
                    clear: {
                      label: t({ message: 'Remove deadline', comment: 'Clears a task’s deadline' }),
                      onPress: () => actions.updateTask(task.clientId, { deadline: null }),
                    },
                  },
                ]),
          ]}
        />
        {isSubtask ? null : (
          <SubtaskCards
            subtasks={subtasks.map((subtask) => ({
              key: subtask.clientId,
              title: subtask.title,
              done: subtask.completedAt !== null,
            }))}
            onAdd={(value) =>
              actions.createTask({ listId: task.listId, parentId: task.clientId, title: value })
            }
            onToggle={(key) => {
              const subtask = subtasks.find((candidate) => candidate.clientId === key)

              if (subtask) commands.toggle(subtask)
            }}
            onOpen={(key) => router.push({ pathname: '/task/[id]', params: { id: key } })}
            onRemove={(key) => {
              const subtask = subtasks.find((candidate) => candidate.clientId === key)

              if (subtask) commands.remove([subtask])
            }}
          />
        )}
        {isSubtask ? (
          <Row modifiers={[fillMaxWidth()]}>
            <FilledTonalButton onClick={() => actions.outdent(task.clientId)}>
              <Text>
                {t({ message: 'Make a task', comment: 'Turns a subtask into a task of its own' })}
              </Text>
            </FilledTonalButton>
          </Row>
        ) : null}
        {done && task.completedAt ? (
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>
            {t({
              message: `Completed ${datePhrase(localDate(task.completedAt), today)}`,
              comment: 'Task page: when it was completed',
            })}
          </Text>
        ) : null}
      </Column>
      {overlay === 'title' ? (
        <TextDialog
          title={t({ message: 'Edit title', comment: 'Dialog title: renaming a task' })}
          label={t({ message: 'Title', comment: 'Label of a task’s title field' })}
          initialValue={task.title}
          maxLength={TITLE_MAX}
          confirmLabel={t({ message: 'Save', comment: 'Saves a task’s title' })}
          onConfirm={(value) => actions.updateTask(task.clientId, { title: value })}
          onDismiss={() => setOverlay(null)}
        />
      ) : null}
      {overlay === 'date' ? (
        <DatePicker
          value={task.dueDate}
          onPick={(dueDate) => actions.updateTask(task.clientId, { dueDate })}
          onDismiss={() => setOverlay(null)}
        />
      ) : null}
      {overlay === 'time' ? (
        <TimePicker
          value={task.dueTime}
          onPick={(dueTime) => actions.updateTask(task.clientId, { dueTime })}
          onDismiss={() => setOverlay(null)}
        />
      ) : null}
      {overlay === 'deadline' ? (
        <DatePicker
          value={task.deadline}
          onPick={(deadline) => actions.updateTask(task.clientId, { deadline })}
          onDismiss={() => setOverlay(null)}
        />
      ) : null}
      {overlay === 'repeat' ? (
        <RepeatEditor
          repeat={task.repeat}
          dueDate={task.dueDate}
          onSave={(repeat, dueDate) =>
            actions.updateTask(
              task.clientId,
              // A repeat moves the task to its first day and takes its deadline; none changes
              // nothing else.
              repeat ? { repeat, dueDate, deadline: null } : { repeat: null },
            )
          }
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
          title={t({ message: 'Move to list', comment: 'Dialog choosing a task’s list' })}
          options={lists.map((option) => ({ value: option.clientId, label: option.title }))}
          selected={task.listId ?? NO_LIST}
          onSelect={(listId) => actions.moveToList(task.clientId, listId)}
          onDismiss={() => setOverlay(null)}
        />
      ) : null}
      {overlay === 'delete' ? (
        <ConfirmDialog
          title={
            task.repeat
              ? t({ message: 'Delete repeating task?', comment: 'Dialog title' })
              : t({ message: 'Delete task?', comment: 'Dialog title' })
          }
          message={
            subtasks.length > 0
              ? plural(subtasks.length, {
                  one: 'Its subtask is deleted with it.',
                  other: 'Its # subtasks are deleted with it.',
                })
              : task.repeat
                ? t({
                    message: 'Earlier occurrences you completed stay in Completed.',
                    comment: 'Deleting a repeating task',
                  })
                : t({
                    message: 'It is deleted from every phone.',
                    comment: 'Deleting a task',
                  })
          }
          confirmLabel={t({ message: 'Delete', comment: 'Confirms deleting a task' })}
          onConfirm={() => {
            commands.remove([task])
            router.back()
          }}
          onDismiss={() => setOverlay(null)}
        />
      ) : null}
      {details.dialog}
      {commands.prompt}
    </Screen>
  )
}
