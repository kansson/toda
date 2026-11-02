import { useLingui } from '@lingui/react/macro'
import { useRouter } from 'expo-router'
import { useActions } from '@/data/provider'
import { useFeedback } from '@/lib/feedback'
import { localDate } from '@/tasks/dates'
import type { Task } from '@/tasks/model'
import { datePhrase } from '@/ui/format'

/**
 * What a task row can do, with the snackbar that confirms it and takes it back: completing
 * (saying when a repeating task comes back), reopening, starring, deleting and opening.
 */
export function useTaskCommands() {
  const { t } = useLingui()
  const actions = useActions()
  const router = useRouter()
  const { showFeedback } = useFeedback()
  const undo = t({ message: 'Undo', comment: 'Snackbar button taking back the change just made' })

  function complete(task: Task) {
    const completion = actions.complete(task.clientId)

    if (!completion) return
    const today = localDate()

    const message =
      completion.nextDue !== null
        ? t({
            message: `Done. Back ${datePhrase(completion.nextDue, today)}.`,
            comment: 'Snackbar after completing a repeating task: when the next one is due',
          })
        : t({ message: 'Task done', comment: 'Snackbar after completing a task' })

    showFeedback(message, { label: undo, run: () => actions.undoCompletion(completion) })
  }

  return {
    toggle(task: Task) {
      if (task.completedAt === null) {
        complete(task)
      } else {
        actions.reopen(task.clientId)
        showFeedback(
          t({ message: 'Task not done', comment: 'Snackbar after reopening a done task' }),
        )
      }
    },

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
