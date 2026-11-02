import { useLingui } from '@lingui/react/macro'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { useEffect, useMemo } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import AppError from '@/components/app-error'
import { AppSync } from '@/components/app-sync'
import { Host } from '@/components/host'
import { ServerSetup } from '@/components/server-setup'
import { SystemBack } from '@/components/system-back'
import { UpdateAlert } from '@/components/update-alert'
import { DataProvider } from '@/data/provider'
import { useServer } from '@/data/server'
import { LocalizationProvider } from '@/i18n'
import { useAppColorScheme } from '@/lib/app-color-scheme'
import { FeedbackProvider, useFeedback } from '@/lib/feedback'
import { rootBackgroundColor } from '@/lib/root-background'
import { registerReminderTask } from '@/reminders/background'
import { setUpReminders } from '@/reminders/notifications'
import { applyTheme } from '@/screens/settings'
import { getPreferences } from '@/settings/preferences'
import { LoadingPage } from '@/ui/primitives'

applyTheme(getPreferences().theme)

function Data({ children }: { children: React.ReactNode }) {
  const { t } = useLingui()
  const { showFeedback } = useFeedback()
  const { server, switching } = useServer()

  const onRefused = useMemo(
    () => () =>
      showFeedback(
        t({
          message: 'A change couldn’t be saved and was undone',
          comment: 'Snackbar when the server refused a change',
        }),
      ),
    [showFeedback, t],
  )

  // A published build carries no server, so the first launch asks for one. Moving to another
  // closes everything for the moment the old server's copy is deleted.
  if (switching)
    return (
      <Host style={{ flex: 1 }}>
        <LoadingPage />
      </Host>
    )

  if (!server) return <ServerSetup />

  return (
    <DataProvider
      key={server}
      server={server}
      onRefused={onRefused}
      fallback={(error, retry) =>
        error ? (
          <AppError message={error.message} onRetry={retry} />
        ) : (
          <Host style={{ flex: 1 }}>
            <LoadingPage />
          </Host>
        )
      }
    >
      {children}
    </DataProvider>
  )
}

function AppProviders() {
  const { t } = useLingui()
  const colorScheme = useAppColorScheme()
  const baseTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme
  const background = rootBackgroundColor(colorScheme === 'dark')

  const theme = useMemo(
    () => ({ ...baseTheme, colors: { ...baseTheme.colors, background, card: background } }),
    [baseTheme, background],
  )

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(background)
  }, [background])

  // Channels and buttons follow the phone's language.
  useEffect(() => {
    void setUpReminders().catch(() => undefined)
    void registerReminderTask().catch(() => undefined)
  }, [t])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={theme}>
        <StatusBar animated />
        <FeedbackProvider>
          <Data>
            <AppSync />
            {/*
              Screens open and close with Android 17's activity transitions, as the system
              Settings app's pages do (config/android-transitions), and a back swipe previews
              the screen below as the system does between activities (StackBack.kt).
            */}
            <Stack
              screenOptions={{
                animation: 'default',
                // A page with nothing under it goes back by replacing itself with the main screen;
                // that should move as going back does, not as opening a page.
                animationTypeForReplace: 'pop',
                contentStyle: { backgroundColor: background },
                headerShown: false,
              }}
            >
              {/* A link's stand-in for the new task's page, replaced by it without a slide. */}
              <Stack.Screen name='add' options={{ animation: 'none' }} />
              <Stack.Screen name='open/[id]' options={{ animation: 'none' }} />
            </Stack>
            <UpdateAlert />
          </Data>
          <SystemBack />
        </FeedbackProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}

// A page opened from a link (a widget, the launcher, a share) has the main screen under it, so
// Back returns to the tasks rather than leaving the app.
export const unstable_settings = { anchor: 'index' }

export default function RootLayout() {
  return (
    <LocalizationProvider>
      <AppProviders />
    </LocalizationProvider>
  )
}

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <LocalizationProvider>
      <AppError message={error.message} onRetry={retry} />
    </LocalizationProvider>
  )
}
