import { useLingui } from '@lingui/react/macro'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef } from 'react'
import { Appearance, AppState } from 'react-native'
import { z } from 'zod'
import { useActions, useData } from '@/data/provider'
import { useAllTasks, useLists, useToday } from '@/data/queries'
import { scheduleReminders } from '@/reminders/notifications'
import { respondToReminder } from '@/reminders/respond'
import { usePreferences } from '@/settings/preferences'
import { cadenceOf } from '@/tasks/cadence'
import { asksDoneDayAfter } from '@/tasks/completion'
import type { ListSort, Task } from '@/tasks/model'
import { sharedTask } from '@/tasks/share'
import { listSorts } from '@/tasks/views'
import { cadenceLabel, dueLabel, isOverdue, sortLabels } from '@/ui/format'
import { checkForUpdatesDaily } from '@/updates/app-updates'
import { sortedTasks, viewTasks, type WidgetView } from '@/widgets/snapshot'
import {
  completeWidgetTasks,
  onWidgetCompletion,
  redrawWidgets,
  updateWidgets,
} from '@/widgets/sync'
import type { WidgetSource, WidgetTask } from '@/widgets/types'
import { Share } from '../../modules/platform'

const scheme = z.string().catch('toda').parse(Constants.expoConfig?.scheme)

const link = (path: string) => `${scheme}://${path}`

const reminderDataSchema = z.object({ taskIds: z.array(z.string()) }).catch({ taskIds: [] })

/** How many tasks the widget gets in each sort; it scrolls, but a phone shows a dozen at most. */
const WIDGET_TASKS = 40

/**
 * The app's work beside its screens, kept in step with the data: reminders scheduled again after
 * every change, the widgets redrawn, taps on widgets and reminders acted on, text shared from
 * other apps opened as a new task, and a daily look for updates.
 */
export function AppSync() {
  const { i18n, t } = useLingui()
  const router = useRouter()
  const actions = useActions()
  const { db } = useData()
  const tasks = useAllTasks()
  const today = useToday()
  const preferences = usePreferences()

  const lists = useLists()
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  const listTitles = useMemo(
    () => new Map(lists.map((list) => [list.clientId, list.title])),
    [lists],
  )

  // Notifications are asked for once there is something to remind of, as Google Tasks does.
  const hasDates = tasks.some((task) => task.dueDate !== null && task.completedAt === null)

  useEffect(() => {
    if (!hasDates) return

    void Notifications.getPermissionsAsync().then(async (permission) => {
      if (!permission.granted && permission.canAskAgain && permission.status === 'undetermined') {
        await Notifications.requestPermissionsAsync()
        await scheduleReminders(tasks, listTitles)
      }
    })
    // Asked once per start at most; the answer sticks.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDates])

  // Reminders follow the tasks, a moment after the last change.
  useEffect(() => {
    const timer = setTimeout(() => void scheduleReminders(tasks, listTitles), 800)

    return () => clearTimeout(timer)
  }, [tasks, listTitles, preferences.digestTime])

  // Every widget picks its own source and sort as it is placed, so each one gets written: Today,
  // Starred and every list, in every sort. The tasks are read as they are when it is built, not
  // as the last render had them: a widget check-off completed since then must show as done.
  useEffect(() => {
    const timer = setTimeout(() => {
      const now = Date.now()
      const current = [...db.tasks.values()]
      const byId = new Map(current.map((task) => [task.clientId, task]))

      const cadenceText = (task: Task) => {
        const cadence = task.parentId === null ? null : cadenceOf(task, byId.get(task.parentId))

        return cadence ? cadenceLabel(cadence) : ''
      }

      const widgetTask = (task: Task): WidgetTask => ({
        id: task.clientId,
        title:
          task.title.trim() ||
          t({ message: '(No title)', comment: 'Shown for a task without a title' }),
        due: dueLabel(task, today),
        overdue: isOverdue(task, today),
        starred: task.starredAt !== null,
        asksAfter: asksDoneDayAfter(task) ?? '',
        parentId: task.parentId ?? '',
        cadence: cadenceText(task),
      })

      const source = (
        key: string,
        title: string,
        addLink: string,
        view: WidgetView,
        sort: ListSort,
      ): WidgetSource => {
        const sorted = sortedTasks(
          (option) => viewTasks(current, view, option, today, now),
          sort,
          WIDGET_TASKS,
        )

        return {
          key,
          title,
          addLink,
          sort,
          tasks: sorted.tasks.map(widgetTask),
          orders: sorted.orders,
        }
      }

      const sources: WidgetSource[] = [
        source(
          'today',
          t({ message: 'Today', comment: 'Widget title: today’s tasks' }),
          link('add'),
          { kind: 'today' },
          'manual',
        ),
        source(
          'starred',
          t({ message: 'Starred', comment: 'Widget title: starred tasks' }),
          link('add?starred=1'),
          { kind: 'starred' },
          'manual',
        ),
        ...lists.map((list) =>
          source(
            list.clientId,
            list.title,
            link(`add?list=${list.clientId}`),
            { kind: 'list', listId: list.clientId },
            list.sort,
          ),
        ),
      ]

      void updateWidgets({
        newTaskLink: link('add'),
        taskLink: link('open/'),
        doneLink: link('done/'),
        labels: {
          emptyTitle: t({ message: 'No tasks', comment: 'Widget with no open tasks' }),
          newTask: t({ message: 'New task', comment: 'Widget button adding a task' }),
          complete: t({ message: 'Mark done', comment: 'Widget check box completing a task' }),
          sorts: listSorts.map((key) => ({ key, label: i18n._(sortLabels[key]) })),
        },
        sources,
      }).catch((error: Error) => {
        if (__DEV__) console.warn('[widgets] update failed', error)
      })
    }, 500)

    return () => clearTimeout(timer)
  }, [db, tasks, lists, today, i18n, t])

  // Tasks checked off in a widget are completed here, with their repeat and sync: at once while
  // the app runs, and on its next start or return for those checked off while it did not. They
  // are taken only once the phone's copy has loaded: taking them hands them over for good, and a
  // task not loaded yet cannot be completed, so on a cold start it came back in the app and, with
  // the next snapshot, in the widget.
  useEffect(() => {
    let alive = true

    const complete = () => {
      db.tasks.preload().then(
        () => {
          if (!alive) return

          completeWidgetTasks((taskId, checkedAt) =>
            actionsRef.current.complete(taskId, null, checkedAt),
          )
        },
        // Left in the widget's keeping; the next start or return takes them.
        () => undefined,
      )
    }

    complete()
    const stop = onWidgetCompletion(complete)

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') complete()
    })

    return () => {
      alive = false
      stop()
      subscription.remove()
    }
  }, [db])

  // The widgets take the new palette when the phone switches between light and dark.
  useEffect(() => {
    const subscription = Appearance.addChangeListener(() => redrawWidgets())

    return () => subscription.remove()
  }, [])

  // Reminder taps: the buttons act; a tap on the reminder itself opens its task or the day.
  useEffect(() => {
    const open = (response: Notifications.NotificationResponse) => {
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
        void respondToReminder(response)

        return
      }

      const ids = reminderDataSchema.parse(response.notification.request.content.data).taskIds

      if (ids.length === 1 && ids[0])
        router.push({ pathname: '/task/[id]', params: { id: ids[0] } })
      else router.navigate({ pathname: '/', params: { view: 'today' } })
    }

    const last = Notifications.getLastNotificationResponse()

    if (last) {
      open(last)
      void Notifications.clearLastNotificationResponseAsync()
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(open)

    return () => subscription.remove()
  }, [router])

  // Text shared from another app opens as a new task in the first list.
  useEffect(() => {
    const take = () => {
      const shared = Share?.takeShared()

      if (!shared) return
      const { title, notes } = sharedTask(shared.text, shared.subject)

      router.navigate({ pathname: '/add', params: { title, notes } })
    }

    take()
    const subscription = Share?.addListener('onShare', take)

    return () => subscription?.remove()
  }, [router])

  // Updates are looked for once a day, at start and on return to the app.
  useEffect(() => {
    checkForUpdatesDaily()

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkForUpdatesDaily()
    })

    return () => subscription.remove()
  }, [])

  return null
}
