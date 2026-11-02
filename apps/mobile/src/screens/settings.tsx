import { useLingui } from '@lingui/react/macro'
import * as Application from 'expo-application'
import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { AppState, Appearance } from 'react-native'
import { TimePicker } from '@/components/date-pickers'
import { useAccount } from '@/data/account'
import { useActions } from '@/data/provider'
import { useLists } from '@/data/queries'
import { allowHttp, isConvexServer, useServer } from '@/data/server'
import { parseServer, serverHost } from '@/data/server-address'
import { switchServer } from '@/data/shared-db'
import { useFeedback } from '@/lib/feedback'
import { getPreferences, setPreference, usePreferences } from '@/settings/preferences'
import { DEFAULT_LIST_ID } from '@/tasks/model'
import { ChoiceDialog, ConfirmDialog, StatusDialog, TextDialog } from '@/ui/dialogs'
import { timeLabel } from '@/ui/format'
import { Group, List } from '@/ui/primitives'
import { Screen } from '@/ui/screen'
import {
  checkForUpdates,
  showUpdate,
  updatesSupported,
  useUpdateState,
} from '@/updates/app-updates'
import { pinWidget } from '@/widgets/sync'
import { Device } from '../../modules/platform'

type Overlay =
  | 'theme'
  | 'digest'
  | 'digestTime'
  | 'widget'
  | 'channel'
  | 'clearCompleted'
  | 'leave'
  | 'delete'
  | 'server'
  | 'serverConfirm'
  | 'serverChecking'
  | null

/** Whether notifications and exact alarms are allowed, read again on return from system Settings. */
function usePermissions() {
  const [state, setState] = useState({ notifications: true, exact: true })

  useEffect(() => {
    const read = async () => {
      const permission = await Notifications.getPermissionsAsync()

      setState({
        notifications: permission.granted,
        exact: Device?.canScheduleExactAlarms() ?? true,
      })
    }

    void read()

    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void read()
    })

    return () => subscription.remove()
  }, [])

  return state
}

export function applyTheme(theme: 'system' | 'light' | 'dark') {
  Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme)
}

export function SettingsScreen() {
  const { t } = useLingui()
  const router = useRouter()
  const preferences = usePreferences()
  const permissions = usePermissions()
  const account = useAccount()
  const update = useUpdateState()
  const { showFeedback } = useFeedback()
  const actions = useActions()

  const lists = useLists()

  const [overlay, setOverlay] = useState<Overlay>(null)
  const { server } = useServer()
  const [nextServer, setNextServer] = useState<string | null>(null)
  // The check in flight, so a cancelled one is ignored when it answers.
  const serverCheck = useRef(0)
  const nextHost = nextServer ? serverHost(nextServer) : null

  const themes = {
    system: t({ message: 'System default', comment: 'Theme option following the phone' }),
    light: t({ message: 'Light', comment: 'Theme option' }),
    dark: t({ message: 'Dark', comment: 'Theme option' }),
  }

  const updateValue =
    update.phase === 'checking'
      ? t({ message: 'Checking…', comment: 'Settings row while looking for updates' })
      : update.phase === 'current'
        ? t({ message: 'Up to date', comment: 'Settings row when no update is available' })
        : update.phase === 'available' ||
            update.phase === 'failed' ||
            update.phase === 'downloading'
          ? t({ message: 'Update available', comment: 'Settings row when an update is available' })
          : t({ message: 'Check now', comment: 'Settings row checking for updates' })

  async function moveToServer(next: string) {
    const check = ++serverCheck.current

    setOverlay('serverChecking')

    const reachable = await isConvexServer(next)

    if (check !== serverCheck.current) return

    if (!reachable) {
      setOverlay(null)
      showFeedback(
        t({
          message: 'That address isn’t a Convex server, or it can’t be reached now.',
          comment: 'Error under the server address field',
        }),
      )

      return
    }

    // Everything closes and the app opens again on the new server.
    await switchServer(next).catch(() => {
      setOverlay(null)
      showFeedback(
        t({
          message: 'Couldn’t switch servers. Try again.',
          comment: 'Snackbar when moving to another server failed',
        }),
      )
    })
  }

  async function leave(run: () => Promise<void>) {
    try {
      await run()
    } catch {
      showFeedback(
        t({
          message: 'Couldn’t reach the server. Try again when online.',
          comment: 'Snackbar when an account change failed',
        }),
      )
    }
  }

  return (
    <Screen
      title={t({ message: 'Settings', comment: 'Title of the settings screen' })}
      appBar='large'
      navigation='back'
    >
      <List grouped>
        <Group
          title={t({ message: 'Appearance', comment: 'Settings section' })}
          rows={[
            {
              key: 'theme',
              glyph: 'theme',
              label: t({ message: 'Theme', comment: 'Settings row: light, dark or system' }),
              value: themes[preferences.theme],
              onPress: () => setOverlay('theme'),
            },
          ]}
        />
        <Group
          title={t({ message: 'Reminders', comment: 'Settings section' })}
          rows={[
            ...(permissions.notifications
              ? []
              : [
                  {
                    key: 'allow',
                    glyph: 'warning' as const,
                    label: t({
                      message: 'Allow notifications',
                      comment: 'Settings row asking for notification permission',
                    }),
                    value: t({
                      message: 'Reminders are off until you do',
                      comment: 'Settings row explanation',
                    }),
                    onPress: () =>
                      void Notifications.requestPermissionsAsync().then((result) => {
                        if (!result.granted && !result.canAskAgain)
                          Device?.openNotificationSettings()
                      }),
                  },
                ]),
            ...(permissions.exact
              ? []
              : [
                  {
                    key: 'exact',
                    glyph: 'time' as const,
                    label: t({
                      message: 'Remind on the minute',
                      comment: 'Settings row asking for exact alarms',
                    }),
                    value: t({
                      message: 'Allow alarms & reminders, or reminders may come a little late',
                      comment: 'Settings row explanation for exact alarms',
                    }),
                    drillIn: true,
                    onPress: () => Device?.openExactAlarmSettings(),
                  },
                ]),
            {
              key: 'digest',
              glyph: 'today',
              label: t({
                message: 'Morning summary',
                comment: 'Settings row: the daily notification of the day’s tasks',
              }),
              value: preferences.digestTime
                ? t({
                    message: `Every day at ${timeLabel(preferences.digestTime)}`,
                    comment: 'Morning summary time',
                  })
                : t({ message: 'Off', comment: 'Morning summary turned off' }),
              onPress: () => setOverlay('digest'),
            },
            {
              key: 'channels',
              glyph: 'notifications',
              label: t({
                message: 'Notification settings',
                comment: 'Settings row opening the system settings',
              }),
              drillIn: true,
              onPress: () => Device?.openNotificationSettings(),
            },
          ]}
        />
        <Group
          title={t({ message: 'Tasks', comment: 'Settings section about the tasks themselves' })}
          rows={[
            {
              key: 'clearCompleted',
              glyph: 'clearCompleted',
              label: t({ message: 'Delete completed tasks', comment: 'Settings row' }),
              value: t({
                message: 'Every done task, in every list',
                comment: 'Settings row explanation for deleting done tasks',
              }),
              onPress: () => setOverlay('clearCompleted'),
            },
          ]}
        />
        <Group
          title={t({ message: 'Home screen widget', comment: 'Settings section' })}
          rows={[
            {
              key: 'pin',
              glyph: 'widget',
              label: t({
                message: 'Add to home screen',
                comment: 'Settings row pinning the list widget',
              }),
              value: t({
                message: 'Or long-press the home screen and choose Widgets',
                comment: 'Settings row explanation for adding a widget',
              }),
              onPress: () => setOverlay('widget'),
            },
          ]}
        />
        <Group
          title={t({ message: 'Sync', comment: 'Settings section about the sync server' })}
          rows={[
            {
              key: 'server',
              glyph: 'server',
              label: t({ message: 'Server', comment: 'Settings row: the sync server' }),
              value: server ? serverHost(server) : '',
              onPress: () => setOverlay('server'),
            },
          ]}
        />
        <Group
          title={t({
            message: 'Your phones',
            comment: 'Settings section about the account and its phones',
          })}
          rows={[
            {
              key: 'devices',
              glyph: 'devices',
              label: t({
                message: 'Link another phone',
                comment: 'Settings row showing a code for another phone',
              }),
              value:
                account.devices === null
                  ? t({
                      message: 'Not connected yet',
                      comment: 'Settings row before the first sync',
                    })
                  : account.devices === 1
                    ? t({ message: 'Only this phone so far', comment: 'Account with one phone' })
                    : t({
                        message: `${account.devices} phones share these tasks`,
                        comment: 'Account with several phones',
                      }),
              drillIn: true,
              onPress: () => router.push('/link'),
            },
            {
              key: 'leave',
              glyph: 'leave',
              label: t({
                message: 'Start over on this phone',
                comment: 'Settings row leaving the account',
              }),
              value: t({
                message: 'Other phones keep their tasks',
                comment: 'Settings row explanation',
              }),
              onPress: () => setOverlay('leave'),
            },
            {
              key: 'delete',
              glyph: 'delete',
              label: t({
                message: 'Delete all tasks and lists',
                comment: 'Settings row deleting the account',
              }),
              value: t({
                message: 'On every phone, for good',
                comment: 'Settings row explanation',
              }),
              onPress: () => setOverlay('delete'),
            },
          ]}
        />
        {updatesSupported ? (
          <Group
            title={t({ message: 'Updates', comment: 'Settings section' })}
            rows={[
              {
                key: 'check',
                glyph: 'update',
                label: t({ message: 'App updates', comment: 'Settings row checking for updates' }),
                value: updateValue,
                onPress: () =>
                  update.phase === 'available' ||
                  update.phase === 'failed' ||
                  update.phase === 'downloading'
                    ? showUpdate()
                    : void checkForUpdates({ asked: true }),
              },
              {
                key: 'channel',
                glyph: 'history',
                label: t({
                  message: 'Update channel',
                  comment: 'Settings row: stable or nightly builds',
                }),
                value:
                  preferences.updateChannel === 'stable'
                    ? t({ message: 'Stable', comment: 'Update channel: tested releases' })
                    : t({ message: 'Nightly', comment: 'Update channel: daily builds' }),
                onPress: () => setOverlay('channel'),
              },
            ]}
          />
        ) : null}
        <Group
          title={t({ message: 'About', comment: 'Settings section about the app' })}
          rows={[
            {
              key: 'version',
              glyph: 'info',
              label: t({ message: 'Version', comment: 'Settings row showing the app version' }),
              value: `${Application.nativeApplicationVersion ?? ''} (${Application.nativeBuildVersion ?? ''})`,
            },
            {
              key: 'licenses',
              glyph: 'license',
              label: t({
                message: 'Licenses',
                comment: 'Settings row opening the licenses of the open-source packages',
              }),
              drillIn: true,
              onPress: () => router.push('/licenses'),
            },
          ]}
        />
      </List>
      {overlay === 'theme' ? (
        <ChoiceDialog
          title={t({ message: 'Theme', comment: 'Dialog title' })}
          options={(['system', 'light', 'dark'] as const).map((value) => ({
            value,
            label: themes[value],
          }))}
          selected={preferences.theme}
          onSelect={(theme) => {
            setPreference('theme', theme)
            applyTheme(theme)
          }}
          onDismiss={() => setOverlay(null)}
        />
      ) : null}
      {overlay === 'digest' ? (
        <ChoiceDialog
          title={t({ message: 'Morning summary', comment: 'Dialog title' })}
          options={[
            { value: 'off', label: t({ message: 'Off', comment: 'Morning summary turned off' }) },
            ...['07:00', '08:00', '09:00', '10:00'].map((time) => ({
              value: time,
              label: timeLabel(time),
            })),
            {
              value: 'custom',
              label: t({ message: 'Another time…', comment: 'Picks a custom summary time' }),
            },
          ]}
          selected={
            preferences.digestTime === null
              ? 'off'
              : ['07:00', '08:00', '09:00', '10:00'].includes(preferences.digestTime)
                ? preferences.digestTime
                : 'custom'
          }
          onSelect={(value) => {
            if (value === 'custom') setTimeout(() => setOverlay('digestTime'), 0)
            else setPreference('digestTime', value === 'off' ? null : value)
          }}
          onDismiss={() => setOverlay((current) => (current === 'digest' ? null : current))}
        />
      ) : null}
      {overlay === 'digestTime' ? (
        <TimePicker
          value={getPreferences().digestTime}
          onPick={(time) => setPreference('digestTime', time)}
          onDismiss={() => setOverlay(null)}
        />
      ) : null}
      {overlay === 'widget' ? (
        <ChoiceDialog
          title={t({
            message: 'Show in the widget',
            comment: 'Dialog title: what a widget added from Settings shows',
          })}
          options={[
            {
              value: 'today',
              label: t({ message: 'Today', comment: 'The widget shows today’s tasks' }),
            },
            {
              value: 'starred',
              label: t({ message: 'Starred', comment: 'The widget shows starred tasks' }),
            },
            ...lists.map((list) => ({ value: list.clientId, label: list.title })),
          ]}
          selected={DEFAULT_LIST_ID}
          onSelect={(value) => {
            if (!pinWidget('tasks', value))
              showFeedback(
                t({
                  message: 'Long-press the home screen, choose Widgets and find Toda',
                  comment: 'Snackbar when the launcher cannot add the widget itself',
                }),
              )
          }}
          onDismiss={() => setOverlay(null)}
        />
      ) : null}
      {overlay === 'channel' ? (
        <ChoiceDialog
          title={t({ message: 'Update channel', comment: 'Dialog title' })}
          options={[
            {
              value: 'stable',
              label: t({ message: 'Stable', comment: 'Update channel: tested releases' }),
            },
            {
              value: 'nightly',
              label: t({ message: 'Nightly', comment: 'Update channel: daily builds' }),
            },
          ]}
          selected={preferences.updateChannel}
          onSelect={(channel) => {
            setPreference('updateChannel', channel)
            void checkForUpdates({ asked: true })
          }}
          onDismiss={() => setOverlay(null)}
        />
      ) : null}
      {overlay === 'leave' ? (
        <ConfirmDialog
          title={t({ message: 'Start over on this phone?', comment: 'Dialog title' })}
          message={t({
            message:
              'This phone forgets its tasks and starts with an empty list. Other phones linked to it keep theirs; if none are, the tasks are deleted.',
            comment: 'Leaving the account warning',
          })}
          confirmLabel={t({ message: 'Start over', comment: 'Confirms leaving the account' })}
          onConfirm={() => void leave(() => account.leave())}
          onDismiss={() => setOverlay(null)}
        />
      ) : null}
      {overlay === 'clearCompleted' ? (
        <ConfirmDialog
          title={t({ message: 'Delete completed tasks?', comment: 'Dialog title' })}
          message={t({
            message: 'Every done task in every list will be deleted.',
            comment: 'Delete all completed warning',
          })}
          confirmLabel={t({ message: 'Delete', comment: 'Confirms deleting the done tasks' })}
          onConfirm={() => {
            const removed = actions.deleteCompleted()

            showFeedback(
              t({
                message: `${removed.length} tasks deleted`,
                comment: 'Snackbar after clearing done tasks',
              }),
              {
                label: t({
                  message: 'Undo',
                  comment: 'Snackbar button taking back the change just made',
                }),
                run: () => actions.restoreTasks(removed),
              },
            )
          }}
          onDismiss={() => setOverlay(null)}
        />
      ) : null}
      {overlay === 'delete' ? (
        <ConfirmDialog
          title={t({ message: 'Delete everything?', comment: 'Dialog title' })}
          message={t({
            message:
              'All lists and tasks are deleted from the server and every linked phone. This can’t be undone.',
            comment: 'Deleting the account warning',
          })}
          confirmLabel={t({
            message: 'Delete everything',
            comment: 'Confirms deleting the account',
          })}
          onConfirm={() => void leave(() => account.deleteAccount())}
          onDismiss={() => setOverlay(null)}
        />
      ) : null}
      {overlay === 'server' ? (
        <TextDialog
          title={t({ message: 'Server', comment: 'Dialog title: the sync server' })}
          message={t({
            message: 'The address of the Convex server this phone syncs with.',
            comment: 'Explanation in the server dialog',
          })}
          label={t({ message: 'Server address', comment: 'Field label: the sync server' })}
          initialValue={server ?? ''}
          address
          confirmLabel={t({ message: 'Continue', comment: 'Continues to the next step' })}
          onConfirm={(value) => {
            const next = parseServer(value, allowHttp)

            if (next === server) return

            if (!next) {
              showFeedback(
                t({
                  message: 'That isn’t a server address',
                  comment: 'Snackbar for a mistyped server address',
                }),
              )

              return
            }

            setNextServer(next)
            setOverlay('serverConfirm')
          }}
          onDismiss={() => setOverlay((current) => (current === 'server' ? null : current))}
        />
      ) : null}
      {overlay === 'serverConfirm' && nextHost && nextServer ? (
        <ConfirmDialog
          title={t({ message: 'Switch servers?', comment: 'Dialog title' })}
          message={t({
            message: `This phone signs in to ${nextHost} and shows the tasks there instead. Its tasks stay on the old server, but changes not synced yet are lost.`,
            comment: 'Warning before moving to another sync server',
          })}
          confirmLabel={t({ message: 'Switch', comment: 'Confirms moving to another server' })}
          onConfirm={() => void moveToServer(nextServer)}
          onDismiss={() => setOverlay((current) => (current === 'serverConfirm' ? null : current))}
        />
      ) : null}
      {overlay === 'serverChecking' ? (
        <StatusDialog
          title={t({ message: 'Switch servers?', comment: 'Dialog title' })}
          message={t({
            message: 'Connecting…',
            comment: 'While checking the new server answers',
          })}
          busy
          dismissLabel={t({ message: 'Cancel', comment: 'Closes a dialog without changes' })}
          onDismiss={() => {
            serverCheck.current += 1
            setOverlay(null)
          }}
        />
      ) : null}
    </Screen>
  )
}
