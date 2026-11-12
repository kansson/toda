import { useLingui } from '@lingui/react/macro'
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { DatePicker } from '@/components/date-pickers'
import { DoneDaySheet } from '@/components/done-day-sheet'
import { useActions } from '@/data/provider'
import { useAllTasks, useToday } from '@/data/queries'
import { useFeedback } from '@/lib/feedback'
import { asksDoneDay, completedBy } from '@/tasks/completion'
import { type CalendarDate, localDate } from '@/tasks/dates'
import type { Task } from '@/tasks/model'
import { datePhrase } from '@/ui/format'

/**
 * A late repeating task waiting to hear which day it was done, and how it is being asked; the
 * task checked off is `checked`, its subtask when that is the last one it waited for.
 */
type Asking = { task: Task; checked: Task; afterwards?: () => void; with: 'sheet' | 'calendar' }

/**
 * What a task row can do, with the snackbar that confirms it and takes it back: completing
 * (saying when a repeating task comes back), reopening, starring, deleting and opening. A late
 * repeating task first asks which day it was done (`prompt`, which the screen renders).
 */
export function useTaskCommands() {
  const { t } = useLingui()
  const actions = useActions()
  const router = useRouter()
  const today = useToday()
  const tasks = useAllTasks()
  const { showFeedback } = useFeedback()
  const [asking, setAsking] = useState<Asking | null>(null)
  // Whether the task asked about was done, so its `afterwards` follows once the question has gone.
  const answered = useRef(false)
  const undo = t({ message: 'Undo', comment: 'Snackbar button taking back the change just made' })

  function complete(task: Task, day: CalendarDate | null = null) {
    const completion = actions.complete(task.clientId, day)

    if (!completion) return
    const now = localDate()

    const message =
      completion.nextDue !== null
        ? t({
            message: `Done. Back ${datePhrase(completion.nextDue, now)}.`,
            comment: 'Snackbar after completing a repeating task: when the next one is due',
          })
        : t({ message: 'Task done', comment: 'Snackbar after completing a task' })

    showFeedback(message, { label: undo, run: () => actions.undoCompletion(completion) })
  }

  function finish(day: CalendarDate) {
    if (!asking) return
    // A day picked in the calendar after today means today.
    complete(asking.checked, day > today ? today : day)
    answered.current = true
  }

  function dismiss() {
    if (answered.current) asking?.afterwards?.()
    answered.current = false
    setAsking(null)
  }

  const prompt =
    asking?.with === 'sheet' ? (
      <DoneDaySheet
        task={asking.task}
        today={today}
        onPick={finish}
        onPickAnother={() => setAsking({ ...asking, with: 'calendar' })}
        onDismiss={dismiss}
      />
    ) : asking?.with === 'calendar' ? (
      <DatePicker value={asking.task.dueDate} onPick={finish} onDismiss={dismiss} />
    ) : null

  return {
    /**
     * Checks a task off or opens it again. A late repeating task asks first which day it was
     * done, as does one that its last subtask due this time does; `afterwards` runs once it is
     * done, such as leaving its page.
     */
    toggle(task: Task, afterwards?: () => void) {
      const target = task.completedAt === null ? completedBy(task, tasks, today) : task

      if (task.completedAt !== null) {
        actions.reopen(task.clientId)
        showFeedback(
          t({ message: 'Task not done', comment: 'Snackbar after reopening a done task' }),
        )
      } else if (asksDoneDay(target, today)) {
        answered.current = false
        setAsking({ task: target, checked: task, afterwards, with: 'sheet' })
      } else {
        complete(task)
        afterwards?.()
      }
    },

    /** The question a late repeating task asks before it is checked off, while it is asked. */
    prompt,

    star(task: Task) {
      actions.setStarred(task.clientId, task.starredAt === null)
    },

    remove(tasks: Task[]) {
      const removed = actions.deleteTasks(tasks.map((task) => task.clientId))

      if (removed.length === 0) return
      const count = tasks.length

      showFeedback(
        count === 1
          ? t({ message: 'Task deleted', comment: 'Snackbar after deleting a task' })
          : t({
              message: `${count} tasks deleted`,
              comment: 'Snackbar after deleting several tasks',
            }),
        { label: undo, run: () => actions.restoreTasks(removed) },
      )
    },

    open(task: Task) {
      router.push({ pathname: '/task/[id]', params: { id: task.clientId } })
    },
  }
}
